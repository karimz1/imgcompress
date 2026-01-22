from io import BytesIO

from PIL import Image
import pypdfium2

from backend.image_converter.core.factory.pdf_converter import PdfConverter
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.domain.pdf_presets import resolve_pdf_preset


def _make_png_bytes() -> bytes:
    img = Image.new("RGBA", (64, 64), (10, 20, 30, 128))
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

def _make_rgb_bytes(width: int, height: int, color=(255, 0, 0)) -> bytes:
    img = Image.new("RGB", (width, height), color)
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_When_ConvertingToPdf_Expect_PdfHeader(tmp_path):
    logger = Logger(debug=False, json_output=False)
    converter = PdfConverter(logger=logger)

    image_data = _make_png_bytes()
    out_path = tmp_path / "sample.pdf"

    result = converter.convert(image_data, "source.png", str(out_path))

    assert result.is_successful
    data = out_path.read_bytes()
    assert data.startswith(b"%PDF")


def test_When_UsingA4AutoPreset_Expect_LandscapePageSize():
    preset_res = resolve_pdf_preset("a4-auto")
    assert preset_res.is_successful
    preset = preset_res.value

    image_data = _make_rgb_bytes(200, 100)
    converter = PdfConverter(logger=Logger(debug=False, json_output=False), pdf_preset=preset, pdf_scale="fit")
    pdf_bytes = converter.encode_to_bytes(image_data)

    pdf = pypdfium2.PdfDocument(pdf_bytes)
    page = pdf.get_page(0)
    width, height = page.get_size()
    assert (width, height) == (842.0, 595.0)


def test_When_UsingOriginalPreset_Expect_ImageSizedPage():
    image_data = _make_rgb_bytes(240, 135)
    converter = PdfConverter(logger=Logger(debug=False, json_output=False))
    pdf_bytes = converter.encode_to_bytes(image_data)

    pdf = pypdfium2.PdfDocument(pdf_bytes)
    page = pdf.get_page(0)
    width, height = page.get_size()
    assert (width, height) == (240.0, 135.0)


def test_When_PaginatingLongImage_Expect_MultiplePages():
    preset_res = resolve_pdf_preset("a4-portrait")
    assert preset_res.is_successful
    preset = preset_res.value

    image_data = _make_rgb_bytes(800, 3000)
    converter = PdfConverter(
        logger=Logger(debug=False, json_output=False),
        pdf_preset=preset,
        pdf_scale="fit",
        pdf_margin_mm=10.0,
        pdf_paginate=True,
    )
    pdf_bytes = converter.encode_to_bytes(image_data)

    pdf = pypdfium2.PdfDocument(pdf_bytes)
    assert len(pdf) >= 2
