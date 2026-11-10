"""Real offline OCR, required in the focused PDF CI job and optional on native setups."""

from contextlib import closing
from io import BytesIO
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
import pypdfium2 as pdfium
import pytest
from werkzeug.datastructures import FileStorage

from backend.image_converter.infrastructure.pdfium_lock import PDFIUM_LOCK
from backend.image_converter.presentation.web.services.pdf_workspace_service import PdfWorkspaceService


def test_real_ocr_adds_searchable_text_only_after_rasterization():
    service = PdfWorkspaceService()
    status = service.ocr.status()
    if not status["available"] or "eng" not in status["languages"]:
        if os.environ.get("IMGCOMPRESS_REQUIRE_OCR") == "true":
            pytest.fail("This CI job requires local Tesseract with English language data.")
        pytest.skip("Tesseract with English data is not installed on this native setup.")
    font_path = Path(__file__).resolve().parents[2] / "backend/image_converter/assets/fonts/inter/Inter-Regular.ttf"
    with Image.new("RGB", (1600, 500), "white") as image, BytesIO() as buffer:
        ImageDraw.Draw(image).text((80, 100), "HELLO OCR DOCUMENT", font=ImageFont.truetype(str(font_path), 80), fill="black")
        image.save(buffer, format="PNG")
        source = FileStorage(BytesIO(buffer.getvalue()), filename="ocr-input.png")
    plan = [{"source": 0, "page": 0}]
    plain = service.merge([source], plan)
    with PDFIUM_LOCK, pdfium.PdfDocument(plain) as document, closing(document[0]) as page, closing(page.get_textpage()) as text:
        assert text.get_text_range() == ""
    recognized = service.merge([source], plan, ocr=True, language="eng")
    with PDFIUM_LOCK, pdfium.PdfDocument(recognized) as document, closing(document[0]) as page, closing(page.get_textpage()) as text:
        assert "HELLO" in text.get_text_range()
        assert "OCR" in text.get_text_range()
        assert page.get_size() == (1200, 375)
        assert document.count_attachments() == 0
