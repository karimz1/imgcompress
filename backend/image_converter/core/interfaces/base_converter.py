import traceback
from io import BytesIO
from PIL import Image, ImageOps
from backend.image_converter.application.dtos import ConversionDetails
from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.interfaces.iconverter import IImageConverter

# libwebp stores width and height in 14 bits, so neither side can exceed this.
WEBP_MAX_DIMENSION = 16383


class BaseImageConverter(IImageConverter):
    """
    Abstract base class for all image converters.
    Provides common functionality for saving converted images and stripping metadata.
    """

    # Converters that strip the background (e.g. rembg-based) set this to True so
    # the pipeline can tag their output filenames.
    removes_background: bool = False

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

    def _encode_to_webp(self, image_data: bytes, quality: int, lossless: bool = False) -> bytes:
        """
        Encodes image data to WebP with the specified quality.
        - applies EXIF orientation, since the orientation tag is not carried over
        - keeps the alpha channel when the source has one
        - in lossless mode libwebp reads quality as compression effort, not fidelity,
          so the pixels are identical at any value
        """
        with Image.open(BytesIO(image_data)) as img:
            if max(img.size) > WEBP_MAX_DIMENSION:
                raise ValueError(
                    f"WebP supports at most {WEBP_MAX_DIMENSION}x{WEBP_MAX_DIMENSION} pixels, "
                    f"this image is {img.width}x{img.height}. Resize it to a smaller width first."
                )

            try:
                img = ImageOps.exif_transpose(img)
            except Exception:
                pass

            has_alpha = img.mode in ("RGBA", "LA", "PA") or (
                img.mode == "P" and "transparency" in img.info
            )
            target_mode = "RGBA" if has_alpha else "RGB"
            if img.mode != target_mode:
                img = img.convert(target_mode)

            buffer = BytesIO()
            if lossless:
                img.save(buffer, format="WEBP", lossless=True)
            else:
                img.save(buffer, format="WEBP", quality=quality)
            return buffer.getvalue()
