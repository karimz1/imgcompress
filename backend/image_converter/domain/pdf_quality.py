from dataclasses import dataclass
from typing import Dict, Optional

from backend.image_converter.core.internals.utilities import Result


@dataclass(frozen=True)
class PdfQualityPreset:
    key: str
    dpi: int
    jpeg_quality: int
    original_max_dimension: Optional[int]


PDF_QUALITY_PRESETS: Dict[str, PdfQualityPreset] = {
    "small": PdfQualityPreset("small", dpi=96, jpeg_quality=55, original_max_dimension=1600),
    "medium": PdfQualityPreset("medium", dpi=150, jpeg_quality=70, original_max_dimension=2400),
    "high": PdfQualityPreset("high", dpi=220, jpeg_quality=82, original_max_dimension=3600),
    "ultra": PdfQualityPreset("ultra", dpi=300, jpeg_quality=92, original_max_dimension=None),
}


def normalize_pdf_quality(value: Optional[str]) -> str:
    return (value or "high").strip().lower()


def resolve_pdf_quality(value: Optional[str]) -> Result[PdfQualityPreset]:
    key = normalize_pdf_quality(value)
    if key not in PDF_QUALITY_PRESETS:
        return Result.failure(f"Unsupported PDF quality preset: '{value}'")
    return Result.success(PDF_QUALITY_PRESETS[key])
