"""The one list of conversion and editor options.

Each option is a multipart form field. The same entries decide the defaults
and limits the web UI form (/api) falls back to, the strict checks of the
public API (/api/v1), and the OpenAPI spec that documents them. The domain
(FitToSize, UpscaleTarget, PdfQuality, ...) still checks every value; this
list only describes them, so nothing is defined twice.
"""

from dataclasses import dataclass, field
from typing import Mapping, Optional, Tuple

from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.domain.fit_layers import MAX_IMAGE_LAYERS, MAX_TEXT_LAYERS
from backend.image_converter.domain.fit_to_size import (
    MAX_BACKGROUND_DIM,
    MAX_BACKGROUND_SCALE,
    MAX_FIT_DIMENSION,
    MAX_PLACEMENT_POSITION,
    MAX_PLACEMENT_SCALE,
    MIN_BACKGROUND_SCALE,
    MIN_PLACEMENT_POSITION,
    MIN_PLACEMENT_SCALE,
    FitAnchor,
    FitMode,
    FitPattern,
)
from backend.image_converter.domain.pdf_presets import PDF_PRESETS, PDF_SCALE_MODES
from backend.image_converter.domain.pdf_quality import PdfQuality
from backend.image_converter.domain.text_overlay import FONT_FILES, MAX_TEXT_LENGTH
from backend.image_converter.domain.upscaling import UpscaleModel, UpscaleTarget

INTEGER = "integer"
NUMBER = "number"
BOOLEAN = "boolean"
STRING = "string"

TRUE_VALUES = frozenset({"1", "true", "yes", "on"})
BOOLEAN_VALUES = TRUE_VALUES | frozenset({"0", "false", "no", "off"})


@dataclass(frozen=True)
class Option:
    name: str
    kind: str
    description: str
    default: object = None
    minimum: Optional[float] = None
    maximum: Optional[float] = None
    choices: Tuple[str, ...] = ()
    # Older field names that mean the same (the web UI still sends them).
    aliases: Tuple[str, ...] = ()
    # Checked strictly by the public API itself; the rest is left to the domain.
    strict: bool = True
    example: object = None
    repeated: bool = False
    extra: Mapping[str, object] = field(default_factory=dict)

    def raw(self, form) -> Optional[str]:
        """The value sent under the name or an alias, else None."""
        for key in (self.name, *self.aliases):
            value = form.get(key)
            if value is not None:
                return value
        return None


def _values(enum_type, skip=()) -> Tuple[str, ...]:
    return tuple(member.value for member in enum_type if member not in skip)


