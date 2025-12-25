from io import BytesIO
import traceback
from typing import Optional

from PIL import Image
from rembg import remove, new_session

from backend.image_converter.application.dtos import ConversionDetails
from backend.image_converter.core.internals.utls import Result
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.interfaces.iconverter import IImageConverter
from backend.image_converter.core.internals.rembg_config import load_rembg_model_name


class RembgPngConverter(IImageConverter):
    """
    Converts raw image bytes to a PNG with background removed using rembg.
    """

    def __init__(self, logger: Logger, model_name: Optional[str] = None):
        self.logger = logger
        self.model_name = model_name or load_rembg_model_name()
        self._session: Optional[object] = None


    def _get_session(self):
        if self._session is None:
            self._session = new_session(self.model_name)
        return self._session


    def encode_bytes(self, image_data: bytes) -> bytes:
        return remove(
            image_data,
            session=self._get_session(),
            post_process_mask=True,
            alpha_matting=False,
        )


    def _sanitize(self, image_data: bytes) -> bytes:
        """
        Normalizes the image bytes using Pillow to ensure metadata 
        is stripped and the PNG structure is standard.
        """
        with Image.open(BytesIO(image_data)) as img:
            buffer = BytesIO()
            img.save(buffer, format="PNG")
            return buffer.getvalue()


    def convert(self, image_data: bytes, source_path: str, dest_path: str) -> Result[ConversionDetails]:
        try:
            raw_output = self.encode_bytes(image_data)
            sanitized_output = self._sanitize(raw_output)

            with open(dest_path, "wb") as f:
                f.write(sanitized_output)

            with Image.open(BytesIO(sanitized_output)) as img:
                mode = img.mode

            self.logger.log(
                f"Saved PNG (rembg): {dest_path} (mode={mode}, bytes={len(sanitized_output)})",
                "debug",
            )
            details = ConversionDetails(
                source=source_path,
                destination=dest_path,
                bytes_written=len(sanitized_output),
            )
            return Result.success(details)
        except Exception:
            tb = traceback.format_exc()
            self.logger.log(f"Failed to convert to PNG (rembg): {tb}", "error")
            return Result.failure(tb)