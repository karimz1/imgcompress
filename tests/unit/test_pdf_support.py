from io import BytesIO

from PIL import Image

from backend.image_converter.application.file_payload_expander import (
    FilePayloadExpander,
)
from backend.image_converter.config import settings
from backend.image_converter.core.internals.utilities import (
    Result,
    supported_extensions,
)
from backend.image_converter.infrastructure.pdf_page_extractor import PdfPageExtractor

SAMPLE_PDF = "tests/sample-images/imgcompress_screenshot.pdf"


def test_When_LoadingSupportedExtensions_Expect_AllExtraFormatsIncluded():
    for extra in settings.get().formats.custom_pipeline_extensions:
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
    def boom(*_args, **_kwargs):
        raise RuntimeError("boom")

    import pypdfium2
    monkeypatch.setattr(pypdfium2, "PdfDocument", boom)

    class _RecordingLogger:
        def __init__(self):
            self.messages = []

        def log(self, message, level):
            self.messages.append((message, level))

    logger = _RecordingLogger()
    extractor = PdfPageExtractor(logger=logger)
    result = extractor.rasterize_pages(b"", "broken.pdf")

    assert result.is_successful is False
    assert "PDF could not be rendered." == result.error
    assert any(
        "boom" in message and "broken.pdf" in message
        for message, _ in logger.messages
    )


class _FakePdfPage:
    def __init__(self, render_calls):
        self.render_calls = render_calls

    def render(self, scale):
        self.render_calls.append(scale)
        return self

    def to_pil(self):
        return Image.new("RGB", (1, 1))

    def close(self):
        pass


class _FakePdfDocument:
    def __init__(self, page_sizes):
        self.page_sizes = page_sizes
        self.render_calls = []
        self.pages = [_FakePdfPage(self.render_calls) for _ in page_sizes]
        self.closed = False

    def __len__(self):
        return len(self.pages)

    def __getitem__(self, index):
        return self.pages[index]

    def get_page_size(self, index):
        return self.page_sizes[index]

    def close(self):
        self.closed = True


def test_When_PdfContains20InchPage_Expect_RejectedBeforeRendering(monkeypatch):
    twenty_inches_in_points = 20 * 72
    document = _FakePdfDocument(
        page_sizes=[(twenty_inches_in_points, twenty_inches_in_points)]
    )
    monkeypatch.setattr(PdfPageExtractor, "_open_document", lambda *_: document)

    result = PdfPageExtractor().rasterize_pages(b"pdf", "large-page.pdf")

    assert result.is_successful is False
    assert result.error == (
        "PDF page 1 exceeds the maximum allowed rendered pixel count (25000000)."
    )
    assert document.render_calls == []
    assert document.closed is True


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
