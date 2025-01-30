import os
from typing import List
from backend.image_converter.infrastructure.logger import Logger

SUPPORTED_EXTENSIONS = [
    ".heic", ".heif",
    ".jpg", ".jpeg",
    ".png", ".bmp",
    ".gif", ".tif", ".tiff",
    ".webp"
]

class FileManager:
    def __init__(self, source_folder: str, dest_folder: str, logger: Logger):
        self.source_folder = source_folder
        self.dest_folder = dest_folder
        self.logger = logger

    def ensure_destination(self):
        if not os.path.exists(self.dest_folder):
            os.makedirs(self.dest_folder, exist_ok=True)
            self.logger.log(f"Created destination folder: {self.dest_folder}", "debug")

    def list_supported_files(self) -> List[str]:
        all_files = os.listdir(self.source_folder)
        supported_files = [
            f for f in all_files
            if os.path.splitext(f)[1].lower() in SUPPORTED_EXTENSIONS
        ]
        self.logger.log(f"Found {len(supported_files)} supported files.", "debug")
        return supported_files
