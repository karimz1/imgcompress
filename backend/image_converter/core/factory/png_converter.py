from io import BytesIO
import traceback

from PIL import Image

from backend.image_converter.application.dtos import ConversionDetails
from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.interfaces.base_converter import BaseImageConverter

class PngConverter(BaseImageConverter):
    """Converts raw image bytes to a PNG file on disk, preserving the alpha channel."""

    def __init__(self, logger: Logger):
        super().__init__(logger)

    def encode_to_bytes(self, image_data: bytes) -> bytes:
        with Image.open(BytesIO(image_data)) as img:
            buffer = BytesIO()
            img.save(buffer, "PNG")
            return buffer.getvalue()
