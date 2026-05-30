import os
import traceback
from dataclasses import dataclass
from typing import Iterable

from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.infrastructure.logger import Logger

@dataclass
class FileItem:
    path: str
    name: str
    stem: str

class LocalStorage:
    def __init__(self, logger: Logger | None = None):
        self.logger = logger

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
            self._log_failure("read", path)
            return Result.failure("Failed to read file.")

    def write_bytes(self, path: str, data: bytes) -> Result[None]:
        try:
            directory = os.path.dirname(path)
            if directory:
                os.makedirs(directory, exist_ok=True)
            with open(path, "wb") as f:
                f.write(data)
            return Result.success(None)
        except Exception:
            self._log_failure("write", path)
            return Result.failure("Failed to write file.")

    def build_dest_path(self, folder: str, name: str) -> str:
        return os.path.join(folder, name)

    def _list_directory(self, folder: str) -> Iterable[str]:
        try:
            return os.listdir(folder)
        except FileNotFoundError:
            return []

    def _log_failure(self, action: str, path: str) -> None:
        if self.logger is None:
            return
        self.logger.log(
            f"Failed to {action} '{path}': {traceback.format_exc()}",
            "error",
        )
