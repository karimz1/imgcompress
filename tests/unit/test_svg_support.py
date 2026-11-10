import base64
import sys
from gzip import compress
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
from backend.image_converter.domain.fit_to_size import FitAnchor, FitMode, FitToSize
from backend.image_converter.domain.image_resizer import ImageResizer
from backend.image_converter.domain.upscaling import UpscaleTarget
from backend.image_converter.infrastructure.local_storage import LocalStorage
from backend.image_converter.infrastructure.svg_renderer import (
    SvgRenderer,
    wrap_svg_crop,
)
from backend.image_converter.presentation.web.services.configuration_service import (
    ConfigurationService,
)
from backend.image_converter.presentation.web.services.crop_preview_service import (
    CropPreviewService,
)

SAMPLE_SVG = Path("tests/sample-images/svg-import.svg").read_bytes()
FINE_DETAIL_SVG = b"""<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">
  <rect x="4.2" width="0.1" height="10" fill="red"/>
</svg>"""


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
        assert image.convert("RGBA").getpixel((10, 10)) == (255, 0, 0, 255)


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


@pytest.mark.parametrize("element", ["image", "use"])
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
    assert "external references" in result.error


def test_embedded_image_is_rendered():
    buffer = BytesIO()
    Image.new("RGB", (2, 2), "red").save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode()
    data = f'<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><image href="data:image/png;base64,{encoded}" width="2" height="2"/></svg>'.encode()
    result = SvgRenderer().render("embedded.svg", data)
    assert result.is_successful, result.error
    with Image.open(BytesIO(result.value)) as image:
        assert image.convert("RGBA").getpixel((0, 0)) == (255, 0, 0, 255)


def test_css_gradient_and_partial_alpha_are_preserved():
    data = b"""<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20">
      <style>.paint { fill: url(#gradient); opacity: 0.5; }</style>
      <defs><linearGradient id="gradient">
        <stop stop-color="red"/><stop offset="1" stop-color="blue"/>
      </linearGradient></defs>
      <rect class="paint" x="5" y="5" width="30" height="10"/>
    </svg>"""
    result = SvgRenderer().render("styled.svg", data)
    assert result.is_successful, result.error
    with Image.open(BytesIO(result.value)) as image:
        left = image.getpixel((10, 10))
        right = image.getpixel((30, 10))
        assert left[0] > right[0]
        assert right[2] > left[2]
        assert left[3] in (127, 128)
        assert image.getpixel((0, 0))[3] == 0


def test_internal_use_reference_is_rendered():
    data = b"""<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">
      <defs><rect id="shape" width="10" height="10" fill="red"/></defs>
      <use href="#shape"/>
    </svg>"""
    result = SvgRenderer().render("use.svg", data)
    assert result.is_successful, result.error
    with Image.open(BytesIO(result.value)) as image:
        assert image.convert("RGBA").getpixel((5, 5)) == (255, 0, 0, 255)


@pytest.mark.parametrize(
    "import_value",
    [
        'url("{reference}")',
        "url('{reference}')",
        "url({reference})",
        '"{reference}"',
        '"{reference}" screen',
        'url("{reference}") layer(theme)',
        '/* comment */ URL( "{reference}" /* comment */ ) screen',
    ],
)
@pytest.mark.parametrize(
    "reference",
    [
        "/tmp/private.css",
        "relative.css",
        "file:///tmp/private.css",
        "https://example.com/style.css",
    ],
)
def test_external_css_import_is_rejected(import_value, reference, monkeypatch):
    fetch = MagicMock(
        side_effect=AssertionError("External resources must not be read.")
    )
    monkeypatch.setattr(
        "backend.image_converter.infrastructure.svg_renderer.urlopen", fetch
    )
    import_value = import_value.format(reference=reference)
    data = f"""<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">
      <style>@IMPORT {import_value};</style>
      <rect width="10" height="10"/>
    </svg>""".encode()
    result = SvgRenderer().render("external-css.svg", data)
    assert not result.is_successful
    assert "external references" in result.error
    fetch.assert_not_called()


def test_embedded_css_import_is_rendered():
    encoded = base64.b64encode(b"rect { fill: red; }").decode()
    data = f"""<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">
      <style>@import url(data:text/css;base64,{encoded});</style>
      <rect width="10" height="10"/>
    </svg>""".encode()
    result = SvgRenderer().render("embedded-css.svg", data)
    assert result.is_successful, result.error
    with Image.open(BytesIO(result.value)) as image:
        assert image.convert("RGBA").getpixel((5, 5)) == (255, 0, 0, 255)


