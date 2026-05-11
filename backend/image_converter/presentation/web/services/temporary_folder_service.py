import os
import tempfile
from typing import Optional, Tuple

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

    def get_validated_path(self, folder_name: Optional[str]) -> Optional[str]:
        if not folder_name:
            return None
        resolved = self._resolve_inside_temp(folder_name)
        return resolved if resolved and os.path.isdir(resolved) else None

    def resolve_download_target(
        self,
        folder: Optional[str],
        filename: Optional[str],
    ) -> Optional[Tuple[str, str]]:
        if not folder or not filename:
            return None
        safe_name = os.path.basename(filename)
        if safe_name in ("", ".", ".."):
            return None
        folder_abs = self._resolve_inside_temp(folder)
        if folder_abs is None:
            return None
        target = os.path.join(folder_abs, safe_name)
        if not os.path.isfile(target):
            return None
        return folder_abs, safe_name

    def _resolve_inside_temp(self, path: str) -> Optional[str]:
        base_dir = os.path.realpath(self.temp_dir)
        candidate = path if os.path.isabs(path) else os.path.join(base_dir, path)
        resolved = os.path.realpath(candidate)
        try:
            common = os.path.commonpath([base_dir, resolved])
        except ValueError:
            return None
        return resolved if common == base_dir else None
