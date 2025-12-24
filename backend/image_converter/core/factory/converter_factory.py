from typing import Optional
from backend.image_converter.core.factory.ico_converter import IcoConverter
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.core.factory.jpeg_converter import JpegConverter
from backend.image_converter.core.factory.png_converter import PngConverter
from backend.image_converter.core.factory.rembg_png_converter import RembgPngConverter
from ..interfaces.iconverter import IImageConverter
from backend.image_converter.core.exceptions import ConversionError

class ImageConverterFactory:
    """Factory to produce the correct converter instance based on the desired ImageFormat."""

    @staticmethod
    def create_converter(
        image_format: ImageFormat,
        quality: int,
        logger: Logger,
        use_rembg: bool = False
    ) -> IImageConverter:
        if image_format == ImageFormat.JPEG:
            return JpegConverter(quality=quality, logger=logger)
        elif image_format == ImageFormat.PNG:
            if use_rembg:
                return RembgPngConverter(logger=logger)
            return PngConverter(logger=logger)
        elif image_format == ImageFormat.ICO:
            return IcoConverter(logger=logger)
        else:
            raise ConversionError(f"Unsupported output format: {image_format.value}")
