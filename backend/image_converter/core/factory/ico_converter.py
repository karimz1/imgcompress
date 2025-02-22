from typing import Dict
from io import BytesIO
import traceback
from PIL import Image

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

    def convert(self, image_data: bytes, source_path: str, dest_path: str) -> Result[Dict]:
        """
        Convert image_data to an ICO. Returns a Result[Dict].
        The dict typically has keys like { "source", "destination", "success", "error", ... }.
        """
        result_dict = {
            "source": source_path,
            "destination": dest_path,
            "success": True,
            "error": None,
            "is_successful": True,
        }

        try:
            with Image.open(BytesIO(image_data)) as img:
                if img.mode != "RGBA":
                    img = img.convert("RGBA")
                img.save(dest_path, format="ICO")
                self.logger.log(f"ICO saved to {dest_path}", "debug")

            return Result.success(result_dict)

        except Exception as e:
            tb = traceback.format_exc()
            msg = f"Failed to convert to ICO: {tb}"
            self.logger.log(msg, "error")

            result_dict["success"] = False
            result_dict["is_successful"] = False
            result_dict["error"] = str(e)

            return Result.failure(result_dict)
