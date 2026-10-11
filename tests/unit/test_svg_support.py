import base64
import sys
from io import BytesIO
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from PIL import Image

from backend.image_converter.application.compress_images_usecase import (
    CompressImagesUseCase,
)
from backend.image_converter.application.dtos import CompressRequest
from backend.image_converter.application.payload_expander_factory import (
    create_payload_expander,
)
from backend.image_converter.config import settings
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.core.factory.converter_factory import ImageConverterFactory
from backend.image_converter.core.image_conversion_processor import (
    ImageConversionProcessor,
)
from backend.image_converter.core.internals.utilities import is_file_supported
from backend.image_converter.domain.image_resizer import ImageResizer
from backend.image_converter.infrastructure.local_storage import LocalStorage
from backend.image_converter.infrastructure.svg_renderer import SvgRenderer
from backend.image_converter.presentation.web.services.configuration_service import (
    ConfigurationService,
)
from backend.image_converter.presentation.web.services.crop_preview_service import (
    CropPreviewService,
)

SAMPLE_SVG = Path("tests/sample-images/svg-import.svg").read_bytes()


def test_svg_is_supported_verified_and_cropable():
    assert is_file_supported("drawing.SVG")
    assert ".svg" in ConfigurationService.get_supported_formats()
    assert ".svg" in ConfigurationService.get_verified_formats()
    assert ".svg" not in settings.get().crop_preview.unsupported_input_extensions


@pytest.mark.parametrize("filename", ["drawing.svg", "drawing.SVG"])
def test_svg_expansion_preserves_dimensions_transparency_and_metadata(filename):
    result = create_payload_expander(MagicMock()).expand(filename, SAMPLE_SVG)
    assert result.is_successful, result.error
    (payload,) = result.value
    assert payload.label == filename
    assert payload.page_index is None
    with Image.open(BytesIO(payload.data)) as image:
        assert image.format == "PNG"
        assert image.size == (120, 80)
        assert image.getpixel((0, 0))[3] == 0
        assert image.getpixel((60, 40))[3] == 255


def test_svg_with_only_viewbox_has_intrinsic_dimensions():
    data = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20"><path d="M0 0h40v20H0z" fill="red"/></svg>'
    result = SvgRenderer().render("viewbox.svg", data)
    assert result.is_successful, result.error
    with Image.open(BytesIO(result.value)) as image:
        assert image.size == (40, 20)
        assert image.getpixel((10, 10)) == (255, 0, 0, 255)


@pytest.mark.parametrize(
    "data",
    [
        b"not svg",
        b"<svg",
        b"<html/>",
        b'<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"/>',
        b'<!DOCTYPE svg [<!ENTITY test "hello">]><svg xmlns="http://www.w3.org/2000/svg">&test;</svg>',
    ],
)
def test_invalid_svg_returns_failure(data):
    result = create_payload_expander(MagicMock()).expand("broken.svg", data)
    assert not result.is_successful
    assert result.error == "SVG could not be rendered."


@pytest.mark.parametrize("element", ["image", "feImage"])
@pytest.mark.parametrize("attribute", ["href", "xlink:href"])
@pytest.mark.parametrize(
    "reference",
    [
        "/tmp/private.png",
        "relative.png",
        "file:///tmp/private.png",
        "https://example.com/image.png",
    ],
)
def test_external_image_references_are_rejected(element, attribute, reference):
    data = f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="10" height="10"><{element} {attribute}="{reference}"/></svg>'.encode()
    result = SvgRenderer().render("external.svg", data)
    assert not result.is_successful
    assert "external image references" in result.error


def test_embedded_image_is_rendered():
    buffer = BytesIO()
    Image.new("RGB", (2, 2), "red").save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode()
    data = f'<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><image href="data:image/png;base64,{encoded}" width="2" height="2"/></svg>'.encode()
    result = SvgRenderer().render("embedded.svg", data)
    assert result.is_successful, result.error
    with Image.open(BytesIO(result.value)) as image:
        assert image.getpixel((0, 0)) == (255, 0, 0, 255)


def test_renderer_is_lazy_loaded_and_missing_dependency_is_reported(monkeypatch):
    monkeypatch.delitem(sys.modules, "resvg_py", raising=False)
    renderer = SvgRenderer()
    assert "resvg_py" not in sys.modules
    monkeypatch.setitem(sys.modules, "resvg_py", None)
    result = renderer.render("drawing.svg", SAMPLE_SVG)
    assert not result.is_successful
    assert "must be installed" in result.error


@pytest.mark.parametrize("output_format", list(ImageFormat))
def test_web_use_case_converts_svg_to_every_output_format(tmp_path, output_format):
    source = tmp_path / "source"
    destination = tmp_path / "converted"
    source.mkdir()
    destination.mkdir()
    (source / "drawing.svg").write_bytes(SAMPLE_SVG)
    logger = MagicMock()
    use_case = CompressImagesUseCase(
        logger,
        ImageResizer(),
        ImageConverterFactory,
        LocalStorage(),
        create_payload_expander(logger),
    )
    request = CompressRequest(
        source_folder=str(source),
        dest_folder=str(destination),
        image_format=output_format,
        quality=85,
        width=60,
        target_size=None,
    )
    result = use_case.execute(request)
    assert not result.errors
    filename = "drawing" + output_format.get_file_extension()
    assert result.processed_files == [filename]
    output = destination / filename
    if output_format == ImageFormat.PDF:
        import pypdfium2

        with pypdfium2.PdfDocument(output.read_bytes()) as document:
            assert len(document) == 1
    else:
        with Image.open(output) as image:
            assert image.width == (32 if output_format == ImageFormat.ICO else 60)
            if output_format == ImageFormat.JPEG:
                assert all(channel > 240 for channel in image.getpixel((0, 0)))
            elif output_format == ImageFormat.PNG:
                assert image.getpixel((0, 0))[3] == 0


def test_cli_directory_conversion_includes_svg(tmp_path):
    source = tmp_path / "source"
    source.mkdir()
    (source / "drawing.SVG").write_bytes(SAMPLE_SVG)
    destination = tmp_path / "converted"
    processor = ImageConversionProcessor(str(source), str(destination), ImageFormat.PNG)
    processor.run()
    assert len(processor.results) == 1
    with Image.open(destination / "drawing.png") as image:
        assert image.size == (120, 80)


def test_svg_crop_preview_renders_transparent_png():
    logger = MagicMock()
    service = CropPreviewService(logger, create_payload_expander(logger), (), 1)
    result = service.build_preview("drawing.svg", SAMPLE_SVG)
    assert result.is_successful, result.error
    with Image.open(result.value) as image:
        assert image.format == "PNG"
        assert image.size == (120, 80)
        assert image.getpixel((0, 0))[3] == 0
