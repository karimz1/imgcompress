"""Saved compression settings ("presets") and the rules they follow.

A preset keeps the settings the conversion form sends to ``/api/v1/jobs``, with
the same names and values, so applying one fills the form exactly as it was
saved. This module only validates and normalizes; it knows nothing about
files or HTTP.

Validation is strict: unknown keys, wrong types and out-of-range numbers are
refused instead of being guessed at. Settings that do not apply to the chosen
format (a quality for PNG, PDF page options for JPEG, ...) are stored as None,
so two presets that convert the same way also look the same.
"""

import math
import unicodedata
from typing import Any, Optional

from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.domain.pdf_presets import PDF_PRESETS, PDF_SCALE_MODES
from backend.image_converter.domain.pdf_quality import PdfQuality
from backend.image_converter.domain.upscaling import UpscaleModel, UpscaleTarget

MAX_PRESETS = 100
MAX_NAME_LENGTH = 80

FORMATS = ("jpeg", "png", "ico", "avif", "webp", "pdf")

SETTING_KEYS = (
    "format",
    "quality",
    "width",
    "target_size_kb",
    "use_rembg",
    "webp_lossless",
    "pdf_preset",
    "pdf_quality",
    "pdf_scale",
    "pdf_margin_mm",
    "pdf_paginate",
    "upscale",
    "upscale_model",
)

# Same defaults as the form and the request parser.
DEFAULT_QUALITY = 85
DEFAULT_PDF_PRESET = "original"
DEFAULT_PDF_SCALE = "fit"
DEFAULT_PDF_MARGIN_MM = 10.0
DEFAULT_UPSCALE_MODEL = UpscaleModel.GENERAL.value

# The request parser clamps margins to this range.
MAX_PDF_MARGIN_MM = 30.0

_PDF_QUALITIES = tuple(quality.value for quality in PdfQuality)
_UPSCALE_TARGETS = tuple(target.value for target in UpscaleTarget)
_UPSCALE_MODELS = tuple(model.value for model in UpscaleModel)


def parse_name(value: Any) -> Result[str]:
    """A preset name: trimmed, 1 to MAX_NAME_LENGTH characters, no control characters (emoji are fine)."""
    if not isinstance(value, str):
        return Result.failure("Preset name must be a string.")
    name = unicodedata.normalize("NFC", value).strip()
    if not name:
        return Result.failure("Preset name must not be empty.")
    if len(name) > MAX_NAME_LENGTH:
        return Result.failure(f"Preset name must be at most {MAX_NAME_LENGTH} characters.")
    if any(unicodedata.category(char) == "Cc" for char in name):
        return Result.failure("Preset name must not contain control characters.")
    return Result.success(name)