def test_external_css_import_in_embedded_stylesheet_is_rejected():
    stylesheet = b'@import url("https://example.com/private.css"); rect { fill: red; }'
    encoded = base64.b64encode(stylesheet).decode()
    data = f"""<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">
      <style>@import url(data:text/css;base64,{encoded});</style>
      <rect width="10" height="10"/>
    </svg>""".encode()
    result = SvgRenderer().render("nested-css.svg", data)
    assert not result.is_successful
    assert "external references" in result.error


@pytest.mark.parametrize("element", ["image", "use"])
@pytest.mark.parametrize("media_type", ["image/svg+xml", "application/octet-stream"])
@pytest.mark.parametrize("compressed", [False, True])
def test_external_css_import_in_embedded_svg_is_rejected(
    element, media_type, compressed
):
    nested = b"""<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">
      <style>@import url("https://example.com/private.css");</style>
      <rect width="10" height="10"/>
    </svg>"""
    encoded = base64.b64encode(compress(nested) if compressed else nested).decode()
    data = f'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><{element} href="data:{media_type};base64,{encoded}" width="10" height="10"/></svg>'.encode()
    result = SvgRenderer().render("nested.svg", data)
    assert not result.is_successful
    assert "external references" in result.error


def test_css_import_text_in_comments_and_strings_is_not_rejected():
    data = b"""<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">
      <style>
        /* @import url("https://example.com/comment.css"); */
        rect { fill: red; content: '@import url("https://example.com/string.css");'; }
      </style>
      <rect width="10" height="10"/>
    </svg>"""
    result = SvgRenderer().render("css-text.svg", data)
    assert result.is_successful, result.error
    with Image.open(BytesIO(result.value)) as image:
        assert image.convert("RGBA").getpixel((5, 5)) == (255, 0, 0, 255)


def test_external_image_in_embedded_svg_is_rejected():
    nested = b"""<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">
      <image href="https://example.com/private.png" width="10" height="10"/>
    </svg>"""
    encoded = base64.b64encode(nested).decode()
    data = f'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><image href="data:image/svg+xml;base64,{encoded}" width="10" height="10"/></svg>'.encode()
    result = SvgRenderer().render("nested.svg", data)
    assert not result.is_successful
    assert "external references" in result.error


def test_renderer_is_lazy_loaded_and_missing_dependency_is_reported(monkeypatch):
    for module in tuple(sys.modules):
        if module == "cairosvg" or module.startswith("cairosvg."):
            monkeypatch.delitem(sys.modules, module)
    renderer = SvgRenderer()
    assert "cairosvg" not in sys.modules
    monkeypatch.setitem(sys.modules, "cairosvg", None)
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
        assert image.size == (2048, 1365)
        assert image.getpixel((0, 0))[3] == 0
    assert result.value.source_size == (120, 80)


def test_svg_requested_width_renders_subpixel_detail_from_vectors():
    result = SvgRenderer().render("detail.svg", FINE_DETAIL_SVG, width=100)
    assert result.is_successful, result.error
    with Image.open(BytesIO(result.value)) as image:
        assert image.size == (100, 100)
        assert image.getpixel((42, 50)) == (255, 0, 0, 255)


def test_svg_resize_keeps_the_full_width_when_height_is_fractional():
    data = b'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="7"><rect width="13" height="7" fill="blue"/></svg>'
    result = SvgRenderer().render("fractional.svg", data, width=100)
    assert result.is_successful, result.error
    with Image.open(BytesIO(result.value)) as image:
        assert image.size == (100, 54)
        assert image.convert("RGBA").getpixel((0, 20)) == (0, 0, 255, 255)
        assert image.convert("RGBA").getpixel((99, 20)) == (0, 0, 255, 255)


@pytest.mark.parametrize(
    "attributes", ['viewBox="0 0 10 5"', 'width="1in" height="0.5in"']
)
def test_svg_resize_resolves_viewbox_and_physical_units(attributes):
    data = f'<svg xmlns="http://www.w3.org/2000/svg" {attributes}><rect width="100%" height="100%" fill="red"/></svg>'.encode()
    result = SvgRenderer().render("units.svg", data, width=100)
    assert result.is_successful, result.error
    with Image.open(BytesIO(result.value)) as image:
        assert image.size == (100, 50)
        assert image.getpixel((50, 25)) == (255, 0, 0)


@pytest.mark.parametrize(
    ("target", "expected_size"),
    [
        (UpscaleTarget.X2, (20, 20)),
        (UpscaleTarget.X8, (80, 80)),
        (UpscaleTarget.FULL_HD, (1080, 1080)),
    ],
)
def test_svg_upscale_targets_render_without_ai(target, expected_size):
    result = SvgRenderer().render("detail.svg", FINE_DETAIL_SVG, upscale=target)
    assert result.is_successful, result.error
    with Image.open(BytesIO(result.value)) as image:
        assert image.size == expected_size


