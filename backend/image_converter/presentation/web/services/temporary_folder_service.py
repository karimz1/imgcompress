import os
import tempfile
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
