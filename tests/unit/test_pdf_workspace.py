from contextlib import closing
from io import BytesIO

import pypdfium2 as pdfium
import pytest
from flask import Flask
from fpdf import FPDF
from PIL import Image
from werkzeug.datastructures import FileStorage

from backend.image_converter.infrastructure.pdfium_lock import PDFIUM_LOCK
from backend.image_converter.domain.pdf_workspace import PdfWorkspaceSettings
from backend.image_converter.presentation.web.services.pdf_workspace_service import (
    PdfWorkspaceError,
    PdfWorkspaceService,
)


def pdf_bytes(*labels):
    pdf = FPDF(unit="pt", format=(300, 400))
    for label in labels:
        pdf.add_page()
        pdf.set_font("Helvetica", size=14)
        pdf.text(30, 40, label)
    return bytes(pdf.output())


def upload(data, name="document.pdf"):
    return FileStorage(BytesIO(data), filename=name)


def image_bytes():
    with BytesIO() as buffer:
        with Image.new("RGBA", (120, 80), (255, 0, 0, 0)) as image:
            image.save(buffer, format="PNG")
        return buffer.getvalue()


def test_merge_mixed_sources_rebuilds_pages_as_images_in_selected_order():
    service = PdfWorkspaceService()
    # Same names intentionally: sources must be addressed by index, not filename.
    first = upload(pdf_bytes("KEEP FIRST", "EXCLUDE THIS"))
    second = upload(pdf_bytes("KEEP SECOND"))
    image = upload(image_bytes(), "transparent.png")
    merged = service.merge([first, second, image], [
        {"source": 1, "page": 0, "rotation": 90},
        {"source": 2, "page": 0},
        {"source": 0, "page": 0},
    ])
    with PDFIUM_LOCK, pdfium.PdfDocument(merged) as document:
        assert len(document) == 3
        with closing(document[0]) as page, closing(page.get_textpage()) as text:
            assert text.get_text_range() == ""
            assert all(obj.type == pdfium.raw.FPDF_PAGEOBJ_IMAGE for obj in page.get_objects())
            assert page.get_rotation() == 90
            assert page.get_size() == (400, 300)
        with closing(document[1]) as page:
            assert page.get_size() == (90, 60)  # image at 96 DPI
            with closing(page.render()) as bitmap, bitmap.to_pil() as rendered:
                assert rendered.convert("RGB").getpixel((20, 20)) == (255, 255, 255)
        with closing(document[2]) as page, closing(page.get_textpage()) as text:
            assert text.get_text_range() == ""
            assert page.get_size() == (300, 400)


def test_preview_includes_every_page_and_supports_large_single_page():
    service = PdfWorkspaceService()
    source = upload(pdf_bytes("ONE", "TWO", "THREE"))
    preview = service.preview(source)
    assert preview["count"] == 3
    assert [page["page"] for page in preview["pages"]] == [0, 1, 2]
    assert preview["pages"][0]["width"] == 300
    import base64

    def size(page):
        with Image.open(BytesIO(base64.b64decode(page["preview"].split(",")[1]))) as image:
            return image.size

    assert max(size(preview["pages"][0])) <= 360
    large = service.preview(source, 1)
    assert len(large["pages"]) == 1
    assert large["pages"][0]["page"] == 1
    assert max(size(large["pages"][0])) > 360
    with pytest.raises(PdfWorkspaceError, match="page number"):
        service.preview(source, 3)


def test_rotation_is_relative_to_existing_rotation():
    with PDFIUM_LOCK, pdfium.PdfDocument(pdf_bytes("ROTATED")) as document:
        with closing(document[0]) as page:
            page.set_rotation(90)
        buffer = BytesIO()
        document.save(buffer)
    result = PdfWorkspaceService().merge([upload(buffer.getvalue())], [{"source": 0, "page": 0, "rotation": 90}])
    with PDFIUM_LOCK, pdfium.PdfDocument(result) as document, closing(document[0]) as page:
        # The source rotation is baked into the pixels; the extra turn is applied afterwards.
        assert page.get_rotation() == 90
        assert page.get_size() == (300, 400)


