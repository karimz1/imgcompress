import os
from dataclasses import dataclass
from typing import Iterable

@dataclass
class FileItem:
    path: str
    name: str
    stem: str

class LocalStorage:
    def iter_files(self, folder: str) -> Iterable[FileItem]:
        for name in os.listdir(folder):
            p = os.path.join(folder, name)
            if os.path.isfile(p):
                stem, _ = os.path.splitext(name)
                yield FileItem(path=p, name=name, stem=stem)

    def read_bytes(self, path: str) -> bytes:
        with open(path, "rb") as f:
            return f.read()

    def write_bytes(self, path: str, data: bytes) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)

    def build_dest_path(self, folder: str, name: str) -> str:
        return os.path.join(folder, name)
