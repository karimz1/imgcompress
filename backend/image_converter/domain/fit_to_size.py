import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

from backend.image_converter.core.internals.utilities import Result

# Largest width or height a fitted image may have. 8192 covers 8K and every
# social-media preset with room to spare, and keeps a single RGBA canvas under
# 256 MiB so a crafted request cannot exhaust container memory.
MAX_FIT_DIMENSION = 8192

# Manual placement limits. The scale is relative to the size at which the whole
# image just fits the target, so 1 is the default "contain" size. The position
# is the centre of the image as a share of the target size; values outside 0..1
# move it partly off the canvas.
MIN_PLACEMENT_SCALE = 0.01
MAX_PLACEMENT_SCALE = 20.0
MIN_PLACEMENT_POSITION = -1.0
MAX_PLACEMENT_POSITION = 2.0

# Darkening of the background behind the image, as a share of black laid over
# it. Capped below 1 so the background never turns fully black by accident.
MAX_BACKGROUND_DIM = 0.9


class FitMode(Enum):
    CROP = "crop"
    BLUR = "blur"
    SOLID = "solid"
    TRANSPARENT = "transparent"
    # A background picture uploaded in the editor. Only the web editor can
    # send one, so the CLI and /api/compress do not offer it.
    IMAGE = "image"

    @classmethod
    def default(cls) -> "FitMode":
        return cls.CROP


class FitPattern(Enum):
    """Simple pattern drawn over a solid background colour."""

    NONE = "none"
    CHECKER = "checker"
    DOTS = "dots"
    STRIPES = "stripes"
    GRID = "grid"

    @classmethod
    def default(cls) -> "FitPattern":
        return cls.NONE


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
class FitPlacement:
    """
    Where the whole image sits on the target canvas, independent of its pixel size.

    ``scale`` 1 is the largest size at which the image still fits completely;
    ``x`` and ``y`` are the image centre as a share of the target width and
    height (0.5, 0.5 is centred). Being relative, the same placement renders
    the scaled editor preview and the full-size export identically.
    """

    scale: float = 1.0
    x: float = 0.5
    y: float = 0.5


@dataclass(frozen=True)
class FitBackground:
    """
    Extras for the area around the image. ``pattern`` is drawn in a tint of
    the solid colour, ``dim`` darkens blur, solid and image backgrounds, and
    ``image`` is the decoded background picture for FitMode.IMAGE. The image
    lives only in memory for one request; it is never written to disk.
    """

    pattern: FitPattern = FitPattern.NONE
    dim: float = 0.0
    image: Optional[Any] = field(default=None, compare=False, repr=False)

    @property
    def is_plain(self) -> bool:
        return self.pattern == FitPattern.NONE and self.dim == 0 and self.image is None


# Modes that keep the whole image and can therefore place it freely.
PLACEABLE_FIT_MODES = frozenset(
    {FitMode.BLUR, FitMode.SOLID, FitMode.TRANSPARENT, FitMode.IMAGE}
)
DIMMABLE_FIT_MODES = frozenset({FitMode.BLUR, FitMode.SOLID, FitMode.IMAGE})