@pytest.mark.parametrize("selection", [
    None, {}, [], [None], [{"source": 0}],
    [{"source": -1, "page": 0}], [{"source": 1, "page": 0}],
    [{"source": True, "page": 0}], [{"source": 0, "page": True}],
    [{"source": 0, "page": -1}], [{"source": 0, "page": 2}],
    [{"source": 0, "page": 0, "rotation": 45}],
    [{"source": 0, "page": 0, "rotation": "90"}],
    [{"source": 0, "page": 0}] * 501,
])
def test_merge_rejects_invalid_or_empty_selection(selection):
    with pytest.raises(PdfWorkspaceError):
        PdfWorkspaceService().merge([upload(pdf_bytes("TEST"))], selection)


def test_bad_uploads_fail_without_losing_other_sources(monkeypatch):
    service = PdfWorkspaceService()
    for source in (None, upload(b"not a PDF"), upload(b"not an image", "bad.png")):
        with pytest.raises(PdfWorkspaceError):
            service.preview(source)
    monkeypatch.setattr("backend.image_converter.infrastructure.editor_asset_store.max_upload_bytes", lambda: 1)
    with pytest.raises(PdfWorkspaceError, match="too large"):
        service.preview(upload(image_bytes(), "image.png"))


def test_preview_rejects_over_page_limit(monkeypatch):
    monkeypatch.setattr("backend.image_converter.presentation.web.services.pdf_workspace_service.MAX_PAGES", 2)
    with pytest.raises(PdfWorkspaceError, match="between 1 and 2"):
        PdfWorkspaceService().preview(upload(pdf_bytes("A", "B", "C")))


def test_workspace_routes_validate_requests_and_return_pdf():
    from backend.image_converter.presentation.web.routes import api_blueprint

    app = Flask(__name__)
    app.register_blueprint(api_blueprint, url_prefix="/api")
    client = app.test_client()
    assert client.post("/api/pdf/preview").status_code == 400
    assert client.post("/api/pdf/preview", data={"page": "abc"}).status_code == 400
    assert client.post("/api/pdf/merge", data={"pages": "bad json"}).status_code == 400
    assert client.post("/api/pdf/merge", data={"pages": "[]"}).status_code == 400
    preview = client.post("/api/pdf/preview", data={"file": (BytesIO(pdf_bytes("A", "B")), "test.pdf")})
    assert preview.status_code == 200
    assert len(preview.json["pages"]) == 2
    assert preview.headers["Cache-Control"] == "no-store"
    response = client.post("/api/pdf/merge", data={
        "files": (BytesIO(pdf_bytes("A", "B")), "test.pdf"),
        "pages": '[{"source":0,"page":1}]',
    })
    assert response.status_code == 200
    assert response.mimetype == "application/pdf"
    assert "merged.pdf" in response.headers["Content-Disposition"]
    assert response.headers["Cache-Control"] == "no-store"
    with PDFIUM_LOCK, pdfium.PdfDocument(response.data) as document, closing(document[0]) as page, closing(page.get_textpage()) as text:
        assert len(document) == 1
        assert text.get_text_range() == ""


def test_new_pdf_has_no_source_attachments_links_or_metadata():
    original = FPDF(unit="pt", format=(300, 400))
    original.set_title("SOURCE-PRIVATE-TITLE")
    original.add_page()
    original.set_font("Helvetica", size=14)
    original.text(20, 40, "VISIBLE CONTENT")
    original.link(10, 10, 100, 30, "https://example.invalid/source-link")
    with PDFIUM_LOCK, pdfium.PdfDocument(bytes(original.output())) as source:
        source.new_attachment("source-script.js").set_data(b"this must not be copied")
        buffer = BytesIO()
        source.save(buffer)
        assert source.count_attachments() == 1
    result = PdfWorkspaceService().merge([upload(buffer.getvalue())], [{"source": 0, "page": 0}])
    with PDFIUM_LOCK, pdfium.PdfDocument(result) as document, closing(document[0]) as page:
        assert document.count_attachments() == 0
        assert document.get_metadata_value("Title") != "SOURCE-PRIVATE-TITLE"
        assert pdfium.raw.FPDFPage_GetAnnotCount(page) == 0
        assert all(obj.type == pdfium.raw.FPDF_PAGEOBJ_IMAGE for obj in page.get_objects())


