from io import BytesIO

from PIL import Image

from backend.image_converter.application.file_payload_expander import PagePayload
from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.presentation.web.services.crop_preview_service import CropPreviewService

UNSUPPORTED_EXTENSIONS = [".pdf", ".svg"]


class RecordingLogger:
    def __init__(self):
        self.messages = []

    def log(self, message, level="info"):
        self.messages.append((message, level))


class FlakyPayloadExpander:
    def __init__(self, failures_before_success):
        self.failures_before_success = failures_before_success
        self.calls = 0

    def expand(self, source_name, data):
        self.calls += 1
        if self.calls <= self.failures_before_success:
            return Result.failure("temporary preview failure")
        return Result.success([PagePayload(data=data, page_index=None, label=source_name)])


def _png_bytes():
    buffer = BytesIO()
    Image.new("RGBA", (2, 2), (255, 0, 0, 255)).save(buffer, format="PNG")
    return buffer.getvalue()


def _errors(messages):
    return [m for m, lvl in messages if lvl == "error"]


def test_crop_preview_service_retries_then_returns_png(monkeypatch):
    monkeypatch.setattr(
        "backend.image_converter.presentation.web.services.crop_preview_service.time.sleep",
        lambda _seconds: None,
    )
    logger = RecordingLogger()
    expander = FlakyPayloadExpander(failures_before_success=2)
    service = CropPreviewService(
        logger,
        expander,
        unsupported_extensions=UNSUPPORTED_EXTENSIONS,
        max_attempts=3,
    )

    result = service.build_preview("test.psd", _png_bytes(), request_id="unit-retry")

    assert result.is_successful
    assert expander.calls == 3
    error_messages = _errors(logger.messages)
    assert len(error_messages) == 2
    assert all("rid=unit-retry" in m for m, _ in logger.messages)
    with Image.open(result.value) as img:
        assert img.format == "PNG"
        assert img.size == (2, 2)


def test_crop_preview_service_fails_after_max_attempts(monkeypatch):
    monkeypatch.setattr(
        "backend.image_converter.presentation.web.services.crop_preview_service.time.sleep",
        lambda _seconds: None,
    )
    logger = RecordingLogger()
    expander = FlakyPayloadExpander(failures_before_success=99)
    service = CropPreviewService(
        logger,
        expander,
        unsupported_extensions=UNSUPPORTED_EXTENSIONS,
        max_attempts=3,
    )

    result = service.build_preview("test.psd", _png_bytes(), request_id="unit-fail")

    assert not result.is_successful
    assert expander.calls == 3
    assert len(_errors(logger.messages)) == 3
    assert "after 3 attempts" in result.error
    assert all("rid=unit-fail" in m for m, _ in logger.messages)


def test_crop_preview_service_rejects_non_crop_compatible_extension():
    logger = RecordingLogger()
    expander = FlakyPayloadExpander(failures_before_success=0)
    service = CropPreviewService(
        logger,
        expander,
        unsupported_extensions=UNSUPPORTED_EXTENSIONS,
        max_attempts=3,
    )

    result = service.build_preview("document.pdf", _png_bytes())

    assert not result.is_successful
    assert expander.calls == 0
    assert "not compatible" in result.error


class MalformedPayloadExpander:
    """Returns success with bytes that look valid to the expander but are
    rejected by the actual image decoder. Used to verify the service
    surfaces the decode failure instead of looping through retries."""

    def __init__(self):
        self.calls = 0

    def expand(self, source_name, data):
        self.calls += 1
        return Result.success(
            [PagePayload(data=b"not-an-image", page_index=None, label=source_name)]
        )


def test_crop_preview_service_fails_fast_on_undecodable_payload(monkeypatch):
    monkeypatch.setattr(
        "backend.image_converter.presentation.web.services.crop_preview_service.time.sleep",
        lambda _seconds: None,
    )
    logger = RecordingLogger()
    expander = MalformedPayloadExpander()
    service = CropPreviewService(
        logger,
        expander,
        unsupported_extensions=UNSUPPORTED_EXTENSIONS,
        max_attempts=5,
    )

    result = service.build_preview("malformed.png", _png_bytes()[:8], request_id="unit-malformed")

    assert not result.is_successful
    assert expander.calls == 1
    assert any(lvl == "error" for _, lvl in logger.messages)
