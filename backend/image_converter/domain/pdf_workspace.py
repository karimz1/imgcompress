from dataclasses import dataclass
from math import isfinite

from backend.image_converter.domain.pdf_presets import PdfPreset, resolve_pdf_preset, resolve_pdf_scale
from backend.image_converter.domain.pdf_quality import PdfQuality


@dataclass(frozen=True)
class PdfWorkspaceSettings:
    preset: PdfPreset = PdfPreset(None)
    scale: str = "fit"
    margin_mm: float = 10
    paginate: bool = False
    quality: PdfQuality = PdfQuality.HIGH
    apply_layout: bool = False

    @classmethod
    def from_form(cls, form):
        apply = form.get("apply_layout") == "true"
        preset = resolve_pdf_preset(form.get("pdf_preset") if apply else "original")
        scale = resolve_pdf_scale(form.get("pdf_scale") if apply else "fit")
        quality = PdfQuality.from_string_result(form.get("pdf_quality") if apply else "high")
        for result in (preset, scale, quality):
            if not result.is_successful:
                raise ValueError(result.error)
        try:
            margin = float(form.get("pdf_margin_mm") or "10") if apply else 0
        except (ValueError, TypeError):
            raise ValueError("Invalid PDF margin.") from None
        if not isfinite(margin) or not 0 <= margin <= 30:
            raise ValueError("PDF margin must be between 0 and 30 mm.")
        return cls(preset.value, scale.value, margin, apply and form.get("pdf_paginate") == "true", quality.value, apply)
