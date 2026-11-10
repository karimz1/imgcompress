from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.interfaces.base_converter import BaseImageConverter


class WebpConverter(BaseImageConverter):
    """Converts raw image bytes to a WebP file on disk, preserving the alpha channel."""

    def __init__(self, quality: int, logger: Logger, lossless: bool = False):
        super().__init__(logger)
        self.quality = int(quality)
        self.lossless = lossless

    def encode_to_bytes(self, image_data: bytes) -> bytes:
        return self._encode_to_webp(image_data, self.quality, self.lossless)
