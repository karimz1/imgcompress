from typing import Optional
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.enums.image_format import ImageFormat
from .jpeg_converter import JpegConverter
from .png_converter import PngConverter
from .iconverter import IImageConverter

class ImageConverterFactory:
    """Factory to produce the correct converter instance based on the desired ImageFormat."""

    @staticmethod
    def create_converter(
        image_format: ImageFormat,
        quality: int,
        logger: Logger
    ) -> IImageConverter:
        if image_format == ImageFormat.JPEG:
            return JpegConverter(quality=quality, logger=logger)
        elif image_format == ImageFormat.PNG:
            return PngConverter(logger=logger)
        else:
            raise ConversionError(f"Unsupported output format: {image_format.value}")
