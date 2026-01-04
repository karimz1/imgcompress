from io import BytesIO
from typing import Optional
from PIL import Image

from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.internals.rembg_config import load_rembg_model_name
from backend.image_converter.core.interfaces.base_converter import BaseImageConverter

class RembgAvifConverter(BaseImageConverter):
    """
    Converts raw image bytes to an AVIF with background removed using rembg.
    """

    def __init__(self, quality: int, logger: Logger, model_name: Optional[str] = None):
        super().__init__(logger)
        self.quality = quality
        self.model_name = model_name or load_rembg_model_name()
        self._session: Optional[object] = None

    def _get_background_removal_session(self):
        if self._session is None:
            from rembg import new_session
            self._session = new_session(self.model_name)
        return self._session

    def encode_to_bytes(self, image_data: bytes) -> bytes:
        from rembg import remove
        raw_output = remove(
            image_data,
            session=self._get_background_removal_session(),
            post_process_mask=True,
            alpha_matting=False,
        )
        
        return self._encode_to_avif(raw_output, self.quality)
