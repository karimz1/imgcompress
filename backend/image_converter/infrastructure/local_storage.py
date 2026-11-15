import os
import traceback
from dataclasses import dataclass
from typing import Iterable

from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.infrastructure.safe_path import path_inside

@dataclass
class FileItem:
    path: str
    name: str
    stem: str
    # Folder of the file below the source folder, "" at the top. Always "/"-separated.
    relative_dir: str = ""

class LocalStorage:
    def __init__(self, logger: Logger | None = None):
        self.logger = logger

    def iter_files(self, folder: str) -> Iterable[FileItem]:
        """Every file below ``folder``: its own files first, then those of the sub folders, in name order."""
        for current, dirs, names in os.walk(folder):
            dirs.sort()
            relative_dir = os.path.relpath(current, folder).replace(os.sep, "/")
            if relative_dir == ".":
                relative_dir = ""
            for name in sorted(names):
                path = os.path.join(current, name)
                if os.path.isfile(path):
                    stem, _ = os.path.splitext(name)
                    yield FileItem(path=path, name=name, stem=stem, relative_dir=relative_dir)

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
        """``name`` may carry sub folders ("a/b/photo.jpg"); they are created here.

        The path must stay inside ``folder``. Errors never name the path, since
        they are shown to the user and would reveal the container's folders.
        """
        parts = name.split("/")
        path = path_inside(folder, *parts)
        if path is None or path == os.path.realpath(folder) or any(p in ("", ".", "..") for p in parts):
            raise ValueError("Invalid output path.")
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
        except OSError:
            self._log_failure("create the folder of", path)
            raise ValueError("Could not create the output folder.") from None
        return path

    def _log_failure(self, action: str, path: str) -> None:
        if self.logger is None:
            return
        self.logger.log(
            f"Failed to {action} '{path}': {traceback.format_exc()}",
            "error",
        )
