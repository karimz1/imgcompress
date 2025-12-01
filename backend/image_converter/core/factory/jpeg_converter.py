from typing import Dict
from io import BytesIO
from PIL import Image, ImageFile, ImageOps
import traceback

from backend.image_converter.application.dtos import ConversionDetails
from backend.image_converter.core.internals.utls import Result
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.interfaces.iconverter import IImageConverter

ImageFile.LOAD_TRUNCATED_IMAGES = True


def _normalize_for_jpeg(img: Image.Image) -> Image.Image:
    """
    Ensure deterministic, JPEG-safe pixel data:
    - apply EXIF orientation
    - flatten alpha onto white
    - convert to RGB (handles P/CMYK/L/etc.)
    """
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass

    if img.mode in ("RGBA", "LA"):
        # composite over white
        background = Image.new("RGB", img.size, (255, 255, 255))
        alpha = img.getchannel("A")
        background.paste(img.convert("RGB"), mask=alpha)
        img = background
    elif img.mode not in ("RGB",):
        # Convert everything else to RGB
        img = img.convert("RGB")

    return img


class JpegConverter(IImageConverter):
    """
    Converts raw image bytes to JPEG.
    - Provides encode_bytes() for in-memory size search.
    - convert() reuses encode_bytes() and writes to dest_path.
    """

    def __init__(self, quality: int, logger: Logger):
        self.quality = int(quality)
        self.logger = logger

    def encode_bytes(self, image_data: bytes) -> bytes:
        """
        Encode to JPEG fully in memory and return the encoded bytes.
        This is what your size-targeting binary search calls repeatedly.
        """
        with Image.open(BytesIO(image_data)) as img:
            img = _normalize_for_jpeg(img)

            out = BytesIO()
            img.save(
                out,
                format="JPEG",
                quality=self.quality,
                optimize=True,
                progressive=True,
                subsampling="4:2:0",
            )
            return out.getvalue()

    def convert(self, image_data: bytes, source_path: str, dest_path: str) -> Result[ConversionDetails]:
        """Convert bytes to JPEG on disk and return typed details."""
        try:
            data = self.encode_bytes(image_data)
            with open(dest_path, "wb") as f:
                f.write(data)

            self.logger.log(f"Saved JPEG: {dest_path} (quality={self.quality}, bytes={len(data)})", "debug")
            details = ConversionDetails(
                source=source_path,
                destination=dest_path,
                bytes_written=len(data),
            )
            return Result.success(details)
        except Exception:
            tb = traceback.format_exc()
            self.logger.log(f"Failed to convert to JPEG: {tb}", "error")
            return Result.failure(tb)
