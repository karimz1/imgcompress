import os
from typing import List
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.internals.utls import FileUrl


class FileManager:
    def __init__(self, source_folder: str, dest_folder: str, logger: Logger):
        self.source_folder = source_folder
        self.dest_folder = dest_folder
        self.logger = logger

    def ensure_destination(self):
        if not os.path.exists(self.dest_folder):
            os.makedirs(self.dest_folder, exist_ok=True)
            self.logger.log(f"Created destination folder: {self.dest_folder}", "debug")

    def list_supported_files(self) -> List[FileUrl]:
        all_files = os.listdir(self.source_folder)
        file_urls = [FileUrl(os.path.join(self.source_folder, f)) for f in all_files]
        supported_files = [
            file_url for file_url in file_urls
            if file_url.exists() and file_url.is_supported()
        ]
        self.logger.log(f"Found {len(supported_files)} supported file(s).", "debug")
        return supported_files
