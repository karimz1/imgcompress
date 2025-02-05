import os

class ImageLoader:
    """
    Loads image data as raw bytes from disk.
    """

    def load_image_as_bytes(self, path: str) -> bytes:
        """
        Read the entire file as bytes. This does not open with Pillow,
        so you can pass the bytes to any library or pipeline.
        """
        if not os.path.exists(path):
            raise FileNotFoundError(f"File not found: {path}")

        with open(path, "rb") as f:
            return f.read()
