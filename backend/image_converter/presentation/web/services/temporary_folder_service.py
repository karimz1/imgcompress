import os.path
import shutil
import tempfile
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from werkzeug.security import safe_join

from backend.image_converter.infrastructure import job_folder_lock
from backend.image_converter.infrastructure.cleanup_service import CleanupService

# Only finished conversion results may be served; uploads (source_*), ZIPs,
# logs and anything else in the temp dir stay private.
_DOWNLOAD_FOLDER_PREFIX = "converted_"


@dataclass(frozen=True)
class DownloadTarget:
    file_path: str
    download_name: str


@dataclass
class JobFolder:
    """A temp folder held by a running job; cleanup skips it until released."""

    path: str
    _lock_fd: Optional[int] = field(default=None, repr=False)

    def release(self) -> None:
        job_folder_lock.release(self._lock_fd)
        self._lock_fd = None


class TemporaryFolderService:
    """Owns temp-directory path validation before files are read, zipped, or served."""

    def __init__(self, temp_dir: str, expiration_time: int, logger):
        self.temp_dir = temp_dir
        self.base_dir = Path(temp_dir).resolve()
        self.cleanup_service = CleanupService(temp_dir, expiration_time, logger)

    def cleanup(self, force: bool = False):
        return self.cleanup_service.cleanup_temp_folders(force=force)

    def get_container_files(self):
        return self.cleanup_service.get_container_files()

    def create_temp_dir(self, prefix: str) -> str:
        return tempfile.mkdtemp(prefix=prefix, dir=self.temp_dir)

    def create_job_dir(self, prefix: str) -> JobFolder:
        """Creates a temp folder that cleanup leaves alone until ``release()``."""
        while True:
            path = self.create_temp_dir(prefix)
            try:
                return JobFolder(path, job_folder_lock.hold_shared(path))
            except FileNotFoundError:
                # A forced cleanup won the race for the empty folder; take a new one.
                shutil.rmtree(path, ignore_errors=True)

    @contextmanager
    def use_folder(self, path: str):
        """Keeps cleanup away from ``path`` while it is read, then marks it as recently used."""
        try:
            fd = job_folder_lock.hold_shared(path)
        except FileNotFoundError:
            fd = None
        try:
            yield
            self.mark_activity(path)
        finally:
            job_folder_lock.release(fd)

    @staticmethod
    def mark_activity(path: str) -> None:
        """Age-based cleanup counts from the last activity, so a download restarts the clock."""
        try:
            os.utime(path)
        except OSError:
            pass

    def get_validated_path(self, folder_name: Optional[str]) -> Optional[str]:
        if not folder_name:
            return None
        resolved = self._resolve_download_folder(folder_name)
        return str(resolved) if resolved else None

    def resolve_download_target(
        self,
        folder: Optional[str],
        filename: Optional[str],
    ) -> Optional[DownloadTarget]:
        if not folder or not filename:
            return None
        requested_name = filename.strip()
        if requested_name in ("", ".", ".."):
            return None
        folder_path = self._resolve_download_folder(folder)
        if folder_path is None:
            return None
        target = safe_join(str(folder_path), requested_name)
        if target is None:
            return None
        resolved_target = Path(target).resolve()
        if (
            not self._is_inside(folder_path, resolved_target)
            or not resolved_target.is_file()
        ):
            return None
        return DownloadTarget(str(resolved_target), resolved_target.name)

    def _resolve_download_folder(self, path: str) -> Optional[Path]:
        """A direct converted_* child of the temp dir, never the temp dir itself."""
        resolved = self._resolve_inside_temp(path)
        if (
            resolved is None
            or resolved.parent != self.base_dir
            or not resolved.name.startswith(_DOWNLOAD_FOLDER_PREFIX)
            or not resolved.is_dir()
        ):
            return None
        return resolved

    def _resolve_inside_temp(self, path: str) -> Optional[Path]:
        if not path:
            return None
        base = str(self.base_dir)
        if os.path.isabs(path):
            real = os.path.realpath(path)
        else:
            real = os.path.realpath(os.path.join(base, path))
        try:
            relative = os.path.relpath(real, base)
        except ValueError:
            return None
        # Rebuild the path from the temp root through safe_join, which rejects
        # anything that climbs out of it. Callers may hand us either an absolute
        # temp path we handed them earlier or a bare folder name, so both shapes
        # are normalised to a relative segment first.
        safe = safe_join(base, relative)
        if safe is None:
            return None
        resolved = Path(safe)
        if not self._is_inside(self.base_dir, resolved):
            return None
        return resolved

    @staticmethod
    def _is_inside(base_dir: Path, candidate: Path) -> bool:
        try:
            candidate.relative_to(base_dir)
        except ValueError:
            return False
        return True