def test_svg_resize_limit_is_checked_before_allocating_a_surface(monkeypatch):
    import cairosvg.surface

    surface = MagicMock(
        side_effect=AssertionError("Oversized surface must not be allocated.")
    )
    monkeypatch.setattr(cairosvg.surface, "PNGSurface", surface)
    monkeypatch.setattr(SvgRenderer, "_max_output_pixels", staticmethod(lambda: 10_000))
    result = SvgRenderer().render("large.svg", FINE_DETAIL_SVG, width=101)
    assert not result.is_successful
    assert "MP limit" in result.error
    surface.assert_not_called()


@pytest.mark.parametrize("mode", [FitMode.CROP, FitMode.BLUR])
def test_svg_fit_preserves_detail_at_the_output_resolution(mode):
    result = SvgRenderer().render(
        "detail.svg", FINE_DETAIL_SVG, fit=FitToSize(100, 100, mode, FitAnchor.CENTER)
    )
    assert result.is_successful, result.error
    with Image.open(BytesIO(result.value)) as image:
        assert image.size == (100, 100)
        assert image.convert("RGBA").getpixel((42, 50)) == (255, 0, 0, 255)


def test_svg_crop_keeps_vectors_until_the_final_resize():
    cropped = wrap_svg_crop(FINE_DETAIL_SVG, (10, 10), (4, 0, 1, 10))
    result = SvgRenderer().render("cropped.svg", cropped, width=100)
    assert result.is_successful, result.error
    with Image.open(BytesIO(result.value)) as image:
        assert image.size == (100, 1000)
        assert image.getpixel((20, 500)) == (255, 0, 0, 255)


@pytest.mark.parametrize("encoding", ["utf-8", "utf-16"])
def test_cropped_svg_keeps_prefixed_namespaces_and_xml_encoding(encoding):
    data = f'''<?xml version="1.0" encoding="{encoding}"?>
      <s:svg xmlns:s="http://www.w3.org/2000/svg" width="10" height="10">
        <s:rect x="4.2" width="0.1" height="10" fill="red"/>
      </s:svg>'''.encode(encoding)
    cropped = wrap_svg_crop(data, (10, 10), (0, 0, 10, 10))
    result = SvgRenderer().render("cropped.svg", cropped, width=100)
    assert result.is_successful, result.error
    with Image.open(BytesIO(result.value)) as image:
        assert image.getpixel((42, 50)) == (255, 0, 0, 255)


@pytest.mark.parametrize("upscale", [None, UpscaleTarget.X8])
def test_svg_cli_sizing_uses_vectors_and_keeps_original_dimensions(
    tmp_path, monkeypatch, upscale
):
    source = tmp_path / "detail.svg"
    source.write_bytes(FINE_DETAIL_SVG)
    destination = tmp_path / "out"
    processor = ImageConversionProcessor(
        str(source), str(destination), ImageFormat.PNG, width=100, upscale=upscale
    )
    monkeypatch.setattr(
        processor, "_get_upscaler", lambda: pytest.fail("SVG must not use AI.")
    )
    monkeypatch.setattr(
        processor.image_resizer,
        "resize_image",
        lambda *_: pytest.fail("SVG must not be resized as pixels."),
    )
    processor.run()
    assert processor.results[0].is_successful, processor.results[0].error
    assert processor.results[0].original_width == 10
    expected_width = 80 if upscale else 100
    assert processor.results[0].resized_width == expected_width
    with Image.open(destination / "detail.png") as image:
        assert image.size == (expected_width, expected_width)
        if not upscale:
            assert image.getpixel((42, 50)) == (255, 0, 0, 255)


@pytest.mark.parametrize("upscale", [None, UpscaleTarget.X8])
def test_svg_web_sizing_uses_vectors_without_an_ai_suffix(
    tmp_path, monkeypatch, upscale
):
    source, destination = tmp_path / "source", tmp_path / "out"
    source.mkdir()
    destination.mkdir()
    (source / "detail.svg").write_bytes(FINE_DETAIL_SVG)
    logger = MagicMock()
    resizer = ImageResizer()
    use_case = CompressImagesUseCase(
        logger,
        resizer,
        ImageConverterFactory,
        LocalStorage(),
        create_payload_expander(logger),
    )
    monkeypatch.setattr(
        use_case, "_get_upscaler", lambda: pytest.fail("SVG must not use AI.")
    )
    monkeypatch.setattr(
        resizer,
        "resize_image",
        lambda *_: pytest.fail("SVG must not be resized as pixels."),
    )
    result = use_case.execute(
        CompressRequest(
            str(source),
            str(destination),
            ImageFormat.PNG,
            85,
            100,
            None,
            upscale=upscale,
        )
    )
    assert not result.errors
    assert result.processed_files == ["detail.png"]
    expected_width = 80 if upscale else 100
    with Image.open(destination / "detail.png") as image:
        assert image.size == (expected_width, expected_width)
        if not upscale:
            assert image.getpixel((42, 50)) == (255, 0, 0, 255)


