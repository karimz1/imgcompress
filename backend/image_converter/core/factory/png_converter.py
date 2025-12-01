from io import BytesIO
import traceback

from PIL import Image

from backend.image_converter.application.dtos import ConversionDetails
from backend.image_converter.core.internals.utls import Result
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.interfaces.iconverter import IImageConverter

class PngConverter(IImageConverter):
    """Converts raw image bytes to a PNG file on disk, preserving the alpha channel."""

    def __init__(self, logger: Logger):
        self.logger = logger

    def convert(self, image_data: bytes, source_path: str, dest_path: str) -> Result[ConversionDetails]:
        """
        Converts image data to PNG format and writes it to disk.

        Returns:
            Result.success: with a dictionary containing details if conversion is successful.
            Result.failure: with a traceback string if an error occurs.
        """
        try:
            with Image.open(BytesIO(image_data)) as img:
                buffer = BytesIO()
                img.save(buffer, "PNG")
                data = buffer.getvalue()

            with open(dest_path, "wb") as f:
                f.write(data)

            self.logger.log(f"Saved PNG: {dest_path}", "debug")
            details = ConversionDetails(
                source=source_path,
                destination=dest_path,
                bytes_written=len(data),
            )
            return Result.success(details)
        except Exception:
            tb = traceback.format_exc()
            self.logger.log(f"Failed to convert to PNG: {tb}", "error")
            return Result.failure(tb)
