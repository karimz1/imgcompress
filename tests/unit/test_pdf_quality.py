import pytest

from backend.image_converter.application.dtos import CompressionFormData
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.domain.pdf_quality import PDF_QUALITY_PRESETS, PdfQuality
from backend.image_converter.presentation.web.services.compression_service import (
    CompressionService,
)
from tests.unit.dummy_logger import DummyLogger


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("small", PdfQuality.SMALL),
        ("MEDIUM", PdfQuality.MEDIUM),
        ("  Ultra  ", PdfQuality.ULTRA),
    ],
)
def test_When_ParsingKnownQuality_Expect_MatchingEnumMember(raw, expected):
    result = PdfQuality.from_string_result(raw)

    assert result.is_successful
    assert result.value is expected


@pytest.mark.parametrize("raw", [None, "", "   "])
def test_When_ParsingBlankQuality_Expect_DefaultPreset(raw):
    result = PdfQuality.from_string_result(raw)

    assert result.is_successful
    assert result.value is PdfQuality.HIGH


def test_When_ParsingUnknownQuality_Expect_Failure():
    result = PdfQuality.from_string_result("gigantic")

    assert not result.is_successful
    assert "gigantic" in result.error


def test_When_ResolvingPreset_Expect_SettingsForEveryQuality():
    assert set(PDF_QUALITY_PRESETS) == set(PdfQuality)
    assert PdfQuality.SMALL.preset.dpi < PdfQuality.ULTRA.preset.dpi
    assert PdfQuality.SMALL.preset.jpeg_quality < PdfQuality.ULTRA.preset.jpeg_quality
    assert PdfQuality.ULTRA.preset.original_max_dimension is None


def _form_data(image_format: ImageFormat, pdf_quality: str) -> CompressionFormData:
    return CompressionFormData(
        uploaded_files=(),
        quality=85,
        width=None,
        image_format=image_format,
        target_size_kb=None,
        use_rembg=False,
        pdf_preset="a4-portrait",
        pdf_scale="fit",
        pdf_margin_mm=10.0,
        pdf_paginate=False,
        pdf_quality=pdf_quality,
    )


def test_When_CompressingPdfWithUnknownQuality_Expect_RejectedBeforeConversion():
    service = CompressionService(DummyLogger(), use_case=None, temp_folder_service=None)

    result = service.compress(_form_data(ImageFormat.PDF, "gigantic"))

    assert not result.is_successful
    assert "gigantic" in result.error