@dataclass(frozen=True)
class FitToSize:
    """Exact output size, plus how to get the image there when the aspect ratio differs."""

    width: int
    height: int
    mode: FitMode = FitMode.CROP
    anchor: FitAnchor = FitAnchor.AUTO
    color: str = "#ffffff"
    placement: Optional[FitPlacement] = None
    background: FitBackground = FitBackground()

    @classmethod
    def from_strings_result(
        cls,
        width: Optional[str],
        height: Optional[str],
        mode: Optional[str] = None,
        anchor: Optional[str] = None,
        color: Optional[str] = None,
        scale: Optional[str] = None,
        x: Optional[str] = None,
        y: Optional[str] = None,
        *,
        pattern: Optional[str] = None,
        dim: Optional[str] = None,
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

        color_res = _parse_color(color)
        if not color_res.is_successful:
            return Result.failure(color_res.error)

        placement_res = _parse_placement(scale, x, y)
        if not placement_res.is_successful:
            return Result.failure(placement_res.error)
        placement = placement_res.value
        if placement is not None and mode_res.value not in PLACEABLE_FIT_MODES:
            return Result.failure(
                "Fit scale and position need fit mode blur, solid, transparent or image."
            )

        background_res = _parse_background(mode_res.value, pattern, dim)
        if not background_res.is_successful:
            return Result.failure(background_res.error)

        fit_width, fit_height = size_res.value
        return Result.success(
            cls(
                fit_width,
                fit_height,
                mode_res.value,
                anchor_res.value,
                color_res.value,
                placement,
                background_res.value,
            )
        )


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


def _parse_color(value: Optional[str]) -> Result[str]:
    if value is None or not value.strip():
        return Result.success("#ffffff")
    val = value.strip().lower()
    if val == "transparent":
        return Result.success("transparent")
    cleaned = val if val.startswith("#") else f"#{val}"
    hex_digits = cleaned[1:]
    if len(hex_digits) in (3, 4, 6, 8) and all(c in "0123456789abcdef" for c in hex_digits):
        if len(hex_digits) == 3:
            cleaned = "#" + "".join(c * 2 for c in hex_digits)
        elif len(hex_digits) == 4:
            cleaned = "#" + "".join(c * 2 for c in hex_digits)
        return Result.success(cleaned)
    return Result.failure(f"Invalid color format: '{value}'. Expected hex (e.g. #ffffff) or 'transparent'.")


def _parse_float(value: str, label: str, low: float, high: float) -> Result[float]:
    try:
        parsed = float(value)
    except ValueError:
        return Result.failure(f"Fit {label} must be a number, got '{value}'.")
    if not math.isfinite(parsed) or not low <= parsed <= high:
        return Result.failure(f"Fit {label} must be between {low:g} and {high:g}.")
    return Result.success(parsed)


def _parse_placement(
    scale: Optional[str], x: Optional[str], y: Optional[str]
) -> Result[Optional[FitPlacement]]:
    """Blank values mean automatic placement and yield None."""
    scale = (scale or "").strip()
    x = (x or "").strip()
    y = (y or "").strip()
    if not scale and not x and not y:
        return Result.success(None)
    if bool(x) != bool(y):
        return Result.failure("Fit position needs both x and y.")

    parsed_scale = 1.0
    if scale:
        scale_res = _parse_float(scale, "scale", MIN_PLACEMENT_SCALE, MAX_PLACEMENT_SCALE)
        if not scale_res.is_successful:
            return Result.failure(scale_res.error)
        parsed_scale = scale_res.value

    position = [0.5, 0.5]
    if x:
        for index, (value, label) in enumerate(((x, "x position"), (y, "y position"))):
            res = _parse_float(value, label, MIN_PLACEMENT_POSITION, MAX_PLACEMENT_POSITION)
            if not res.is_successful:
                return Result.failure(res.error)
            position[index] = res.value
    return Result.success(FitPlacement(parsed_scale, position[0], position[1]))


def _parse_background(
    mode: FitMode, pattern: Optional[str], dim: Optional[str]
) -> Result[FitBackground]:
    """Blank values mean no pattern and no dimming."""
    pattern_res = _parse_enum(FitPattern, pattern, "fit pattern")
    if not pattern_res.is_successful:
        return Result.failure(pattern_res.error)
    if pattern_res.value != FitPattern.NONE and mode != FitMode.SOLID:
        return Result.failure("A fit pattern needs fit mode solid.")

    parsed_dim = 0.0
    dim = (dim or "").strip()
    if dim:
        dim_res = _parse_float(dim, "dim", 0.0, MAX_BACKGROUND_DIM)
        if not dim_res.is_successful:
            return Result.failure(dim_res.error)
        parsed_dim = dim_res.value
    if parsed_dim > 0 and mode not in DIMMABLE_FIT_MODES:
        return Result.failure("Dimming the background needs fit mode blur, solid or image.")
    return Result.success(FitBackground(pattern_res.value, parsed_dim))
