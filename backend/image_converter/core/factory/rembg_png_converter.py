from io import BytesIO
import traceback
from typing import Optional

from PIL import Image

from backend.image_converter.application.dtos import ConversionDetails
from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.internals.rembg_config import load_rembg_model_name
from backend.image_converter.core.interfaces.base_converter import BaseImageConverter

class RembgPngConverter(BaseImageConverter):
    """
    Converts raw image bytes to a PNG with background removed using rembg.
    """

    def __init__(self, logger: Logger, model_name: Optional[str] = None):
        super().__init__(logger)
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
        return self.strip_metadata_and_normalize(raw_output, output_format="PNG")