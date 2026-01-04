from io import BytesIO
import traceback

from PIL import Image

from backend.image_converter.application.dtos import ConversionDetails
from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.interfaces.base_converter import BaseImageConverter

class IcoConverter(BaseImageConverter):
    """
    Converts raw image bytes to a valid ICO file on disk, preserving alpha,
    but includes *only* one resolution.

    The caller (processor) is expected to resize the image_data
    to the desired dimension before calling `encode_to_bytes`.
    """

    def __init__(self, logger: Logger):
        super().__init__(logger)

    def encode_to_bytes(self, image_data: bytes) -> bytes:
        with Image.open(BytesIO(image_data)) as img:
            if img.mode != "RGBA":
                img = img.convert("RGBA")

            buffer = BytesIO()
            img.save(buffer, format="ICO")
            return buffer.getvalue()
