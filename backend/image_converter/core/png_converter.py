from typing import Dict
from PIL import Image
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.iconverter import IImageConverter
from backend.image_converter.core.enums.conversion_error import ConversionError

class PngConverter(IImageConverter):
    """Handles conversion to PNG."""

    def __init__(self, logger: Logger):
        self.logger = logger

    def convert(self, 
                image: Image.Image, 
                source_path: str, 
                dest_path: str) -> Dict:
        result = {
            "source": source_path,
            "destination": dest_path,
            "is_successful": True,
            "error": None
        }

        try:
            # For PNG, preserve transparency if present
            image.save(dest_path, "PNG")
            self.logger.log(f"Saved PNG: {dest_path}", "debug")
        except Exception as e:
            self.logger.log(f"Failed to convert to PNG: {e}", "error")
            result["is_successful"] = False
            result["error"] = str(e)

        return result
