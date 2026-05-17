"""Regression tests for the HTTP error handlers.

These tests pin the wire contract returned to the client for HTTPExceptions,
so future refactors cannot silently re-introduce stacktrace or internal
exception detail leakage in 500 responses.
"""

from __future__ import annotations

import json

from werkzeug.exceptions import BadRequest, Forbidden, InternalServerError

from backend.image_converter.presentation.web.error_handlers import (
    handle_http_exception,
)
from backend.image_converter.presentation.web.server import app


def _invoke(exception):
    with app.test_request_context():
        response, status_code = handle_http_exception(exception)
    body = json.loads(response.get_data(as_text=True))
    return status_code, body


def test_500_response_does_not_include_stacktrace():
    status_code, body = _invoke(InternalServerError())

    assert status_code == 500
    assert "stacktrace" not in body
    assert "traceback" not in {key.lower() for key in body.keys()}


def test_500_response_does_not_leak_traceback_in_any_field():
    try:
        raise RuntimeError("boom: secret/internal/path/to/file.py:42")
    except RuntimeError:
        status_code, body = _invoke(InternalServerError())

    assert status_code == 500
    for value in body.values():
        text = str(value)
        assert "Traceback" not in text
        assert "RuntimeError" not in text
        assert "secret/internal/path" not in text


def test_400_response_has_expected_shape():
    status_code, body = _invoke(BadRequest(description="missing field"))

    assert status_code == 400
    assert body["code"] == 400
    assert body["error"] == "Bad Request"
    assert body["description"] == "missing field"
    assert "stacktrace" not in body


def test_403_response_has_expected_shape():
    status_code, body = _invoke(Forbidden(description="not allowed"))

    assert status_code == 403
    assert body["code"] == 403
    assert "stacktrace" not in body
