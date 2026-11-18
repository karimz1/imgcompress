from io import BytesIO

from PIL import Image, ImageOps

from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.interfaces.base_converter import BaseImageConverter, _is_rgb_icc_profile

PNG_MODES = ("1", "L", "LA", "I", "I;16", "P", "RGB", "RGBA")

class PngConverter(BaseImageConverter):
    """Converts raw image bytes to a PNG file on disk, preserving the alpha channel."""

    def __init__(self, logger: Logger):
        super().__init__(logger)

    def encode_to_bytes(self, image_data: bytes) -> bytes:
        with Image.open(BytesIO(image_data)) as img:
            try:
                img = ImageOps.exif_transpose(img)
            except Exception:
                pass

            if img.mode not in PNG_MODES:
                # e.g. CMYK JPEGs; their CMYK profile no longer matches RGB pixels
                img = img.convert("RGBA" if img.mode in ("PA", "La", "RGBa") else "RGB")
                if not _is_rgb_icc_profile(img.info.get("icc_profile")):
                    img.info.pop("icc_profile", None)

            buffer = BytesIO()
            img.save(buffer, "PNG")
            return buffer.getvalue()
