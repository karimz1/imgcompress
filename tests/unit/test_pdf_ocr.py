from types import SimpleNamespace
import subprocess

from PIL import Image
import pytest

from backend.image_converter.infrastructure.pdf_ocr import PdfOcr, PdfOcrError


def test_ocr_discovery_filters_headers_and_orientation_model(monkeypatch):
    monkeypatch.setattr(PdfOcr, "executable", staticmethod(lambda: "/tools/tesseract"))
    monkeypatch.setattr(subprocess, "run", lambda *args, **kwargs: SimpleNamespace(stdout='List of available languages in "/models" (3):\ndeu\neng\nosd\n'))
    assert PdfOcr().status() == {"available": True, "languages": ["deu", "eng"]}


def test_ocr_is_optional_when_binary_or_models_are_missing(monkeypatch):
    monkeypatch.setattr(PdfOcr, "executable", staticmethod(lambda: None))
    assert PdfOcr().status() == {"available": False, "languages": []}
    with Image.new("RGB", (10, 10)) as image, pytest.raises(PdfOcrError, match="not installed"):
        PdfOcr().recognize(image, "eng")


def test_ocr_uses_pixels_on_stdin_and_an_argument_list_without_a_shell(monkeypatch):
    monkeypatch.setattr(PdfOcr, "executable", staticmethod(lambda: "/tools/tesseract"))
    calls = []

    def run(args, **kwargs):
        calls.append((args, kwargs))
        return SimpleNamespace(stdout=b"%PDF-OCR-result")

    monkeypatch.setattr(subprocess, "run", run)
    with Image.new("RGB", (20, 30), "white") as image:
        assert PdfOcr().recognize(image, "deu") == b"%PDF-OCR-result"
    args, kwargs = calls[0]
    assert args == ["/tools/tesseract", "stdin", "stdout", "-l", "deu", "--dpi", "300", "pdf"]
    assert kwargs["input"].startswith(b"\x89PNG")
    assert not kwargs.get("shell")
    assert kwargs["timeout"] == 180


def test_ocr_timeout_is_a_recoverable_error(monkeypatch):
    monkeypatch.setattr(PdfOcr, "executable", staticmethod(lambda: "/tools/tesseract"))

    def timeout(*args, **kwargs):
        raise subprocess.TimeoutExpired("tesseract", 180)

    monkeypatch.setattr(subprocess, "run", timeout)
    with Image.new("RGB", (10, 10)) as image, pytest.raises(PdfOcrError, match="Text recognition failed"):
        PdfOcr().recognize(image, "eng")