def parse_settings(raw: Any) -> Result[dict]:
    """Validates the settings of a preset and returns them normalized, with every key present."""
    if not isinstance(raw, dict):
        return Result.failure("Preset settings must be an object.")

    unknown = sorted(str(key) for key in raw if key not in SETTING_KEYS)
    if unknown:
        return Result.failure(f"Unknown preset settings: {', '.join(unknown)}.")

    errors: list[str] = []
    image_format = _choice(raw, "format", FORMATS, errors, required=True)
    quality = _integer(raw, "quality", errors, minimum=1, maximum=100)
    width = _integer(raw, "width", errors, minimum=1)
    target_size_kb = _integer(raw, "target_size_kb", errors, minimum=1)
    use_rembg = _boolean(raw, "use_rembg", errors)
    webp_lossless = _boolean(raw, "webp_lossless", errors)
    pdf_preset = _choice(raw, "pdf_preset", tuple(PDF_PRESETS), errors)
    pdf_quality = _choice(raw, "pdf_quality", _PDF_QUALITIES, errors)
    pdf_scale = _choice(raw, "pdf_scale", tuple(sorted(PDF_SCALE_MODES)), errors)
    pdf_margin_mm = _number(raw, "pdf_margin_mm", errors, minimum=0.0, maximum=MAX_PDF_MARGIN_MM)
    pdf_paginate = _boolean(raw, "pdf_paginate", errors)
    upscale = _choice(raw, "upscale", _UPSCALE_TARGETS, errors)
    upscale_model = _choice(raw, "upscale_model", _UPSCALE_MODELS, errors)

    # The form never sends these together; one of them would be ignored.
    if quality is not None and target_size_kb is not None:
        errors.append("Set either quality or target_size_kb, not both.")
    if width is not None and upscale is not None:
        errors.append("Set either width or upscale, not both.")

    if errors:
        return Result.failure(" ".join(errors))

    is_pdf = image_format == "pdf"
    is_webp = image_format == "webp"
    webp_lossless = bool(webp_lossless) if is_webp else None
    has_quality = image_format in ("jpeg", "avif") or (is_webp and not webp_lossless)
    pdf_preset = (pdf_preset or DEFAULT_PDF_PRESET) if is_pdf else None
    # Page options only exist for a page size; "original" keeps each image's size.
    has_page = is_pdf and pdf_preset != DEFAULT_PDF_PRESET
    pdf_paginate = bool(pdf_paginate) if has_page else None
    upscale = None if is_pdf else upscale

    normalized = {
        "format": image_format,
        "quality": (DEFAULT_QUALITY if quality is None else quality)
        if has_quality and target_size_kb is None
        else None,
        # A page size decides the image size in a PDF, so a width would be dropped.
        "width": None if has_page else width,
        "target_size_kb": target_size_kb if has_quality else None,
        "use_rembg": bool(use_rembg) if image_format in ("png", "avif", "webp") else None,
        "webp_lossless": webp_lossless,
        "pdf_preset": pdf_preset,
        "pdf_quality": (pdf_quality or PdfQuality.default().value) if is_pdf else None,
        # Pages split across several sheets are always fitted.
        "pdf_scale": (DEFAULT_PDF_SCALE if pdf_paginate else pdf_scale or DEFAULT_PDF_SCALE)
        if has_page
        else None,
        "pdf_margin_mm": (DEFAULT_PDF_MARGIN_MM if pdf_margin_mm is None else pdf_margin_mm)
        if has_page
        else None,
        "pdf_paginate": pdf_paginate,
        "upscale": upscale,
        "upscale_model": (upscale_model or DEFAULT_UPSCALE_MODEL) if upscale is not None else None,
    }
    return Result.success(normalized)


def _choice(
    raw: dict, key: str, options: tuple[str, ...], errors: list[str], *, required: bool = False
) -> Optional[str]:
    value = raw.get(key)
    if value is None:
        if required:
            errors.append(f"'{key}' is required.")
        return None
    if not isinstance(value, str) or value not in options:
        errors.append(f"'{key}' must be one of: {', '.join(options)}.")
        return None
    return value


def _integer(
    raw: dict, key: str, errors: list[str], *, minimum: int, maximum: Optional[int] = None
) -> Optional[int]:
    value = raw.get(key)
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int):
        errors.append(f"'{key}' must be a whole number.")
        return None
    if value < minimum or (maximum is not None and value > maximum):
        bounds = f"between {minimum} and {maximum}" if maximum is not None else f"at least {minimum}"
        errors.append(f"'{key}' must be {bounds}.")
        return None
    return value


def _number(
    raw: dict, key: str, errors: list[str], *, minimum: float, maximum: float
) -> Optional[float]:
    value = raw.get(key)
    if value is None:
        return None
    # Checked before the range: NaN compares false with everything.
    if isinstance(value, bool) or not isinstance(value, (int, float)) or (
        isinstance(value, float) and not math.isfinite(value)
    ):
        errors.append(f"'{key}' must be a number.")
        return None
    if not minimum <= value <= maximum:
        errors.append(f"'{key}' must be between {minimum:g} and {maximum:g}.")
        return None
    return float(value)


def _boolean(raw: dict, key: str, errors: list[str]) -> Optional[bool]:
    value = raw.get(key)
    if value is None or isinstance(value, bool):
        return value
    errors.append(f"'{key}' must be true or false.")
    return None
