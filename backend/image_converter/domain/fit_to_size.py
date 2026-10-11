from dataclasses import dataclass
from enum import Enum
from typing import Optional

from backend.image_converter.core.internals.utilities import Result

# Largest width or height a fitted image may have. 8192 covers 8K and every
# social-media preset with room to spare, and keeps a single RGBA canvas under
# 256 MiB so a crafted request cannot exhaust container memory.
MAX_FIT_DIMENSION = 8192


class FitMode(Enum):
    CROP = "crop"
    BLUR = "blur"

    @classmethod
    def default(cls) -> "FitMode":
        return cls.CROP


class FitAnchor(Enum):
    AUTO = "auto"
    CENTER = "center"
    TOP = "top"
    BOTTOM = "bottom"
    LEFT = "left"
    RIGHT = "right"

    @classmethod
    def default(cls) -> "FitAnchor":
        return cls.AUTO


@dataclass(frozen=True)
class FitToSize:
    """Exact output size, plus how to get the image there when the aspect ratio differs."""

    width: int
    height: int
    mode: FitMode = FitMode.CROP
    anchor: FitAnchor = FitAnchor.AUTO

    @classmethod
    def from_strings_result(
        cls,
        width: Optional[str],
        height: Optional[str],
        mode: Optional[str] = None,
        anchor: Optional[str] = None,
    ) -> Result[Optional["FitToSize"]]:
        """
        Parses the raw request values using the result pattern.
        Blank width and height mean the feature is off and yield None. Anything
        else must be a complete, valid size; nothing is silently corrected.
        """
        width = (width or "").strip()
        height = (height or "").strip()
        if not width and not height:
            return Result.success(None)
        if not width or not height:
            return Result.failure("Fit to size needs both a width and a height.")

        size_res = _parse_dimensions(width, height)
        if not size_res.is_successful:
            return Result.failure(size_res.error)

        mode_res = _parse_enum(FitMode, mode, "fit mode")
        if not mode_res.is_successful:
            return Result.failure(mode_res.error)

        anchor_res = _parse_enum(FitAnchor, anchor, "fit anchor")
        if not anchor_res.is_successful:
            return Result.failure(anchor_res.error)

        fit_width, fit_height = size_res.value
        return Result.success(cls(fit_width, fit_height, mode_res.value, anchor_res.value))


def _parse_dimensions(width: str, height: str) -> Result[tuple[int, int]]:
    try:
        parsed = (int(width), int(height))
    except ValueError:
        return Result.failure(f"Fit to size expects whole numbers, got '{width}' x '{height}'.")
    if not all(1 <= value <= MAX_FIT_DIMENSION for value in parsed):
        return Result.failure(
            f"Fit to size width and height must be between 1 and {MAX_FIT_DIMENSION} pixels."
        )
    return Result.success(parsed)


def _parse_enum(enum_type, value: Optional[str], label: str):
    if value is None or not value.strip():
        return Result.success(enum_type.default())
    try:
        return Result.success(enum_type(value.strip().lower()))
    except ValueError:
        return Result.failure(f"Unsupported {label}: '{value}'")
