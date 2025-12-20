from io import BytesIO

from PIL import Image
import pytest

from backend.image_converter.core.internals.utls import (
    Result,
    supported_extensions,
    EXTRA_SUPPORTED_EXTENSIONS,
)
from backend.image_converter.infrastructure.pdf_page_extractor import PdfPageExtractor
from backend.image_converter.application.file_payload_expander import FilePayloadExpander

SAMPLE_PDF = "tests/sample-images/imgcompress_screenshot.pdf"


def test_When_LoadingSupportedExtensions_Expect_AllExtraFormatsIncluded():
    for extra in EXTRA_SUPPORTED_EXTENSIONS:
        assert extra in supported_extensions


def test_When_PdfPageExtractorProcessesSample_Expect_PageRendered():
    extractor = PdfPageExtractor(dpi=144)
    with open(SAMPLE_PDF, "rb") as f:
        data = f.read()

    result = extractor.rasterize_pages(data, "imgcompress_screenshot.pdf")
    assert result.is_successful
    pages = list(result.value)
    assert len(pages) == 1
    page_bytes = pages[0]
    with Image.open(BytesIO(page_bytes)) as img:
        assert img.width > 0
        assert img.height > 0


def test_When_PdfiumRaisesRuntimeError_Expect_ExtractorFailure(monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(
        "backend.image_converter.infrastructure.pdf_page_extractor.pdfium.PdfDocument",
        boom,
    )

    extractor = PdfPageExtractor()
    result = extractor.rasterize_pages(b"", "broken.pdf")

    assert result.is_successful is False
    assert "boom" in result.error


class DummyRenderer:
    def render(self, source_name, data):
        return Result.success(data)


def test_When_ExpandingPdfPayload_Expect_PageMetadataCreated(monkeypatch):
    fake_pages = [b"a", b"b"]

    class DummyExtractor:
        def rasterize_pages(self, data, source_hint):
            return Result.success(fake_pages)

    expander = FilePayloadExpander(DummyExtractor(), DummyRenderer())
    result = expander.expand("demo.pdf", b"bytes")
    assert result.is_successful
    payloads = list(result.value)
    assert len(payloads) == 2
    assert payloads[0].label == "demo.pdf (page 1)"
    assert payloads[0].page_index == 1


def test_When_ExtractorFails_Expect_PayloadExpansionFailure(monkeypatch):
    class DummyExtractor:
        def rasterize_pages(self, data, source_hint):
            return Result.failure("invalid pdf")

    expander = FilePayloadExpander(DummyExtractor(), DummyRenderer())
    result = expander.expand("demo.pdf", b"bytes")
    assert result.is_successful is False
    assert "invalid pdf" in result.error


def test_When_FileIsNonPdf_Expect_ExpanderReturnsOriginalPayload():
    expander = FilePayloadExpander(PdfPageExtractor(), DummyRenderer())
    result = expander.expand("image.png", b"bytes")
    assert result.is_successful
    payloads = result.value
    assert len(payloads) == 1
    assert payloads[0].label == "image.png"
    assert payloads[0].page_index is None