def test_svg_crop_bitmap_api_keeps_original_coordinates_with_a_sharp_preview():
    from backend.image_converter.presentation.web.server import app

    response = app.test_client().post(
        "/api/crop/bitmap",
        data={"file": (BytesIO(FINE_DETAIL_SVG), "detail.svg")},
    )
    assert response.status_code == 200
    assert response.headers["X-Image-Width"] == "10"
    assert response.headers["X-Image-Height"] == "10"
    with Image.open(BytesIO(response.data)) as image:
        assert image.size == (2048, 2048)
        assert image.getpixel((870, 1000)) == (255, 0, 0, 255)


def test_mixed_svg_and_bitmap_batch_only_uses_ai_for_the_bitmap(tmp_path):
    source, destination = tmp_path / "source", tmp_path / "out"
    source.mkdir()
    destination.mkdir()
    (source / "detail.svg").write_bytes(FINE_DETAIL_SVG)
    Image.new("RGB", (10, 10), "blue").save(source / "photo.png")
    upscaled = BytesIO()
    Image.new("RGB", (80, 80), "blue").save(upscaled, format="PNG")
    upscaler = MagicMock()
    upscaler.upscale.return_value = upscaled.getvalue()
    logger = MagicMock()
    use_case = CompressImagesUseCase(
        logger,
        ImageResizer(),
        ImageConverterFactory,
        LocalStorage(),
        create_payload_expander(logger),
        upscaler=upscaler,
    )
    result = use_case.execute(
        CompressRequest(
            str(source),
            str(destination),
            ImageFormat.PNG,
            85,
            None,
            None,
            upscale=UpscaleTarget.X8,
        )
    )
    assert not result.errors
    assert set(result.processed_files) == {"detail.png", "photo_ai-upscaled.png"}
    upscaler.upscale.assert_called_once()
    with Image.open(BytesIO(upscaler.upscale.call_args.args[0])) as image:
        assert image.convert("RGB").getpixel((0, 0)) == (0, 0, 255)


@pytest.mark.parametrize("mode", ["crop", "blur"])
def test_svg_fit_api_draws_vectors_and_replays_saved_selection(mode):
    from backend.image_converter.presentation.web.server import app

    client = app.test_client()
    fields = {"fit_width": "100", "fit_height": "100", "fit_mode": mode}
    response = client.post(
        "/api/crop/fit",
        data={**fields, "file": (BytesIO(FINE_DETAIL_SVG), "detail.svg")},
    )
    assert response.status_code == 200, response.json
    crop = response.json["crop"]
    assert (crop["originalWidth"], crop["originalHeight"]) == (10, 10)
    preview = base64.b64decode(response.json["preview"].split(",", 1)[1])
    with Image.open(BytesIO(preview)) as image:
        assert image.size == (100, 100)
        assert image.convert("RGBA").getpixel((42, 50)) == (255, 0, 0, 255)
    # The browser exports a clipped SVG instead of sending its preview PNG.
    clipped = wrap_svg_crop(
        FINE_DETAIL_SVG,
        (10, 10),
        tuple(crop[key] for key in ("x", "y", "width", "height")),
    )
    replay = client.post(
        "/api/crop/fit",
        data={
            **fields,
            "render": "true",
            "file": (BytesIO(clipped), "detail_cropped.svg"),
            "crop_x": "0",
            "crop_y": "0",
            "crop_width": str(crop["width"]),
            "crop_height": str(crop["height"]),
        },
    )
    assert replay.status_code == 200
    assert replay.data == preview


def test_svg_fit_handles_extreme_aspect_ratio_without_a_giant_intermediate():
    data = b'<svg xmlns="http://www.w3.org/2000/svg" width="9000" height="1"><rect width="9000" height="1" fill="red"/></svg>'
    result = SvgRenderer().render(
        "strip.svg", data, fit=FitToSize(100, 100, FitMode.CROP, FitAnchor.CENTER)
    )
    assert result.is_successful, result.error
    with Image.open(BytesIO(result.value)) as image:
        assert image.size == (100, 100)
        assert image.getpixel((50, 50))[:3] == (255, 0, 0)
