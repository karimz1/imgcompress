import os
import traceback
from backend.image_converter.core.internals.utilities import Result

class ImageLoader:
    """
    Loads image data as raw bytes from disk.
    """

    def load_image_as_bytes(self, path: str) -> Result[bytes]:
        """
        Read the entire file as bytes and return a Result.
        """
        try:
            if not os.path.exists(path):
                raise FileNotFoundError(f"File not found: {path}")

            with open(path, "rb") as f:
                data = f.read()
            return Result.success(data)
        except Exception as e:
            tb = traceback.format_exc()
            return Result.failure(tb)
