import json
import math
from dataclasses import dataclass, field, replace
from enum import Enum
from typing import Any, Optional

from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.domain.fit_layers import Layer, parse_layers
from backend.image_converter.domain.gradient import (
    DEFAULT_GRADIENT_ANGLE,
    normalize_gradient_angle,
)
from backend.image_converter.domain.text_overlay import MAX_TEXT_LENGTH, TextSpec

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

# Blur strength of the background, 0 (sharp) to 1. The blur mode default is the
# look it always had; a background picture starts sharp.
DEFAULT_BLUR_STRENGTH = 0.25
DEFAULT_TINT_COLOR = "#000000"

# The background picture can be moved, zoomed and turned in the editor. Its
# scale is relative to the size that just covers the canvas (1 = the default).
MIN_BACKGROUND_SCALE = 0.1
MAX_BACKGROUND_SCALE = 10.0

# The text settings arrive as one small JSON object; anything longer than this
# is not a real request.
MAX_TEXT_JSON_LENGTH = 4096


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
    # Clockwise degrees about the image centre, -180 (exclusive) to 180.
    rotation: float = 0.0


@dataclass(frozen=True)
class FitBackground:
    """
    Extras for the area around the image. ``pattern`` is drawn in a tint of
    the solid colour, ``dim`` darkens blur, solid and image backgrounds, and
    ``image`` is the decoded background picture for FitMode.IMAGE. The image
    lives only in memory for one request; it is never written to disk.
    ``blur`` is the blur strength (None = the mode's default) and ``tint``
    lays ``tint_color`` at that opacity over the background.
    ``image_placement`` moves, zooms and turns the picture; None keeps it
    centred and just covering the canvas.
    ``color_to`` turns the solid fill into a linear gradient from the fit
    colour, and ``tint_color_to`` does the same for the tint; the angles
    follow CSS linear-gradient (180 = top to bottom).
    """

    pattern: FitPattern = FitPattern.NONE
    dim: float = 0.0
    image: Optional[Any] = field(default=None, compare=False, repr=False)
    blur: Optional[float] = None
    tint: float = 0.0
    tint_color: str = DEFAULT_TINT_COLOR
    image_placement: Optional[FitPlacement] = None
    color_to: Optional[str] = None
    gradient_angle: float = DEFAULT_GRADIENT_ANGLE
    tint_color_to: Optional[str] = None
    tint_angle: float = DEFAULT_GRADIENT_ANGLE

    @property
    def is_plain(self) -> bool:
        return (
            self.pattern == FitPattern.NONE
            and self.dim == 0
            and self.image is None
            and self.blur is None
            and self.tint == 0
            and self.image_placement is None
            and self.color_to is None
        )

    def blur_for(self, mode: "FitMode") -> float:
        """Blur strength used for ``mode``; 0 means no blur."""
        if self.blur is not None:
            return self.blur
        return DEFAULT_BLUR_STRENGTH if mode == FitMode.BLUR else 0.0


