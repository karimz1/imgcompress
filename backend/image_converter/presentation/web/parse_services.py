                                                                 

from flask import Request
from typing import Any, Dict, Optional
from backend.image_converter.infrastructure.logger import Logger

ALLOWED_EXTENSIONS = {
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp',
    'heic', 'heif', 'svg', 'ico', 'raw', 'cr2', 'nef', 'arw',
    'dng', 'orf', 'rw2', 'sr2', 'apng', 'jp2', 'j2k', 'jpf',
    'jpx', 'jpm', 'mj2', 'psd', 'pdf', 'emf', 'exr', 'avif'
}

def extract_form_data(request: Request, logger: Logger) -> Dict[str, Any]:
    uploaded_files = request.files.getlist("files[]")
    output_format = request.form.get("format", "jpeg").lower()
    quality = _parse_quality(request.form.get("quality", "85"), logger)
    width = _parse_width(request.form.get("width", ""), logger)

                                 
    allowed_files = [f for f in uploaded_files if _is_file_allowed(f.filename)]
    if len(allowed_files) != len(uploaded_files):
        logger.log("Some files were rejected due to unsupported file types.", "warning")

    return {
        "uploaded_files": allowed_files,
        "quality": quality,
        "width": width,
        "format": output_format
    }

def _is_file_allowed(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

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
