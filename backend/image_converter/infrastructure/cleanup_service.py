import os
import time
import shutil
from typing import Dict, List
import traceback
from backend.image_converter.core.internals.utls import Result                                       

class CleanupService:
    """
    Handles deleting temp subfolders and ZIP files older than EXPIRATION_TIME,
    or forced cleanup of all relevant items.
    """

    def __init__(self, temp_dir: str, expiration_time: int, logger):
        self.temp_dir = temp_dir
        self.expiration_time = expiration_time
        self.logger = logger

    def cleanup_temp_folders(self, force: bool = False) -> Result[Dict]:
        """
        Performs cleanup and returns a Result containing a summary of actions.
        """
        summary = {
            "deleted": [],
            "errors": []
        }
        current_time = time.time()

        for item in os.listdir(self.temp_dir):
            item_path = os.path.join(self.temp_dir, item)

            if os.path.isdir(item_path) and (item.startswith("source_") or item.startswith("converted_")):
                res = self._maybe_delete_dir(item_path, force, current_time)
                if res.is_successful:
                    summary["deleted"].append({"type": "directory", "path": item_path})
                else:
                    summary["errors"].append({"type": "directory", "path": item_path, "error": res.error})
            elif os.path.isfile(item_path) and item.startswith("converted_") and item.endswith(".zip"):
                res = self._maybe_delete_zip(item_path, force, current_time)
                if res.is_successful:
                    summary["deleted"].append({"type": "zip", "path": item_path})
                else:
                    summary["errors"].append({"type": "zip", "path": item_path, "error": res.error})

        return Result.success(summary)

    def _maybe_delete_dir(self, dir_path: str, force: bool, current_time: float) -> Result[None]:
        try:
            creation_time = os.path.getctime(dir_path)
            if force or (current_time - creation_time > self.expiration_time):
                shutil.rmtree(dir_path, ignore_errors=True)
                self.logger.log(f"Deleted temp folder: {dir_path}", "info")
            return Result.success(None)
        except Exception as e:
            tb = traceback.format_exc()
            self.logger.log(f"Error deleting folder {dir_path}: {tb}", "error")
            return Result.failure(tb)

    def _maybe_delete_zip(self, zip_path: str, force: bool, current_time: float) -> Result[None]:
        try:
            creation_time = os.path.getctime(zip_path)
            if force or (current_time - creation_time > self.expiration_time):
                os.remove(zip_path)
                self.logger.log(f"Deleted ZIP file: {zip_path}", "info")
            return Result.success(None)
        except Exception as e:
            tb = traceback.format_exc()
            self.logger.log(f"Error deleting ZIP file {zip_path}: {tb}", "error")
            return Result.failure(tb)

    def get_container_files(self) -> Dict:
        """
        Scan the temp_dir for "converted_*" folders or zip files.
        Return a summary with total count + total size in MB.
        """
        files_list: List[Dict] = []
        total_size = 0
        total_count = 0

        self.logger.log(f"Scanning TEMP_DIR: {self.temp_dir}", "info")

                 
        for folder in os.listdir(self.temp_dir):
            folder_path = os.path.join(self.temp_dir, folder)
            if os.path.isdir(folder_path) and folder.startswith("converted_"):
                for fname in os.listdir(folder_path):
                    file_path = os.path.join(folder_path, fname)
                    if os.path.isfile(file_path):
                        size_mb = round(os.path.getsize(file_path) / (1024 * 1024), 2)
                        files_list.append({
                            "folder": folder,
                            "folder_path": folder_path,
                            "filename": fname,
                            "size_mb": size_mb
                        })
                        total_size += size_mb
                        total_count += 1

              
        for fname in os.listdir(self.temp_dir):
            if fname.startswith("converted_") and fname.endswith(".zip"):
                file_path = os.path.join(self.temp_dir, fname)
                if os.path.isfile(file_path):
                    size_mb = round(os.path.getsize(file_path) / (1024 * 1024), 2)
                    files_list.append({
                        "folder": "zip",
                        "folder_path": self.temp_dir,
                        "filename": fname,
                        "size_mb": size_mb
                    })
                    total_size += size_mb
                    total_count += 1

        self.logger.log(f"Total files found: {total_count}, total size: {total_size} MB", "info")
        return {
            "files": files_list,
            "total_size_mb": round(total_size, 2),
            "total_count": total_count
        }