def test_output_settings_apply_to_preview_and_export_including_pagination():
    options = PdfWorkspaceSettings.from_form({
        "apply_layout": "true", "pdf_preset": "a4-portrait", "pdf_scale": "fit",
        "pdf_margin_mm": "12", "pdf_paginate": "true", "pdf_quality": "small",
    })
    with Image.new("RGB", (240, 1400), "blue") as image, BytesIO() as buffer:
        image.save(buffer, format="PNG")
        source = upload(buffer.getvalue(), "long.png")
    service = PdfWorkspaceService()
    preview = service.preview(source, options=options)
    assert preview["count"] == 4
    assert {(item["width"], item["height"]) for item in preview["pages"]} == {(595, 842)}
    merged = service.merge([source], [{"source": 0, "page": 3}, {"source": 0, "page": 0}], options=options)
    with PDFIUM_LOCK, pdfium.PdfDocument(merged) as document, closing(document[0]) as page:
        assert len(document) == 2
        assert page.get_size() == (595, 842)
        with closing(page.render()) as bitmap, bitmap.to_pil() as rendered:
            assert rendered.convert("RGB").getpixel((10, 10)) == (255, 255, 255)


def test_merge_mode_ignores_regular_conversion_layout_settings():
    options = PdfWorkspaceSettings.from_form({
        "apply_layout": "false", "pdf_preset": "a4-portrait", "pdf_scale": "fill",
        "pdf_margin_mm": "20", "pdf_paginate": "true", "pdf_quality": "small",
    })
    result = PdfWorkspaceService().preview(upload(pdf_bytes("ORIGINAL")), options=options)
    assert result["count"] == 1
    assert (result["pages"][0]["width"], result["pages"][0]["height"]) == (300, 400)


@pytest.mark.parametrize("field,value", [
    ("pdf_preset", "invalid"), ("pdf_scale", "invalid"), ("pdf_quality", "invalid"),
    ("pdf_margin_mm", "nan"), ("pdf_margin_mm", "inf"), ("pdf_margin_mm", "-1"),
    ("pdf_margin_mm", "31"),
])
def test_rejects_invalid_layout_settings(field, value):
    with pytest.raises(ValueError):
        PdfWorkspaceSettings.from_form({"apply_layout": "true", field: value})


def test_ocr_receives_only_new_pixels_and_adds_a_fresh_text_layer(monkeypatch):
    service = PdfWorkspaceService()
    monkeypatch.setattr(service.ocr, "status", lambda: {"available": True, "languages": ["eng"]})
    calls = []

    def recognize(image, language, dpi):
        assert isinstance(image, Image.Image)
        calls.append((image.size, language, dpi))
        return pdf_bytes("NEWLY RECOGNIZED TEXT")

    monkeypatch.setattr(service.ocr, "recognize", recognize)
    result = service.merge([upload(pdf_bytes("OLD SOURCE TEXT"))], [{"source": 0, "page": 0}], ocr=True, language="eng")
    assert len(calls) == 1
    assert calls[0][1:] == ("eng", 300)
    with PDFIUM_LOCK, pdfium.PdfDocument(result) as document, closing(document[0]) as page, closing(page.get_textpage()) as text:
        assert page.get_size() == (300, 400)
        assert "NEWLY RECOGNIZED TEXT" in text.get_text_range()
        assert "OLD SOURCE TEXT" not in text.get_text_range()


def test_ocr_checks_installation_and_languages_before_reading_sources(monkeypatch):
    service = PdfWorkspaceService()
    monkeypatch.setattr(service.ocr, "status", lambda: {"available": False, "languages": []})
    with pytest.raises(PdfWorkspaceError, match="not installed"):
        service.merge([None], [{"source": 0, "page": 0}], ocr=True, language="eng")
    monkeypatch.setattr(service.ocr, "status", lambda: {"available": True, "languages": ["eng"]})
    with pytest.raises(PdfWorkspaceError, match="installed OCR language"):
        service.merge([None], [{"source": 0, "page": 0}], ocr=True, language="eng; echo bad")
