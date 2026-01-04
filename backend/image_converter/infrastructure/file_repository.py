import os
import traceback
from typing import Callable, TypeVar

from backend.image_converter.core.internals.utilities import Result

T = TypeVar("T")


class FileRepository:
    """
    Reads/writes file bytes on disk.
    """

    def read_file(self, path: str) -> Result[bytes]:
        return self._execute(lambda: self._read_bytes(path), f"read '{path}'")

    def write_file(self, path: str, data: bytes) -> Result[None]:
        return self._execute(lambda: self._write_bytes(path, data), f"write '{path}'")

    def _read_bytes(self, path: str) -> bytes:
        with open(path, "rb") as f:
            return f.read()

    def _write_bytes(self, path: str, data: bytes) -> None:
        directory = os.path.dirname(path)
        if directory:
            os.makedirs(directory, exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)

    def _execute(self, action: Callable[[], T], context: str) -> Result[T]:
        try:
            return Result.success(action())
        except Exception:
            tb = traceback.format_exc()
            return Result.failure(f"Failed to {context}: {tb}")
