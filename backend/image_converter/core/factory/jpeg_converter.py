from typing import Dict
from PIL import Image
from io import BytesIO
import traceback

from backend.image_converter.core.internals.utls import Result
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.interfaces.iconverter import IImageConverter

class JpegConverter(IImageConverter):
    """Converts raw image bytes to a JPEG file on disk, compositing alpha over white if needed."""

    def __init__(self, quality: int, logger: Logger):
        self.quality = quality
        self.logger = logger

    def convert(self, image_data: bytes, source_path: str, dest_path: str) -> Result[Dict]:
        result_dict = {
            "source": source_path,
            "destination": dest_path,
            "is_successful": True,                             
            "error": None,
        }
        """
        Converts image data to JPEG format and writes it to disk.

        Returns:
            Result.success: with a dictionary containing details if conversion is successful.
            Result.failure: with a traceback string if an error occurs.
        """
        try:
                                        
            with Image.open(BytesIO(image_data)) as img:
                                                                                          
                if img.mode in ("RGBA", "LA"):
                    background = Image.new("RGB", img.size, (255, 255, 255))
                    alpha = img.split()[-1]
                    background.paste(img, mask=alpha)
                    img = background

                                            
                img.save(dest_path, "JPEG", quality=self.quality)
                self.logger.log(f"Saved JPEG: {dest_path} (Quality={self.quality})", "debug")
            
                                                            
            return Result.success(result_dict)
        except Exception as e:
            tb = traceback.format_exc()
            self.logger.log(f"Failed to convert to JPEG: {tb}", "error")
                                                              
            result_dict["is_successful"] = False
            result_dict["error"] = tb
            return Result.failure(result_dict)
        