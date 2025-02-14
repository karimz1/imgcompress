import os
import traceback
from backend.image_converter.core.internals.utls import Result

class FileRepository:
    """
    Reads/writes file bytes on disk.
    """

    def read_file(self, path: str) -> Result[bytes]:
        try:
            with open(path, "rb") as f:
                data = f.read()
            return Result.success(data)
        except Exception as e:
            tb = traceback.format_exc()
            return Result.failure(tb)

    def write_file(self, path: str, data: bytes) -> Result[None]:
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "wb") as f:
                f.write(data)
            return Result.success(None)
        except Exception as e:
            tb = traceback.format_exc()
            return Result.failure(tb)
