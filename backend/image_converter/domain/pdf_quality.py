from dataclasses import dataclass
from enum import Enum
from typing import Dict, Optional

from backend.image_converter.core.internals.utilities import Result


@dataclass(frozen=True)
class PdfQualityPreset:
    dpi: int
    jpeg_quality: int
    original_max_dimension: Optional[int]


class PdfQuality(Enum):
    SMALL = "small"
    MEDIUM = "medium"
    HIGH = "high"
    ULTRA = "ultra"

    @classmethod
    def default(cls) -> "PdfQuality":
        """
        Returns the quality preset used when the caller does not specify one.
        """
        return cls.HIGH

    @classmethod
    def from_string_result(cls, value: Optional[str]) -> Result["PdfQuality"]:
        """
        Converts a string to a PdfQuality enum member using the result pattern.
        Blank or missing values fall back to the default preset.
        """
        if value is None or not value.strip():
            return Result.success(cls.default())
        try:
            return Result.success(cls(value.strip().lower()))
        except ValueError:
            return Result.failure(f"Unsupported PDF quality preset: '{value}'")

    @property
    def preset(self) -> PdfQualityPreset:
        """
        Returns the rendering settings associated with the quality preset.
        """
        return PDF_QUALITY_PRESETS[self]


PDF_QUALITY_PRESETS: Dict[PdfQuality, PdfQualityPreset] = {
    PdfQuality.SMALL: PdfQualityPreset(dpi=96, jpeg_quality=55, original_max_dimension=1600),
    PdfQuality.MEDIUM: PdfQualityPreset(dpi=150, jpeg_quality=70, original_max_dimension=2400),
    PdfQuality.HIGH: PdfQualityPreset(dpi=220, jpeg_quality=82, original_max_dimension=3600),
    PdfQuality.ULTRA: PdfQualityPreset(dpi=300, jpeg_quality=92, original_max_dimension=None),
}
