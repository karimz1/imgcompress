import os
import shutil
import time
import traceback

from backend.image_converter.application.dtos import (
    CleanedItem,
    CleanupError,
    CleanupSummary,
    ContainerFile,
    ContainerInventory,
)
from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.domain.units import BYTES_PER_MEBIBYTE
from backend.image_converter.infrastructure import job_folder_lock


_KIND_DIRECTORY = "directory"
_KIND_ZIP = "zip"
_ZIP_FOLDER_LABEL = "zip"
# A job folder that is still locked but has not changed for this long belongs
# to a hung request. Only age-based cleanup removes it; a forced cleanup never
# touches a locked folder.
# A longer result window raises this too, so a job is never cut off before its
# own results would expire.
ABANDONED_JOB_SECONDS = 24 * 60 * 60
# Cleanup runs at least this often, so a long result window does not let the
# disk fill up between runs.
CLEANUP_INTERVAL_SECONDS = 60 * 60


def cleanup_interval_seconds(max_age_seconds: int) -> int:
    """How often the scheduler runs: hourly, or sooner for a shorter window."""
    return min(max_age_seconds, CLEANUP_INTERVAL_SECONDS)


class CleanupService:
    """Deletes expired temp conversion folders/ZIPs and reports what was kept.

    Folders of running jobs are locked (see job_folder_lock) and always kept,
    with or without ``force``. Age counts from the folder's last activity.
    """

    def __init__(self, temp_dir: str, expiration_time: int, logger):
        self.temp_dir = temp_dir
        self.expiration_time = expiration_time
        self.logger = logger

    def cleanup_temp_folders(self, force: bool = False) -> Result[CleanupSummary]:
        summary = CleanupSummary()
        current_time = time.time()

        for item in os.listdir(self.temp_dir):
            item_path = os.path.join(self.temp_dir, item)
            if os.path.isdir(item_path) and item.startswith(("source_", "converted_", "job_")):
                result = self._maybe_delete_dir(item_path, force, current_time)
                self._record_cleanup_outcome(summary, _KIND_DIRECTORY, item_path, result)
            elif (
                os.path.isfile(item_path)
                and item.startswith("converted_")
                and item.endswith(".zip")
            ):
                result = self._maybe_delete_zip(item_path, force, current_time)
                self._record_cleanup_outcome(summary, _KIND_ZIP, item_path, result)

        return Result.success(summary)

    def get_container_files(self) -> ContainerInventory:
        files: list[ContainerFile] = []
        total_size = 0.0

        self.logger.log(f"Scanning TEMP_DIR: {self.temp_dir}", "info")

        for folder in os.listdir(self.temp_dir):
            folder_path = os.path.join(self.temp_dir, folder)
            if os.path.isdir(folder_path) and folder.startswith("converted_"):
                for fname in os.listdir(folder_path):
                    file_path = os.path.join(folder_path, fname)
                    if os.path.isfile(file_path):
                        size_mb = self._file_size_mb(file_path)
                        files.append(ContainerFile(
                            folder=folder,
                            folder_path=folder_path,
                            filename=fname,
                            size_mb=size_mb,
                        ))
                        total_size += size_mb

        for fname in os.listdir(self.temp_dir):
            if fname.startswith("converted_") and fname.endswith(".zip"):
                file_path = os.path.join(self.temp_dir, fname)
                if os.path.isfile(file_path):
                    size_mb = self._file_size_mb(file_path)
                    files.append(ContainerFile(
                        folder=_ZIP_FOLDER_LABEL,
                        folder_path=self.temp_dir,
                        filename=fname,
                        size_mb=size_mb,
                    ))
                    total_size += size_mb

        inventory = ContainerInventory(
            files=files,
            total_size_mb=round(total_size, 2),
            total_count=len(files),
        )
        self.logger.log(
            f"Total files found: {inventory.total_count}, "
            f"total size: {inventory.total_size_mb} MB",
            "info",
        )
        return inventory

    def _maybe_delete_dir(
        self,
        dir_path: str,
        force: bool,
        current_time: float,
    ) -> Result[bool]:
        try:
            idle_seconds = current_time - self._last_activity(dir_path)
            if not force and idle_seconds <= self.expiration_time:
                return Result.success(False)
            acquired, lock_fd = job_folder_lock.try_exclusive(dir_path)
            if not acquired and (
                force or idle_seconds <= max(ABANDONED_JOB_SECONDS, self.expiration_time)
            ):
                self.logger.log(f"Kept temp folder of a running job: {dir_path}", "info")
                return Result.success(False)
            try:
                shutil.rmtree(dir_path, ignore_errors=True)
            finally:
                job_folder_lock.release(lock_fd)
            self.logger.log(f"Deleted temp folder: {dir_path}", "info")
            return Result.success(True)
        except FileNotFoundError:
            # Another worker deleted it first.
            return Result.success(False)
        except Exception:
            tb = traceback.format_exc()
            self.logger.log(f"Error deleting folder {dir_path}: {tb}", "error")
            return Result.failure(tb)

    @staticmethod
    def _last_activity(dir_path: str) -> float:
        """Newest mtime of the folder and its files; downloads touch the folder too."""
        latest = os.path.getmtime(dir_path)
        with os.scandir(dir_path) as entries:
            for entry in entries:
                try:
                    latest = max(latest, entry.stat(follow_symlinks=False).st_mtime)
                except FileNotFoundError:
                    continue
        return latest

    def _maybe_delete_zip(
        self,
        zip_path: str,
        force: bool,
        current_time: float,
    ) -> Result[bool]:
        try:
            creation_time = os.path.getctime(zip_path)
            if force or (current_time - creation_time > self.expiration_time):
                os.remove(zip_path)
                self.logger.log(f"Deleted ZIP file: {zip_path}", "info")
                return Result.success(True)
            return Result.success(False)
        except Exception:
            tb = traceback.format_exc()
            self.logger.log(f"Error deleting ZIP file {zip_path}: {tb}", "error")
            return Result.failure(tb)

    @staticmethod
    def _record_cleanup_outcome(
        summary: CleanupSummary,
        kind: str,
        path: str,
        result: Result[bool],
    ) -> None:
        if result.is_successful:
            if result.value:
                summary.deleted.append(CleanedItem(kind=kind, path=path))
            return
        summary.errors.append(CleanupError(kind=kind, path=path, error=result.error))

    @staticmethod
    def _file_size_mb(path: str) -> float:
        return round(os.path.getsize(path) / BYTES_PER_MEBIBYTE, 2)
