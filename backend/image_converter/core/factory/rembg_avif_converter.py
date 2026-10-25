from typing import Optional

from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.internals.rembg_config import load_rembg_model_name
from backend.image_converter.core.internals.rembg_session import get_rembg_session
from backend.image_converter.core.interfaces.base_converter import BaseImageConverter

class RembgAvifConverter(BaseImageConverter):
    """
    Converts raw image bytes to an AVIF with background removed using rembg.
    """

    removes_background = True

    def __init__(self, quality: int, logger: Logger, model_name: Optional[str] = None):
        super().__init__(logger)
        self.quality = quality
        self.model_name = model_name or load_rembg_model_name()

    def _get_background_removal_session(self):
        return get_rembg_session(self.model_name)

    def encode_to_bytes(self, image_data: bytes) -> bytes:
        from rembg import remove
        raw_output = remove(
            image_data,
            session=self._get_background_removal_session(),
            post_process_mask=True,
            alpha_matting=False,
        )
        
        return self._encode_to_avif(raw_output, self.quality)
