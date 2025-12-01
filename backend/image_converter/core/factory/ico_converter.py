from io import BytesIO
import traceback

from PIL import Image

from backend.image_converter.application.dtos import ConversionDetails
from backend.image_converter.core.internals.utls import Result
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.interfaces.iconverter import IImageConverter

class IcoConverter(IImageConverter):
    """
    Converts raw image bytes to a valid ICO file on disk, preserving alpha,
    but includes *only* one resolution.

    The caller (processor) is expected to resize the image_data
    to the desired dimension before calling `convert`.
    """

    def __init__(self, logger: Logger):
        self.logger = logger

    def convert(self, image_data: bytes, source_path: str, dest_path: str) -> Result[ConversionDetails]:
        """
        Convert image_data to an ICO file and return typed details.
        """
        try:
            with Image.open(BytesIO(image_data)) as img:
                if img.mode != "RGBA":
                    img = img.convert("RGBA")

                buffer = BytesIO()
                img.save(buffer, format="ICO")
                data = buffer.getvalue()

            with open(dest_path, "wb") as f:
                f.write(data)

                self.logger.log(f"ICO saved to {dest_path}", "debug")

            details = ConversionDetails(
                source=source_path,
                destination=dest_path,
                bytes_written=len(data),
            )
            return Result.success(details)

        except Exception:
            tb = traceback.format_exc()
            msg = f"Failed to convert to ICO: {tb}"
            self.logger.log(msg, "error")
            return Result.failure(tb)