FORMAT = Option(
    "format", STRING, "Output format (case-insensitive).",
    default="jpeg", choices=tuple(fmt.value.lower() for fmt in ImageFormat),
)
QUALITY = Option(
    "quality", INTEGER, "Compression quality for lossy formats (JPEG, WebP, AVIF).",
    default=85, minimum=1, maximum=100,
)
WIDTH = Option(
    "width", INTEGER,
    "Resize to this width in pixels, keeping the aspect ratio. Ignored with upscale or fit to size.",
    minimum=1, example=1200,
)
TARGET_SIZE_KB = Option(
    "target_size_kb", INTEGER,
    "Largest output file size in KiB. Quality is lowered until the file fits. Not with webp_lossless.",
    minimum=1, example=200,
)
REMOVE_BACKGROUND = Option(
    "remove_background", BOOLEAN,
    "Remove the background with the bundled AI model (offline). Use png, webp or avif to keep transparency.",
    default=False, aliases=("use_rembg",),
)
WEBP_LOSSLESS = Option(
    "webp_lossless", BOOLEAN, "Lossless WebP (format webp only).", default=False,
)
UPSCALE = Option(
    "upscale", STRING,
    "AI upscaling (Real-ESRGAN, offline). A factor or a target resolution. Not for PDF output. "
    "Slow on big images: prefer POST /jobs.",
    choices=_values(UpscaleTarget), strict=False,
)
UPSCALE_MODEL = Option(
    "upscale_model", STRING, "Upscaling model: photos (general), less denoising, or anime/drawings.",
    default=UpscaleModel.GENERAL.value, choices=_values(UpscaleModel), strict=False,
)
FIT_WIDTH = Option(
    "fit_width", INTEGER, "Fit to size: output width in pixels. Needs fit_height.",
    minimum=1, maximum=MAX_FIT_DIMENSION, strict=False, example=1080,
)
FIT_HEIGHT = Option(
    "fit_height", INTEGER, "Fit to size: output height in pixels. Needs fit_width.",
    minimum=1, maximum=MAX_FIT_DIMENSION, strict=False, example=1080,
)
FIT_MODE_CONVERT = Option(
    "fit_mode", STRING,
    "Fit to size: crop to fill, or fit inside on a blurred, solid or transparent background.",
    default=FitMode.CROP.value, choices=_values(FitMode, skip=(FitMode.IMAGE,)), strict=False,
)
FIT_ANCHOR = Option(
    "fit_anchor", STRING, "Fit to size, mode crop: which part to keep. auto finds the subject.",
    default=FitAnchor.AUTO.value, choices=_values(FitAnchor), strict=False,
)
FIT_COLOR = Option(
    "fit_color", STRING, "Background colour for fit mode solid, as hex.", strict=False, example="#ffffff",
)
FIT_SCALE = Option(
    "fit_scale", NUMBER, "Image size on the canvas; 1 is the largest size that still fits.",
    minimum=MIN_PLACEMENT_SCALE, maximum=MAX_PLACEMENT_SCALE, strict=False,
)
FIT_X = Option(
    "fit_x", NUMBER, "Image centre as a share of the canvas width (0.5 = centred). Needs fit_y.",
    minimum=MIN_PLACEMENT_POSITION, maximum=MAX_PLACEMENT_POSITION, strict=False,
)
FIT_Y = Option(
    "fit_y", NUMBER, "Image centre as a share of the canvas height (0.5 = centred). Needs fit_x.",
    minimum=MIN_PLACEMENT_POSITION, maximum=MAX_PLACEMENT_POSITION, strict=False,
)
PDF_PRESET = Option(
    "pdf_preset", STRING, "PDF output: page size. original keeps each image's own size.",
    default="original", choices=tuple(PDF_PRESETS), strict=False,
)
PDF_SCALE = Option(
    "pdf_scale", STRING, "PDF output: fit the image on the page, or fill the page.",
    default="fit", choices=tuple(sorted(PDF_SCALE_MODES)), strict=False,
)
PDF_MARGIN_MM = Option(
    "pdf_margin_mm", NUMBER, "PDF output: page margin in millimetres.",
    default=10.0, minimum=0, maximum=30,
)
PDF_PAGINATE = Option(
    "pdf_paginate", BOOLEAN, "PDF output: split tall images over several pages.", default=False,
)
PDF_QUALITY = Option(
    "pdf_quality", STRING, "PDF output: image resolution and compression.",
    default=PdfQuality.default().value, choices=_values(PdfQuality), strict=False,
)
RELATIVE_DIRS = Option(
    "relative_dirs[]", STRING,
    "Folder of each file, in upload order (e.g. holiday/day1), to keep the folder structure in the ZIP. "
    "Give one per file or none.",
    repeated=True, strict=False,
)

FILES = Option(
    "files[]", STRING,
    "The images to convert; repeat the field for a batch. 'file' works as well, for a single upload.",
    repeated=True, aliases=("file",), strict=False,
)
OUTPUT = Option(
    "output", STRING,
    "POST /convert only: auto answers with the file itself for one result and a ZIP for several; "
    "zip always answers with a ZIP.",
    default="auto", choices=("auto", "zip"),
)

# Fields of POST /convert and POST /jobs (besides the files), in documentation order.
CONVERSION_OPTIONS: Tuple[Option, ...] = (
    FORMAT, QUALITY, WIDTH, TARGET_SIZE_KB, REMOVE_BACKGROUND, WEBP_LOSSLESS,
    UPSCALE, UPSCALE_MODEL,
    FIT_WIDTH, FIT_HEIGHT, FIT_MODE_CONVERT, FIT_ANCHOR, FIT_COLOR, FIT_SCALE, FIT_X, FIT_Y,
    PDF_PRESET, PDF_SCALE, PDF_MARGIN_MM, PDF_PAGINATE, PDF_QUALITY,
    RELATIVE_DIRS,
)

_FRACTION = {"minimum": 0, "maximum": 1}


def _editor(name, kind, description, **kwargs) -> Option:
    return Option(name, kind, description, strict=False, **kwargs)


