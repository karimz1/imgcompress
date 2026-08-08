from typing import Optional

from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.internals.rembg_config import load_default_rembg_model
from backend.image_converter.core.internals.rembg_runtime import remove_background
from backend.image_converter.core.interfaces.base_converter import BaseImageConverter

class RembgPngConverter(BaseImageConverter):
    """
    Converts raw image bytes to a PNG with background removed using rembg.
    """

    removes_background = True

    def __init__(self, logger: Logger, model_name: Optional[str] = None):
        super().__init__(logger)
        self.model_name = model_name or load_default_rembg_model()

    def encode_to_bytes(self, image_data: bytes) -> bytes:
        raw_output = remove_background(
            image_data,
            self.model_name,
            post_process_mask=True,
            alpha_matting=False,
        )
        return self.strip_metadata_and_normalize(raw_output, output_format="PNG")
