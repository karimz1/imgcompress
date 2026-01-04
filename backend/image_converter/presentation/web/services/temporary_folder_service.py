import os
import tempfile
from typing import Optional

from backend.image_converter.infrastructure.cleanup_service import CleanupService

class TemporaryFolderService:
    def __init__(self, temp_dir: str, expiration_time: int, logger):
        self.temp_dir = temp_dir
        self.cleanup_service = CleanupService(temp_dir, expiration_time, logger)

    def cleanup(self, force: bool = False):
        return self.cleanup_service.cleanup_temp_folders(force=force)

    def get_container_files(self):
        return self.cleanup_service.get_container_files()

    def create_temp_dir(self, prefix: str) -> str:
        return tempfile.mkdtemp(prefix=prefix)

    def is_in_temp(self, path: str) -> bool:
        return os.path.abspath(path).startswith(os.path.abspath(self.temp_dir))

    def get_validated_path(self, folder_name: str) -> Optional[str]:
        """
        Ensures the requested folder is a sub-directory of the safe TEMP_DIR.
        """
        if not folder_name:
            return None

        # Normalize paths to resolve '..' and symlinks
        base_dir = os.path.abspath(self.temp_dir)
        # Use normpath to prevent directory traversal
        target_path = os.path.abspath(os.path.join(base_dir, folder_name))

        # Security check: Ensure target is inside base_dir
        if os.path.commonpath([base_dir, target_path]) != base_dir:
            return None

        return target_path if os.path.isdir(target_path) else None
