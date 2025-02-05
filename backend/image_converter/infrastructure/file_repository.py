import os

class FileRepository:
    """
    Reads/writes file bytes on disk.
    """

    def read_file(self, path: str) -> bytes:
        with open(path, "rb") as f:
            return f.read()

    def write_file(self, path: str, data: bytes):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)
