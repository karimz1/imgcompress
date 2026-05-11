from __future__ import annotations

import io
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image

from backend.image_converter.application.file_payload_expander import PagePayload
from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.presentation.web import routes
from backend.image_converter.presentation.web.services.crop_bitmap_request_service import (
    CropBitmapRequestService,
)
from backend.image_converter.presentation.web.services.crop_preview_service import (
    CropPreviewService,
)


FIXTURE_DIR = (
    Path(__file__).resolve().parents[2]
    / "frontend"
    / "tests"
    / "e2e"
    / "fixtures"
    / "sample-images"
)


def _png_bytes(width: int = 128, height: int = 128, color=(255, 0, 0, 255)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGBA", (width, height), color).save(buf, format="PNG")
    return buf.getvalue()


def _read_fixture(name: str) -> bytes:
    return (FIXTURE_DIR / name).read_bytes()


def _assert_clean_png(buffer: io.BytesIO):
    buffer.seek(0)
    with Image.open(buffer) as img:
        assert img.format == "PNG"
        assert img.width > 0 and img.height > 0


def test_high_concurrency_psd_does_not_leak_state():
    psd_bytes = _read_fixture("37443511_8499861.psd")
    service = routes.crop_preview_service

    def _decode(index: int):
        result = service.build_preview(
            "37443511_8499861.psd",
            psd_bytes,
            request_id=f"stress-psd-{index:02d}",
        )
        assert result.is_successful, result.error
        _assert_clean_png(result.value)
        return result.value.getbuffer().nbytes

    parallelism = 12
    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=parallelism) as pool:
        sizes = list(pool.map(_decode, range(parallelism)))
    elapsed = time.perf_counter() - started

    assert len(sizes) == parallelism
    assert len(set(sizes)) == 1, f"PNG sizes diverged: {set(sizes)}"
    assert elapsed < 120, f"stress run took {elapsed:.1f}s"


def test_mixed_payloads_concurrently_dispatch_to_correct_paths():
    psd_bytes = _read_fixture("37443511_8499861.psd")
    pdf_bytes = _read_fixture("imgcompress_multipage_test.pdf")
    tiny_png = _png_bytes(64, 64)
    service = routes.crop_preview_service

    def _job(kind: str, idx: int):
        if kind == "psd":
            result = service.build_preview(
                "37443511_8499861.psd",
                psd_bytes,
                request_id=f"mix-psd-{idx}",
            )
            assert result.is_successful, result.error
            return "psd-ok"
        if kind == "pdf":
            result = service.build_preview(
                "imgcompress_multipage_test.pdf",
                pdf_bytes,
                request_id=f"mix-pdf-{idx}",
            )
            assert not result.is_successful
            assert "not compatible" in result.error
            return "pdf-rejected"
        if kind == "tiny":
            result = service.build_preview(
                "tiny.png",
                tiny_png,
                request_id=f"mix-tiny-{idx}",
            )
            assert result.is_successful, result.error
            return "tiny-ok"
        raise AssertionError(f"unknown kind: {kind}")

    schedule = (
        [("psd", i) for i in range(4)]
        + [("pdf", i) for i in range(4)]
        + [("tiny", i) for i in range(6)]
    )

    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(_job, kind, idx) for kind, idx in schedule]
        results = [future.result() for future in as_completed(futures)]

    assert results.count("psd-ok") == 4
    assert results.count("pdf-rejected") == 4
    assert results.count("tiny-ok") == 6


class _GeneratedStream:
    def __init__(self, size: int):
        self.remaining = size

    def read(self, size: int = -1) -> bytes:
        if self.remaining <= 0:
            return b""
        chunk_size = 65536 if size is None or size < 0 else size
        take = min(self.remaining, chunk_size)
        self.remaining -= take
        return b"x" * take


class _Upload:
    def __init__(self, filename: str, size: int):
        self.filename = filename
        self.stream = _GeneratedStream(size)


class _PreviewService:
    def __init__(self):
        self.seen_path = None
        self.seen_size = None

    def build_preview_from_file(self, filename: str, file_path: str):
        self.seen_path = file_path
        self.seen_size = os.path.getsize(file_path)
        assert filename == "generated.psd"
        assert os.path.exists(file_path)
        return Result.success(io.BytesIO(_png_bytes()))


def test_crop_bitmap_request_spools_large_upload_to_temp_file(tmp_path):
    upload_size = 96 * 1024 * 1024
    preview_service = _PreviewService()
    request_service = CropBitmapRequestService(preview_service, str(tmp_path))

    result = request_service.build({"file": _Upload("generated.psd", upload_size)})

    assert result.is_successful
    assert preview_service.seen_size == upload_size
    assert preview_service.seen_path is not None
    assert not os.path.exists(preview_service.seen_path)


def test_malformed_image_fails_fast_without_retrying(monkeypatch):
    class _Expander:
        def __init__(self):
            self.calls = 0

        def expand(self, source_name, data):
            self.calls += 1
            return Result.success(
                [PagePayload(data=b"not-an-image", page_index=None, label=source_name)]
            )

    class _Logger:
        def __init__(self):
            self.lines = []

        def log(self, message, level="info"):
            self.lines.append((level, message))

    monkeypatch.setattr(
        "backend.image_converter.presentation.web.services.crop_preview_service.time.sleep",
        lambda _seconds: None,
    )

    expander = _Expander()
    logger = _Logger()
    service = CropPreviewService(
        logger,
        expander,
        unsupported_extensions=(),
        max_attempts=5,
    )

    result = service.build_preview("malformed.png", _png_bytes()[:8], request_id="malformed")

    assert not result.is_successful
    assert expander.calls == 1
    assert any(level == "error" for level, _ in logger.lines)
