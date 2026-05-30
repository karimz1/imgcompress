"""Unit tests for CropBitmapRequestService.

Pins the spool-to-disk contract: uploads are written to a temp file before
the preview service is invoked, the preview service sees a real on-disk
path with the upload's full content, and the temp file is cleaned up
afterward whether the preview succeeded or failed.
"""

from __future__ import annotations

import io
import os

from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.presentation.web.services.crop_bitmap_request_service import (
    CropBitmapRequestService,
)


class _SizedStream:
    def __init__(self, payload: bytes):
        self._buffer = io.BytesIO(payload)

    def read(self, size: int = -1) -> bytes:
        return self._buffer.read(size)


class _Upload:
    def __init__(self, filename: str, payload: bytes):
        self.filename = filename
        self.stream = _SizedStream(payload)


class _RecordingPreviewService:
    def __init__(self, response):
        self._response = response
        self.seen_path = None
        self.seen_size = None
        self.seen_payload = None

    def build_preview_from_file(self, filename: str, file_path: str):
        self.seen_path = file_path
        self.seen_size = os.path.getsize(file_path)
        with open(file_path, "rb") as handle:
            self.seen_payload = handle.read()
        assert filename
        return self._response


def test_build_spools_upload_to_disk_and_cleans_up_on_success(tmp_path):
    payload = b"PNG-PAYLOAD" * 1024
    preview = _RecordingPreviewService(Result.success(io.BytesIO(b"\x89PNG\r\n\x1a\n")))
    service = CropBitmapRequestService(preview, str(tmp_path))

    response = service.build({"file": _Upload("photo.psd", payload)})

    assert response.is_successful
    assert response.status_code == 200
    assert preview.seen_path is not None
    assert preview.seen_size == len(payload)
    assert preview.seen_payload == payload
    assert not os.path.exists(preview.seen_path)


def test_build_cleans_up_temp_file_when_preview_fails(tmp_path):
    preview = _RecordingPreviewService(Result.failure("decode error"))
    service = CropBitmapRequestService(preview, str(tmp_path))

    response = service.build({"file": _Upload("photo.psd", b"data")})

    assert not response.is_successful
    assert response.status_code == 415
    assert preview.seen_path is not None
    assert not os.path.exists(preview.seen_path)


def test_build_rejects_missing_file_with_400(tmp_path):
    preview = _RecordingPreviewService(Result.success(io.BytesIO()))
    service = CropBitmapRequestService(preview, str(tmp_path))

    response = service.build({})

    assert not response.is_successful
    assert response.status_code == 400
    assert preview.seen_path is None


def test_build_rejects_empty_filename_with_400(tmp_path):
    preview = _RecordingPreviewService(Result.success(io.BytesIO()))
    service = CropBitmapRequestService(preview, str(tmp_path))

    response = service.build({"file": _Upload("   ", b"data")})

    assert not response.is_successful
    assert response.status_code == 400
    assert preview.seen_path is None


def test_build_rejects_empty_upload_body_with_400(tmp_path):
    preview = _RecordingPreviewService(Result.success(io.BytesIO()))
    service = CropBitmapRequestService(preview, str(tmp_path))

    response = service.build({"file": _Upload("photo.psd", b"")})

    assert not response.is_successful
    assert response.status_code == 400
    assert preview.seen_path is None
