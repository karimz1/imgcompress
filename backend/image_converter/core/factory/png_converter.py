from io import BytesIO

from PIL import Image, ImageOps

from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.interfaces.base_converter import BaseImageConverter, _is_rgb_icc_profile

# Pillow writes these as PNG. I;16B also works (it is re-saved as I;16).
# Other I;16* modes are normalized to I;16 below so 16-bit stays 16-bit.
PNG_MODES = ("1", "L", "LA", "I", "I;16", "I;16B", "P", "RGB", "RGBA")

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

            if img.mode.startswith("I;16") and img.mode not in PNG_MODES:
                # I;16L / I;16N cannot be written as PNG; keep the 16-bit values.
                img = img.convert("I;16")
            elif img.mode not in PNG_MODES:
                # e.g. CMYK JPEGs; their CMYK profile no longer matches RGB pixels
                img = img.convert("RGBA" if img.mode in ("PA", "La", "RGBa") else "RGB")
                if not _is_rgb_icc_profile(img.info.get("icc_profile")):
                    img.info.pop("icc_profile", None)

            buffer = BytesIO()
            img.save(buffer, "PNG")
            return buffer.getvalue()
