from typing import Optional, Dict, Type, Callable, Any
from backend.image_converter.core.factory.ico_converter import IcoConverter
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.core.factory.jpeg_converter import JpegConverter
from backend.image_converter.core.factory.png_converter import PngConverter
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
        
        match (image_format, use_rembg):
            case (ImageFormat.JPEG, _):
                return JpegConverter(quality=quality, logger=logger)
            
            case (ImageFormat.PNG, True):
                from backend.image_converter.core.factory.rembg_png_converter import RembgPngConverter
                return RembgPngConverter(logger=logger)
            
            case (ImageFormat.PNG, False):
                return PngConverter(logger=logger)
            
            case (ImageFormat.ICO, _):
                return IcoConverter(logger=logger)
            
            case _:
                raise ConversionError(f"Unsupported output format: {image_format.value}")
