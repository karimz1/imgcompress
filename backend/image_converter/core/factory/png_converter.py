from typing import Dict
from PIL import Image
from io import BytesIO
import traceback

from backend.image_converter.core.internals.utls import Result
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.interfaces.iconverter import IImageConverter

class PngConverter(IImageConverter):
    """Converts raw image bytes to a PNG file on disk, preserving the alpha channel."""

    def __init__(self, logger: Logger):
        self.logger = logger

    def convert(self, image_data: bytes, source_path: str, dest_path: str) -> Result[Dict]:
        """
        Converts image data to PNG format and writes it to disk.

        Returns:
            Result.success: with a dictionary containing details if conversion is successful.
            Result.failure: with a traceback string if an error occurs.
        """
        result_dict = {
            "source": source_path,
            "destination": dest_path,
            "success": True,
            "error": None,
        }
        try:
            # Open the image from bytes.
            with Image.open(BytesIO(image_data)) as img:
                # Save the image as PNG.
                img.save(dest_path, "PNG")
                self.logger.log(f"Saved PNG: {dest_path}", "debug")
            
            return Result.success(result_dict)
        except Exception as e:
            tb = traceback.format_exc()
            self.logger.log(f"Failed to convert to PNG: {tb}", "error")
            result_dict["success"] = False
            result_dict["error"] = tb
            return Result.failure(result_dict)
