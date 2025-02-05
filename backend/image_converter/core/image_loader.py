import os
import pyheif
from PIL import Image
from typing import Optional
from .enums.conversion_error import ConversionError
from .enums.image_format import ImageFormat
from backend.image_converter.infrastructure.logger import Logger

class ImageLoader:
    """Responsible for loading images from disk."""

    def __init__(self, logger: Logger):
        self.logger = logger

    def load_image(self, source_path: str, output_format: ImageFormat) -> Image.Image:
        if not os.path.exists(source_path):
            raise ConversionError(f"Source path does not exist: {source_path}")

        _, ext = os.path.splitext(source_path)
        ext_lower = ext.lower()

        if ext_lower in [".heic", ".heif"]:
            image = self._load_heif_image(source_path)
        else:
            image = Image.open(source_path)
            self.logger.log(f"Loaded image: {source_path}", "debug")

        # Only convert to RGB if outputting as JPEG
        if output_format == ImageFormat.JPEG and image.mode in ("RGBA", "P"):
            image = image.convert("RGB")
            self.logger.log(f"Converted image mode to RGB for JPEG: {source_path}", "debug")

        return image

    def _load_heif_image(self, source_path: str) -> Image.Image:
        heif_file = pyheif.read(source_path)
        image = Image.frombytes(
            heif_file.mode,
            heif_file.size,
            heif_file.data,
            "raw",
            heif_file.mode,
            heif_file.stride,
        )
        self.logger.log(f"Loaded HEIF image: {source_path}", "debug")
        return image
