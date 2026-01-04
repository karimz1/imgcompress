from io import BytesIO
from PIL import Image

from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.interfaces.base_converter import BaseImageConverter

class AvifConverter(BaseImageConverter):
    """Converts raw image bytes to an AVIF file on disk."""

    def __init__(self, quality: int, logger: Logger):
        super().__init__(logger)
        self.quality = quality

    def encode_to_bytes(self, image_data: bytes) -> bytes:
        return self._encode_to_avif(image_data, self.quality)