# Modes that keep the whole image and can therefore place it freely.
PLACEABLE_FIT_MODES = frozenset(
    {FitMode.BLUR, FitMode.SOLID, FitMode.TRANSPARENT, FitMode.IMAGE}
)
DIMMABLE_FIT_MODES = frozenset({FitMode.BLUR, FitMode.SOLID, FitMode.IMAGE})
BLURRABLE_FIT_MODES = frozenset({FitMode.BLUR, FitMode.IMAGE})


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
    # Text drawn on top of the finished canvas, in any mode.
    text: Optional[TextSpec] = None
    # Texts and pictures above the image, bottom first, in any mode.
    layers: tuple[Layer, ...] = ()

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
        blur: Optional[str] = None,
        tint: Optional[str] = None,
        tint_color: Optional[str] = None,
        rotation: Optional[str] = None,
        bg_scale: Optional[str] = None,
        bg_x: Optional[str] = None,
        bg_y: Optional[str] = None,
        bg_rotation: Optional[str] = None,
        text: Optional[str] = None,
        color_to: Optional[str] = None,
        gradient_angle: Optional[str] = None,
        tint_color_to: Optional[str] = None,
        tint_angle: Optional[str] = None,
        layers: Optional[str] = None,
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
        rotation_res = _parse_angle(rotation, "rotation")
        if not rotation_res.is_successful:
            return Result.failure(rotation_res.error)
        if rotation_res.value != 0:
            placement = replace(placement or FitPlacement(), rotation=rotation_res.value)
        # Fill frame takes a tilt only; the picture always covers the frame.
        tilt_only = placement_res.value is None and mode_res.value == FitMode.CROP
        if placement is not None and mode_res.value not in PLACEABLE_FIT_MODES and not tilt_only:
            return Result.failure(
                "Fit scale and position need fit mode blur, solid, transparent or image."
            )

        background_res = _parse_background(
            mode_res.value, pattern, dim, blur=blur, tint=tint, tint_color=tint_color
        )
        if not background_res.is_successful:
            return Result.failure(background_res.error)
        background = background_res.value

        gradient_res = _parse_gradients(
            mode_res.value, background, color_to, gradient_angle, tint_color_to, tint_angle
        )
        if not gradient_res.is_successful:
            return Result.failure(gradient_res.error)
        background = gradient_res.value
        if background.color_to and len(color_res.value) != 7:
            return Result.failure("A gradient fill needs an opaque start colour like #3366ff.")

        image_placement_res = _parse_background_placement(
            mode_res.value, bg_scale, bg_x, bg_y, bg_rotation
        )
        if not image_placement_res.is_successful:
            return Result.failure(image_placement_res.error)
        if image_placement_res.value is not None:
            background = replace(background, image_placement=image_placement_res.value)

        text_res = _parse_text(text)
        if not text_res.is_successful:
            return Result.failure(text_res.error)

        layers_res = parse_layers(layers)
        if not layers_res.is_successful:
            return Result.failure(layers_res.error)

        fit_width, fit_height = size_res.value
        return Result.success(
            cls(
                fit_width,
                fit_height,
                mode_res.value,
                anchor_res.value,
                color_res.value,
                placement,
                background,
                text_res.value,
                layers_res.value,
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


def _parse_finite(value: str, label: str) -> Result[float]:
    """A finite number. Words, NaN and infinity are refused."""
    try:
        parsed = float(value)
    except ValueError:
        return Result.failure(f"Fit {label} must be a number, got '{value}'.")
    if not math.isfinite(parsed):
        return Result.failure(f"Fit {label} must be a number, got '{value}'.")
    return Result.success(parsed)


def _parse_clamped(value: str, label: str, low: float = 0.0, high: float = 1.0) -> Result[float]:
    """A number, pulled into low..high. Words, NaN and infinity are refused."""
    parsed = _parse_finite(value, label)
    if not parsed.is_successful:
        return parsed
    return Result.success(min(high, max(low, parsed.value)))


def _parse_angle(value: Optional[str], label: str) -> Result[float]:
    """Degrees, folded into -180 (exclusive) to 180. Blank means 0."""
    value = (value or "").strip()
    if not value:
        return Result.success(0.0)
    parsed = _parse_finite(value, label)
    if not parsed.is_successful:
        return parsed
    angle = math.fmod(parsed.value, 360.0)
    if angle > 180:
        angle -= 360
    elif angle <= -180:
        angle += 360
    # Six decimals are plenty and keep 359.9999999 from turning into noise.
    return Result.success(round(angle, 6) + 0.0)


def _parse_background_placement(
    mode: FitMode,
    scale: Optional[str],
    x: Optional[str],
    y: Optional[str],
    rotation: Optional[str],
) -> Result[Optional[FitPlacement]]:
    """Where the background picture sits. All blank or all default yields None."""
    values = [(v or "").strip() for v in (scale, x, y, rotation)]
    if not any(values):
        return Result.success(None)
    if mode != FitMode.IMAGE:
        return Result.failure("Moving or turning the background needs fit mode image.")
    parsed = []
    for value, label, low, high, default in (
        (values[0], "background scale", MIN_BACKGROUND_SCALE, MAX_BACKGROUND_SCALE, 1.0),
        (values[1], "background x position", MIN_PLACEMENT_POSITION, MAX_PLACEMENT_POSITION, 0.5),
        (values[2], "background y position", MIN_PLACEMENT_POSITION, MAX_PLACEMENT_POSITION, 0.5),
    ):
        if not value:
            parsed.append(default)
            continue
        res = _parse_clamped(value, label, low, high)
        if not res.is_successful:
            return Result.failure(res.error)
        parsed.append(res.value)
    angle_res = _parse_angle(values[3], "background rotation")
    if not angle_res.is_successful:
        return Result.failure(angle_res.error)
    placement = FitPlacement(parsed[0], parsed[1], parsed[2], angle_res.value)
    return Result.success(None if placement == FitPlacement() else placement)


def _parse_text(value: Optional[str]) -> Result[Optional[TextSpec]]:
    """The text overlay as a JSON object. Blank, empty text or opacity 0 yield None."""
    value = (value or "").strip()
    if not value:
        return Result.success(None)
    if len(value) > MAX_TEXT_JSON_LENGTH:
        return Result.failure("The text settings are too long.")
    try:
        data = json.loads(value)
    except ValueError:
        return Result.failure("The text settings must be a JSON object.")
    if not isinstance(data, dict):
        return Result.failure("The text settings must be a JSON object.")
    if len(str(data.get("text") or "")) > MAX_TEXT_LENGTH:
        return Result.failure(f"The text can have at most {MAX_TEXT_LENGTH} characters.")
    spec_res = TextSpec.from_dict_result(data)
    if not spec_res.is_successful:
        return Result.failure(spec_res.error)
    return Result.success(spec_res.value if spec_res.value.is_visible else None)


def _parse_opaque_color(value: str, label: str) -> Result[str]:
    color_res = _parse_color(value)
    if not color_res.is_successful or len(color_res.value) != 7:
        return Result.failure(
            f"Invalid {label}: '{value}'. Expected an opaque hex colour like #3366ff."
        )
    return Result.success(color_res.value)


def _parse_gradient_angle(value: Optional[str], label: str) -> Result[float]:
    value = (value or "").strip()
    if not value:
        return Result.success(DEFAULT_GRADIENT_ANGLE)
    res = _parse_finite(value, label)
    if not res.is_successful:
        return Result.failure(res.error)
    return Result.success(normalize_gradient_angle(res.value))


def _parse_gradients(
    mode: FitMode,
    background: FitBackground,
    color_to: Optional[str],
    gradient_angle: Optional[str],
    tint_color_to: Optional[str],
    tint_angle: Optional[str],
) -> Result[FitBackground]:
    """Second colours make the fill and the tint gradients; blank keeps them plain."""
    fill_angle = _parse_gradient_angle(gradient_angle, "gradient angle")
    if not fill_angle.is_successful:
        return Result.failure(fill_angle.error)
    tint_angle_res = _parse_gradient_angle(tint_angle, "tint angle")
    if not tint_angle_res.is_successful:
        return Result.failure(tint_angle_res.error)

    color_to = (color_to or "").strip()
    parsed_color_to = None
    if color_to:
        if mode != FitMode.SOLID:
            return Result.failure("A gradient fill needs fit mode solid.")
        res = _parse_opaque_color(color_to, "gradient colour")
        if not res.is_successful:
            return Result.failure(res.error)
        parsed_color_to = res.value

    tint_color_to = (tint_color_to or "").strip()
    parsed_tint_to = None
    if tint_color_to and background.tint > 0:
        res = _parse_opaque_color(tint_color_to, "tint gradient colour")
        if not res.is_successful:
            return Result.failure(res.error)
        parsed_tint_to = res.value

    return Result.success(
        replace(
            background,
            color_to=parsed_color_to,
            gradient_angle=fill_angle.value if parsed_color_to else DEFAULT_GRADIENT_ANGLE,
            tint_color_to=parsed_tint_to,
            tint_angle=tint_angle_res.value if parsed_tint_to else DEFAULT_GRADIENT_ANGLE,
        )
    )


def _parse_background(
    mode: FitMode,
    pattern: Optional[str],
    dim: Optional[str],
    *,
    blur: Optional[str] = None,
    tint: Optional[str] = None,
    tint_color: Optional[str] = None,
) -> Result[FitBackground]:
    """Blank values mean no pattern, no dimming, the default blur and no tint."""
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

    parsed_blur = None
    blur = (blur or "").strip()
    if blur:
        if mode not in BLURRABLE_FIT_MODES:
            return Result.failure("A blur strength needs fit mode blur or image.")
        blur_res = _parse_clamped(blur, "blur")
        if not blur_res.is_successful:
            return Result.failure(blur_res.error)
        # The mode's own default is stored as None, so it renders exactly as
        # before the slider existed.
        if blur_res.value != FitBackground().blur_for(mode):
            parsed_blur = blur_res.value

    parsed_tint = 0.0
    parsed_tint_color = DEFAULT_TINT_COLOR
    tint = (tint or "").strip()
    if tint:
        tint_res = _parse_clamped(tint, "tint")
        if not tint_res.is_successful:
            return Result.failure(tint_res.error)
        parsed_tint = tint_res.value
    tint_color = (tint_color or "").strip()
    if tint_color:
        color_res = _parse_color(tint_color)
        if not color_res.is_successful or len(color_res.value) != 7:
            return Result.failure(
                f"Invalid tint color: '{tint_color}'. Expected an opaque hex colour like #3366ff."
            )
        parsed_tint_color = color_res.value
    if parsed_tint > 0 and mode not in DIMMABLE_FIT_MODES:
        return Result.failure("A tint needs fit mode blur, solid or image.")
    if parsed_tint == 0:
        parsed_tint_color = DEFAULT_TINT_COLOR

    return Result.success(
        FitBackground(
            pattern_res.value,
            parsed_dim,
            blur=parsed_blur,
            tint=parsed_tint,
            tint_color=parsed_tint_color,
        )
    )
