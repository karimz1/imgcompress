import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from werkzeug.security import safe_join

from backend.image_converter.infrastructure.cleanup_service import CleanupService


@dataclass(frozen=True)
class DownloadTarget:
    file_path: str
    download_name: str


class TemporaryFolderService:
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

    def get_validated_path(self, folder_name: Optional[str]) -> Optional[str]:
        if not folder_name:
            return None
        resolved = self._resolve_inside_temp(folder_name)
        return str(resolved) if resolved and resolved.is_dir() else None

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
        folder_path = self._resolve_inside_temp(folder)
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

    def _resolve_inside_temp(self, path: str) -> Optional[Path]:
        candidate = Path(path)
        if candidate.is_absolute():
            resolved = candidate.resolve()
        else:
            target = safe_join(str(self.base_dir), path)
            if target is None:
                return None
            resolved = Path(target).resolve()
        return resolved if self._is_inside(self.base_dir, resolved) else None

    @staticmethod
    def _is_inside(base_dir: Path, candidate: Path) -> bool:
        try:
            candidate.relative_to(base_dir)
        except ValueError:
            return False
        return True
