from dataclasses import dataclass
from typing import Optional, Tuple, Dict

from backend.image_converter.core.internals.utilities import Result


@dataclass(frozen=True)
class PdfPreset:
    size: Optional[Tuple[int, int]]
    margin_mm: float = 0.0
    auto_rotate: bool = False


PDF_PRESETS: Dict[str, PdfPreset] = {
    "original": PdfPreset(size=None, margin_mm=0.0, auto_rotate=False),
    "a4-auto": PdfPreset(size=(595, 842), margin_mm=10.0, auto_rotate=True),
    "a4-portrait": PdfPreset(size=(595, 842), margin_mm=10.0, auto_rotate=False),
    "a4-landscape": PdfPreset(size=(842, 595), margin_mm=10.0, auto_rotate=False),
    "letter-auto": PdfPreset(size=(612, 792), margin_mm=10.0, auto_rotate=True),
    "letter-portrait": PdfPreset(size=(612, 792), margin_mm=10.0, auto_rotate=False),
    "letter-landscape": PdfPreset(size=(792, 612), margin_mm=10.0, auto_rotate=False),
    "mobile-portrait": PdfPreset(size=(1080, 1920), margin_mm=0.0, auto_rotate=False),
    "mobile-landscape": PdfPreset(size=(1920, 1080), margin_mm=0.0, auto_rotate=False),
}

PDF_SCALE_MODES = {"fit", "fill"}


def normalize_pdf_preset(value: Optional[str]) -> str:
    if not value:
        return "original"
    cleaned = value.strip().lower().replace("_", "-").replace(" ", "-")
    return cleaned or "original"


def resolve_pdf_preset(value: Optional[str]) -> Result[PdfPreset]:
    key = normalize_pdf_preset(value)
    if key not in PDF_PRESETS:
        return Result.failure(f"Unsupported PDF preset: '{value}'")
    return Result.success(PDF_PRESETS[key])


def normalize_pdf_scale(value: Optional[str]) -> str:
    if not value:
        return "fit"
    cleaned = value.strip().lower()
    return cleaned or "fit"


def resolve_pdf_scale(value: Optional[str]) -> Result[str]:
    key = normalize_pdf_scale(value)
    if key not in PDF_SCALE_MODES:
        return Result.failure(f"Unsupported PDF scale mode: '{value}'")
    return Result.success(key)
