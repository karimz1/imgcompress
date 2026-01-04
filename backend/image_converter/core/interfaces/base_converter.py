import traceback
from io import BytesIO
from PIL import Image
from backend.image_converter.application.dtos import ConversionDetails
from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.interfaces.iconverter import IImageConverter

class BaseImageConverter(IImageConverter):
    """
    Abstract base class for all image converters.
    Provides common functionality for saving converted images and stripping metadata.
    """

    def __init__(self, logger: Logger):
        self.logger = logger

    def convert(self, image_data: bytes, source_path: str, dest_path: str) -> Result[ConversionDetails]:
        """
        Standard conversion flow: encode, write to disk, and return details.
        """
        try:
            converted_data = self.encode_to_bytes(image_data)
            self._write_to_disk(converted_data, dest_path)
            
            self.logger.log(f"Successfully converted and saved to {dest_path}", "debug")
            
            conversion_details = ConversionDetails(
                source=source_path,
                destination=dest_path,
                bytes_written=len(converted_data),
            )
            return Result.success(conversion_details)
        except Exception:
            error_traceback = traceback.format_exc()
            self.logger.log(f"Failed to convert image: {error_traceback}", "error")
            return Result.failure(error_traceback)

    def encode_to_bytes(self, image_data: bytes) -> bytes:
        """
        To be implemented by subclasses to perform the actual encoding.
        """
        raise NotImplementedError

    def _write_to_disk(self, data: bytes, destination_path: str) -> None:
        """Helper to write bytes to a file."""
        with open(destination_path, "wb") as file:
            file.write(data)

    def strip_metadata_and_normalize(self, image_data: bytes, output_format: str) -> bytes:
        """
        Normalizes image bytes by re-saving them, effectively stripping most metadata.
        """
        with Image.open(BytesIO(image_data)) as image:
            output_buffer = BytesIO()
            image.save(output_buffer, format=output_format)
            return output_buffer.getvalue()

    def _encode_to_avif(self, image_data: bytes, quality: int) -> bytes:
        """
        Encodes image data to AVIF format with the specified quality.
        Ensures the image is in a compatible mode (RGB or RGBA).
        """
        with Image.open(BytesIO(image_data)) as img:
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGBA")

            buffer = BytesIO()
            img.save(buffer, format="AVIF", quality=quality)
            return buffer.getvalue()
