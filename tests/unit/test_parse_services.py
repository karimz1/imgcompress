"""Unit tests for `extract_form_data` — verifies the typed DTO contract."""

import io

from werkzeug.datastructures import FileStorage
from werkzeug.test import EnvironBuilder
from werkzeug.wrappers import Request

from backend.image_converter.application.dtos import CompressionFormData
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.presentation.web.parse_services import extract_form_data


class _Logger:
    def __init__(self):
        self.messages = []

    def log(self, message, level="info"):
        self.messages.append((level, message))


def _build_request(form: dict, files: dict | None = None) -> Request:
    file_storages = []
    if files:
        for field, (data, filename) in files.items():
            file_storages.append((field, FileStorage(stream=io.BytesIO(data), filename=filename)))
    builder = EnvironBuilder(method="POST", data={**form, **dict(file_storages)})
    return Request(builder.get_environ())


def test_extract_form_data_returns_typed_dto():
    request = _build_request(
        {"format": "PNG", "quality": "80", "width": "1024", "use_rembg": "true"},
        {"files[]": (b"\x89PNG\r\n\x1a\n" + b"x" * 100, "x.png")},
    )

    result = extract_form_data(request, _Logger())

    assert result.is_successful
    form_data = result.value
    assert isinstance(form_data, CompressionFormData)
    assert form_data.image_format is ImageFormat.PNG
    assert form_data.quality == 80
    assert form_data.width == 1024
    assert form_data.use_rembg is True


def test_extract_form_data_rejects_unsupported_extensions():
    request = _build_request(
        {"format": "png"},
        {"files[]": (b"x", "evil.exe")},
    )

    result = extract_form_data(request, _Logger())

    assert not result.is_successful
    assert "Unsupported file types" in result.error


def test_extract_form_data_rejects_unknown_image_format():
    request = _build_request(
        {"format": "bmp"},
        {"files[]": (b"x", "image.png")},
    )

    result = extract_form_data(request, _Logger())

    assert not result.is_successful
    assert "Unsupported image format" in result.error


def test_extract_form_data_falls_back_to_defaults():
    request = _build_request(
        {},
        {"files[]": (b"x", "image.png")},
    )

    result = extract_form_data(request, _Logger())

    assert result.is_successful
    form_data = result.value
    assert form_data.image_format is ImageFormat.JPEG
    assert form_data.quality == 85
    assert form_data.width is None
    assert form_data.target_size_kb is None
    assert form_data.use_rembg is False
    assert form_data.pdf_paginate is False


def test_extract_form_data_clamps_pdf_margin():
    request = _build_request(
        {"format": "pdf", "pdf_margin_mm": "999"},
        {"files[]": (b"x", "image.png")},
    )

    form_data = extract_form_data(request, _Logger()).value

    assert form_data.pdf_margin_mm == 30.0
