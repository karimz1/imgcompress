from flask import Request
from typing import Any, Dict, Optional
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.internals.utilities import Result, is_file_supported

def extract_form_data(request: Request, logger: Logger) -> Result[Dict[str, Any]]:
    uploaded_files = request.files.getlist("files[]")
    output_format = request.form.get("format", "jpeg").lower()
    quality = _parse_quality(request.form.get("quality", "85"), logger)
    width = _parse_width(request.form.get("width", ""), logger)
    target_size_kb = _parse_target_size_kb(request.form.get("target_size_kb", ""), logger)
    use_rembg = _parse_bool(request.form.get("use_rembg"))

    allowed_files = [f for f in uploaded_files if is_file_supported(f.filename)]
    unsupported_files = [f for f in uploaded_files if not is_file_supported(f.filename)]

    if unsupported_files:
        unsupported_names = ", ".join(f.filename for f in unsupported_files)
        return Result.failure(f"Unsupported file types: {unsupported_names}")

    return Result.success({
        "uploaded_files": allowed_files,
        "quality": quality,
        "width": width,
        "format": output_format,
        "target_size_kb": target_size_kb,
        "use_rembg": use_rembg,
    })


def _parse_quality(value: str, logger: Logger) -> int:
    try:
        q = int(value)
        if not (1 <= q <= 100):
            raise ValueError
        return q
    except ValueError:
        logger.log(f"Invalid quality '{value}'. Using default 85.", "warning")
        return 85

def _parse_width(value: str, logger: Logger) -> Optional[int]:
    if not value.strip():
        return None
    try:
        w = int(value)
        if w <= 0:
            raise ValueError
        return w
    except ValueError:
        logger.log(f"Invalid width '{value}'. Not resizing.", "warning")
        return None


def _parse_target_size_kb(value: str, logger: Logger) -> Optional[int]:
    """Parses an optional target size (in KB). Returns None if empty or invalid."""
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        kb = int(value)
        if kb <= 0:
            raise ValueError
        return kb
    except ValueError:
        logger.log(f"Invalid target_size_kb '{value}'. Ignoring.", "warning")
        return None


def _parse_bool(value: Optional[str]) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}
