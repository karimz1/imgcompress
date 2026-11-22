from typing import Optional

from flask import Request

from backend.image_converter.application import conversion_options as options
from backend.image_converter.application.dtos import CompressionFormData
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.core.internals.utilities import Result, is_file_supported
from backend.image_converter.infrastructure.logger import Logger


def extract_form_data(request: Request, logger: Logger) -> Result[CompressionFormData]:
    return parse_compression_form(uploaded_files(request.files), request.form, logger)


def uploaded_files(files) -> list:
    """The uploads under 'files[]' and its alias 'file', without empty file inputs."""
    found = []
    for key in (options.FILES.name, *options.FILES.aliases):
        found += [f for f in files.getlist(key) if f and (f.filename or "").strip()]
    return found


def unsupported_file_names(uploaded_files) -> list[str]:
    return [f.filename for f in uploaded_files if not is_file_supported(f.filename)]


def parse_compression_form(uploaded_files, form, logger: Logger) -> Result[CompressionFormData]:
    """
    The conversion options of one upload, shared by the web UI (/api) and the
    public API (/api/v1). Names, defaults and limits come from
    conversion_options; a bad plain value falls back to its default here, the
    public API refuses it beforehand (conversion_options.strict_error).
    """
    unsupported = unsupported_file_names(uploaded_files)
    if unsupported:
        return Result.failure(f"Unsupported file types: {', '.join(unsupported)}")

    relative_dirs = tuple(form.getlist(options.RELATIVE_DIRS.name))
    if relative_dirs and len(relative_dirs) != len(uploaded_files):
        return Result.failure("The folder of every uploaded file must be given, or none.")

    raw_format = (options.FORMAT.raw(form) or options.FORMAT.default).lower()
    format_result = ImageFormat.from_string_result(raw_format)
    if not format_result.is_successful:
        return Result.failure(format_result.error or "Unsupported image format")

    def text(option: options.Option, default: str = "") -> str:
        return _raw_or(option, form, default).strip()

    form_data = CompressionFormData(
        uploaded_files=tuple(uploaded_files),
        quality=_parse_quality(_raw_or(options.QUALITY, form, str(options.QUALITY.default)), logger),
        width=_parse_width(options.WIDTH.raw(form) or "", logger),
        image_format=format_result.value,
        target_size_kb=_parse_target_size_kb(options.TARGET_SIZE_KB.raw(form) or "", logger),
        use_rembg=_parse_bool(options.REMOVE_BACKGROUND.raw(form)),
        pdf_preset=text(options.PDF_PRESET),
        pdf_scale=text(options.PDF_SCALE),
        pdf_margin_mm=_parse_margin_mm(options.PDF_MARGIN_MM.raw(form) or "", logger),
        pdf_paginate=_parse_bool(options.PDF_PAGINATE.raw(form)),
        pdf_quality=text(options.PDF_QUALITY, options.PDF_QUALITY.default),
        webp_lossless=_parse_bool(options.WEBP_LOSSLESS.raw(form)),
        upscale=text(options.UPSCALE),
        upscale_model=text(options.UPSCALE_MODEL, options.UPSCALE_MODEL.default),
        fit_width=text(options.FIT_WIDTH),
        fit_height=text(options.FIT_HEIGHT),
        fit_mode=text(options.FIT_MODE_CONVERT),
        fit_anchor=text(options.FIT_ANCHOR),
        fit_color=text(options.FIT_COLOR),
        fit_scale=text(options.FIT_SCALE),
        fit_x=text(options.FIT_X),
        fit_y=text(options.FIT_Y),
        relative_dirs=relative_dirs,
    )
    return Result.success(form_data)


def _raw_or(option: options.Option, form, default: str) -> str:
    raw = option.raw(form)
    return raw if raw is not None else default


def _parse_quality(value: str, logger: Logger) -> int:
    default = options.QUALITY.default
    try:
        q = int(value)
        if not (options.QUALITY.minimum <= q <= options.QUALITY.maximum):
            raise ValueError
        return q
    except ValueError:
        logger.log(f"Invalid quality '{value}'. Using default {default}.", "warning")
        return default


def _parse_width(value: str, logger: Logger) -> Optional[int]:
    if not value.strip():
        return None
    try:
        w = int(value)
        if w < options.WIDTH.minimum:
            raise ValueError
        return w
    except ValueError:
        logger.log(f"Invalid width '{value}'. Not resizing.", "warning")
        return None


def _parse_target_size_kb(value: str, logger: Logger) -> Optional[int]:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        kb = int(value)
        if kb < options.TARGET_SIZE_KB.minimum:
            raise ValueError
        return kb
    except ValueError:
        logger.log(f"Invalid target_size_kb '{value}'. Ignoring.", "warning")
        return None


def _parse_bool(value: Optional[str]) -> bool:
    if value is None:
        return False
    return value.strip().lower() in options.TRUE_VALUES


def _parse_margin_mm(value: str, logger: Logger) -> float:
    default = options.PDF_MARGIN_MM.default
    if value is None:
        return default
    value = value.strip()
    if not value:
        return default
    try:
        mm = float(value)
        return min(float(options.PDF_MARGIN_MM.maximum), max(float(options.PDF_MARGIN_MM.minimum), mm))
    except ValueError:
        logger.log(f"Invalid pdf_margin_mm '{value}'. Using default 10.", "warning")
        return default
