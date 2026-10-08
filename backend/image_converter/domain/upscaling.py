"""What "upscale" means for one image: the requested target and the resulting size.

Kept free of any AI or Pillow code so the size rules can be tested on their own
and shared by the web form, the CLI, and the upscaler.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional

from backend.image_converter.core.internals.utilities import Result

# The bundled model always enlarges by exactly this factor. Smaller factors are
# reached by resizing the model output down with Lanczos; anything above it
# (e.g. a tiny image to 4K) gets the remaining enlargement from Lanczos too.
MODEL_SCALE = 4


class UpscaleTarget(Enum):
    """
    ``X2`` / ``X4`` multiply both sides. ``FULL_HD`` / ``UHD_4K`` scale until the
    image fits a 1920x1080 / 3840x2160 frame, matched to the image's orientation
    (a portrait image fits 1080x1920 / 2160x3840), keeping the aspect ratio.
    """

    X2 = "2x"
    X4 = "4x"
    FULL_HD = "1080p"
    UHD_4K = "4k"

    @classmethod
    def from_string_result(cls, value: Optional[str]) -> Result[Optional["UpscaleTarget"]]:
        """Blank or missing means upscaling is off and yields None."""
        if value is None or not value.strip():
            return Result.success(None)
        try:
            return Result.success(cls(value.strip().lower()))
        except ValueError:
            options = ", ".join(member.value for member in cls)
            return Result.failure(f"Unsupported upscale option: '{value}'. Use one of: {options}.")


_FRAMES = {
    UpscaleTarget.FULL_HD: (1920, 1080),
    UpscaleTarget.UHD_4K: (3840, 2160),
}


@dataclass(frozen=True)
class UpscalePlan:
    source_size: tuple[int, int]
    output_size: tuple[int, int]

    @property
    def is_noop(self) -> bool:
        """The image already meets the target, so it is passed through unchanged."""
        return self.output_size == self.source_size


def plan_upscale(width: int, height: int, target: UpscaleTarget, max_output_pixels: int) -> Result[UpscalePlan]:
    """
    Works out the output size for ``target`` and refuses sizes above
    ``max_output_pixels``, which bounds memory no matter what is uploaded.
    Images that already meet a frame target are left as they are (never shrunk).
    """
    if width <= 0 or height <= 0:
        return Result.failure("Image has no pixels to upscale.")

    scale = _scale_for(width, height, target)
    if scale <= 1.0:
        return Result.success(UpscalePlan((width, height), (width, height)))

    output = (max(width, round(width * scale)), max(height, round(height * scale)))
    output_pixels = output[0] * output[1]
    if output_pixels > max_output_pixels:
        return Result.failure(
            f"Upscaling {width}x{height} to {output[0]}x{output[1]} would create a "
            f"{output_pixels / 1_000_000:.1f} MP image, above the {max_output_pixels / 1_000_000:.0f} MP limit. "
            "Pick a smaller upscale option or start from a smaller image."
        )
    return Result.success(UpscalePlan((width, height), output))


def _scale_for(width: int, height: int, target: UpscaleTarget) -> float:
    if target == UpscaleTarget.X2:
        return 2.0
    if target == UpscaleTarget.X4:
        return float(MODEL_SCALE)
    frame_long, frame_short = _FRAMES[target]
    long_side, short_side = max(width, height), min(width, height)
    return min(frame_long / long_side, frame_short / short_side)
