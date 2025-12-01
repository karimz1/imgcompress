from io import BytesIO

from PIL import Image
import pytest

from backend.image_converter.core.internals.utls import Result, supported_extensions
from backend.image_converter.infrastructure.pdf_page_extractor import PdfPageExtractor
from backend.image_converter.application.file_payload_expander import FilePayloadExpander

SAMPLE_PDF = "tests/sample-images/imgcompress_screenshot.pdf"


def test_supported_extensions_includes_pdf():
    assert ".pdf" in supported_extensions


def test_pdf_page_extractor_renders_sample_pdf():
    extractor = PdfPageExtractor(dpi=144)
    with open(SAMPLE_PDF, "rb") as f:
        data = f.read()

    result = extractor.extract_pages(data, "imgcompress_screenshot.pdf")
    assert result.is_successful
    assert len(result.value) == 1
    page_bytes = result.value[0]
    with Image.open(BytesIO(page_bytes)) as img:
        assert img.width > 0
        assert img.height > 0


def test_pdf_page_extractor_failure(monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(
        "backend.image_converter.infrastructure.pdf_page_extractor.pdfium.PdfDocument",
        boom,
    )

    extractor = PdfPageExtractor()
    result = extractor.extract_pages(b"", "broken.pdf")

    assert result.is_successful is False
    assert "boom" in result.error


def test_payload_expander_for_pdf(monkeypatch):
    fake_pages = [b"a", b"b"]

    class DummyExtractor:
        def extract_pages(self, data, source_hint):
            return Result.success(fake_pages)

    expander = FilePayloadExpander(DummyExtractor())
    result = expander.expand("demo.pdf", b"bytes")
    assert result.is_successful
    payloads = result.value
    assert len(payloads) == 2
    assert payloads[0].label == "demo.pdf (page 1)"
    assert payloads[0].page_index == 1


def test_payload_expander_failure(monkeypatch):
    class DummyExtractor:
        def extract_pages(self, data, source_hint):
            return Result.failure("invalid pdf")

    expander = FilePayloadExpander(DummyExtractor())
    result = expander.expand("demo.pdf", b"bytes")
    assert result.is_successful is False
    assert "invalid pdf" in result.error


def test_payload_expander_non_pdf():
    expander = FilePayloadExpander(PdfPageExtractor())
    result = expander.expand("image.png", b"bytes")
    assert result.is_successful
    payloads = result.value
    assert len(payloads) == 1
    assert payloads[0].label == "image.png"
    assert payloads[0].page_index is None
