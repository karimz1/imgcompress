from typing import Dict
from PIL import Image
from io import BytesIO
from backend.image_converter.core.interfaces.iconverter import IImageConverter
from backend.image_converter.infrastructure.logger import Logger

class PngConverter(IImageConverter):
    """Converts raw image bytes -> final PNG on disk, preserving alpha."""

    def __init__(self, logger: Logger):
        self.logger = logger

    def convert(self, image_data: bytes, source_path: str, dest_path: str) -> Dict:
        result = {
            "source": source_path,
            "destination": dest_path,
            "is_successful": True,
            "error": None
        }

        try:
            with Image.open(BytesIO(image_data)) as img:
                # For PNG, preserve alpha
                img.save(dest_path, "PNG")
                self.logger.log(f"Saved PNG: {dest_path}", "debug")
        except Exception as e:
            self.logger.log(f"Failed to convert to PNG: {e}", "error")
            result["is_successful"] = False
            result["error"] = str(e)

        return result
