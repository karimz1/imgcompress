import os
import traceback
from dataclasses import dataclass
from typing import Iterable

from backend.image_converter.core.internals.utls import Result

@dataclass
class FileItem:
    path: str
    name: str
    stem: str

class LocalStorage:
    def iter_files(self, folder: str) -> Iterable[FileItem]:
        for name in self._list_directory(folder):
            p = os.path.join(folder, name)
            if os.path.isfile(p):
                stem, _ = os.path.splitext(name)
                yield FileItem(path=p, name=name, stem=stem)

    def read_bytes(self, path: str) -> Result[bytes]:
        try:
            with open(path, "rb") as f:
                return Result.success(f.read())
        except Exception:
            return Result.failure(self._format_error("read", path))

    def write_bytes(self, path: str, data: bytes) -> Result[None]:
        try:
            directory = os.path.dirname(path)
            if directory:
                os.makedirs(directory, exist_ok=True)
            with open(path, "wb") as f:
                f.write(data)
            return Result.success(None)
        except Exception:
            return Result.failure(self._format_error("write", path))

    def build_dest_path(self, folder: str, name: str) -> str:
        return os.path.join(folder, name)

    def _list_directory(self, folder: str) -> Iterable[str]:
        try:
            return os.listdir(folder)
        except FileNotFoundError:
            return []

    def _format_error(self, action: str, path: str) -> str:
        tb = traceback.format_exc()
        return f"Failed to {action} '{path}': {tb}"