# Fields of POST /edit: the editor's crop, fit, background and layers. FitToSize checks them.
EDITOR_OPTIONS: Tuple[Option, ...] = (
    _editor("fit_width", INTEGER, "Output width in pixels.", minimum=1, maximum=MAX_FIT_DIMENSION, example=1080),
    _editor("fit_height", INTEGER, "Output height in pixels.", minimum=1, maximum=MAX_FIT_DIMENSION, example=1080),
    _editor(
        "fit_mode", STRING,
        "crop fills the frame; the others fit the image on a blurred, solid, transparent or picture background.",
        default=FitMode.CROP.value, choices=_values(FitMode),
    ),
    _editor("crop_x", INTEGER, "Selection in source pixels: left edge. Give all four crop_* or none.", minimum=0),
    _editor("crop_y", INTEGER, "Selection in source pixels: top edge.", minimum=0),
    _editor("crop_width", INTEGER, "Selection in source pixels: width.", minimum=1),
    _editor("crop_height", INTEGER, "Selection in source pixels: height.", minimum=1),
    _editor("fit_scale", NUMBER, FIT_SCALE.description, minimum=MIN_PLACEMENT_SCALE, maximum=MAX_PLACEMENT_SCALE),
    _editor("fit_x", NUMBER, FIT_X.description, minimum=MIN_PLACEMENT_POSITION, maximum=MAX_PLACEMENT_POSITION),
    _editor("fit_y", NUMBER, FIT_Y.description, minimum=MIN_PLACEMENT_POSITION, maximum=MAX_PLACEMENT_POSITION),
    _editor("fit_rotation", NUMBER, "Image rotation in degrees, clockwise."),
    _editor("fit_color", STRING, "Solid background colour (hex), or the start of a gradient.", example="#ffffff"),
    _editor("fit_color_to", STRING, "End colour: turns the solid background into a linear gradient."),
    _editor("fit_gradient_angle", NUMBER, "Gradient angle in degrees, like CSS (180 = top to bottom)."),
    _editor("fit_pattern", STRING, "Pattern over a solid background.", default=FitPattern.NONE.value,
            choices=_values(FitPattern)),
    _editor("fit_dim", NUMBER, "Darken the background (blur, solid, image).", minimum=0, maximum=MAX_BACKGROUND_DIM),
    _editor("fit_blur", NUMBER, "Blur strength (blur, image).", **_FRACTION),
    _editor("fit_tint", NUMBER, "Tint opacity over the background (blur, solid, image).", **_FRACTION),
    _editor("fit_tint_color", STRING, "Tint colour (opaque hex)."),
    _editor("fit_tint_color_to", STRING, "Tint end colour, for a gradient tint."),
    _editor("fit_tint_angle", NUMBER, "Tint gradient angle in degrees."),
    _editor("fit_bg_scale", NUMBER, "Background picture zoom (fit mode image).",
            minimum=MIN_BACKGROUND_SCALE, maximum=MAX_BACKGROUND_SCALE),
    _editor("fit_bg_x", NUMBER, "Background picture centre, share of the width (fit mode image)."),
    _editor("fit_bg_y", NUMBER, "Background picture centre, share of the height (fit mode image)."),
    _editor("fit_bg_rotation", NUMBER, "Background picture rotation in degrees (fit mode image)."),
    _editor(
        "fit_text", STRING,
        f"One text as JSON: text (max {MAX_TEXT_LENGTH} chars), font_id ({', '.join(FONT_FILES)}), bold, italic, "
        "size (share of the height), color, opacity, x, y (0..1), shadow, align (left, center, right), rotation.",
        example='{"text":"Hello","size":0.1,"color":"#ffffff","y":0.9}',
    ),
    _editor(
        "fit_layers", STRING,
        f"Layers as a JSON list, bottom first: up to {MAX_TEXT_LAYERS} text layers "
        '({"type":"text", ...same keys as fit_text}) and up to '
        f'{MAX_IMAGE_LAYERS} picture layers ({{"type":"image","asset":"<id from /editor/assets>",'
        '"x","y","width","height","rotation","opacity"}). Picture layers need fit_session.',
        example='[{"type":"text","text":"Sale","y":0.1}]',
    ),
    _editor("fit_session", STRING, "Editor session from POST /editor/assets, for picture layers or a stored background."),
    _editor("fit_background_asset", STRING, "Background picture id from POST /editor/assets (fit mode image)."),
)


def strict_error(form, options: Tuple[Option, ...]) -> Optional[str]:
    """The first problem with a plain value (number, yes/no, choice), else None."""
    for option in options:
        if not option.strict:
            continue
        raw = option.raw(form)
        if raw is None or not raw.strip():
            continue
        value = raw.strip()
        if option.kind == BOOLEAN:
            if value.lower() not in BOOLEAN_VALUES:
                return f"'{option.name}' must be true or false."
            continue
        if option.kind in (INTEGER, NUMBER):
            try:
                number = int(value) if option.kind == INTEGER else float(value)
            except ValueError:
                number = None
            low, high = option.minimum, option.maximum
            if number is None or (low is not None and number < low) or (high is not None and number > high):
                kind = "a whole number" if option.kind == INTEGER else "a number"
                bounds = (
                    f" between {low:g} and {high:g}" if low is not None and high is not None
                    else f" >= {low:g}" if low is not None else ""
                )
                return f"'{option.name}' must be {kind}{bounds}."
            continue
        if option.choices and value.lower() not in option.choices:
            return f"'{option.name}' must be one of: {', '.join(option.choices)}."
    return None
