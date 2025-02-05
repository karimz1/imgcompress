from typing import Dict
from PIL import Image
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.iconverter import IImageConverter
from backend.image_converter.core.enums.conversion_error import ConversionError

class JpegConverter(IImageConverter):
    """Handles conversion to JPEG."""

    def __init__(self, quality: int, logger: Logger):
        self.quality = quality
        self.logger = logger

    def convert(self, 
                image: Image.Image, 
                source_path: str, 
                dest_path: str) -> Dict:
        result = {
            "source": source_path,
            "destination": dest_path,
            "is_successful": True,
            "error": None
        }

        try:
            # Composite any transparency over a white background
            if image.mode in ("RGBA", "LA"):
                background = Image.new("RGB", image.size, (255, 255, 255))
                alpha = image.split()[-1]
                background.paste(image, mask=alpha)
                image = background

            image.save(dest_path, "JPEG", quality=self.quality)

            self.logger.log(f"Saved JPEG: {dest_path} (Quality={self.quality})", "debug")
        except Exception as e:
            self.logger.log(f"Failed to convert to JPEG: {e}", "error")
            result["is_successful"] = False
            result["error"] = str(e)

        return result
