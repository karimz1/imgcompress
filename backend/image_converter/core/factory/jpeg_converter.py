from typing import Dict
from PIL import Image
from io import BytesIO
from backend.image_converter.core.interfaces.iconverter import IImageConverter
from backend.image_converter.infrastructure.logger import Logger

class JpegConverter(IImageConverter):
    """Converts raw image bytes -> final JPEG on disk, handling alpha."""

    def __init__(self, quality: int, logger: Logger):
        self.quality = quality
        self.logger = logger

    def convert(self, image_data: bytes, source_path: str, dest_path: str) -> Dict:
        """
        1) Open the bytes with Pillow.
        2) Composite alpha over white if needed.
        3) Save as JPEG (with 'quality').
        4) Return a dict about success/fail status.
        """
        result = {
            "source": source_path,
            "destination": dest_path,
            "is_successful": True,
            "error": None
        }

        try:
            with Image.open(BytesIO(image_data)) as img:
                # Composite alpha over white if RGBA or LA
                if img.mode in ("RGBA", "LA"):
                    background = Image.new("RGB", img.size, (255, 255, 255))
                    alpha = img.split()[-1]
                    background.paste(img, mask=alpha)
                    img = background

                # Save final image as JPEG
                img.save(dest_path, "JPEG", quality=self.quality)
                self.logger.log(f"Saved JPEG: {dest_path} (Quality={self.quality})", "debug")
        except Exception as e:
            self.logger.log(f"Failed to convert to JPEG: {e}", "error")
            result["is_successful"] = False
            result["error"] = str(e)

        return result
