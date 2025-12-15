from io import BytesIO
from typing import Optional

try:
    from psd_tools import PSDImage
except ImportError:  # pragma: no cover - optional dependency resolution happens at runtime
    PSDImage = None

from backend.image_converter.core.internals.utls import Result


class PsdRenderer:
    """
    Converts PSD byte payloads into flattened raster images.
    """

    def __init__(self, logger):
        self.logger = logger

    def render(self, source_name: str, data: bytes) -> Result[bytes]:
        if PSDImage is None:
            return Result.failure("psd-tools is not installed; cannot process PSD files.")
        try:
            psd = PSDImage.open(BytesIO(data))
            flattened = psd.composite()
            if flattened is None:
                raise ValueError(f"{source_name}: PSD contains no composite data")

            if flattened.mode not in ("RGB", "RGBA", "L", "LA"):
                if "A" in flattened.getbands():
                    flattened = flattened.convert("RGBA")
                else:
                    flattened = flattened.convert("RGB")

            buffer = BytesIO()
            flattened.save(buffer, format="PNG")
            return Result.success(buffer.getvalue())
        except Exception as exc:
            self.logger.log(f"Failed to render PSD '{source_name}': {exc}", "error")
            return Result.failure(str(exc))
