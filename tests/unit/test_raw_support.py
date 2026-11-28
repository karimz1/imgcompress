import sys
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
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
from backend.image_converter.infrastructure import raw_renderer
from backend.image_converter.infrastructure.local_storage import LocalStorage
from backend.image_converter.infrastructure.raw_renderer import (
    RAW_EXTENSIONS,
    RawRenderer,
    is_raw_file,
)
from backend.image_converter.presentation.web.services.configuration_service import (
    ConfigurationService,
)
from backend.image_converter.presentation.web.services.crop_preview_service import (
    CropPreviewService,
)

SAMPLES = Path("tests/sample-images")
# Output size after demosaicing, cropping and the camera orientation.
RAW_SAMPLES = {
    "apple-iphone-xs.dng": (4032, 3024),
    "canon-eos-r6.cr3": (3407, 2271),
    "nikon-d70s.nef": (3039, 2014),
    "sony-ilce-7s.arw": (2784, 1872),
    "fujifilm-finepix-s5000.raf": (2012, 1521),
}
DECODE_FAILURE = "Camera RAW file could not be decoded."


def _sample(name: str) -> bytes:
    return (SAMPLES / name).read_bytes()


class _FakeRaw:
    def __init__(self, width, height):
        self.sizes = SimpleNamespace(width=width, height=height)
        self.postprocess = MagicMock()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def _fake_rawpy(raw):
    return SimpleNamespace(
        imread=lambda _stream: raw,
        ColorSpace=SimpleNamespace(sRGB="sRGB"),
        DemosaicAlgorithm=SimpleNamespace(AHD="AHD"),
    )


def test_raw_formats_are_supported_and_cropable():
    config = settings.get()
    assert RAW_EXTENSIONS <= set(config.formats.custom_pipeline_extensions)
    assert RAW_EXTENSIONS <= set(ConfigurationService.get_supported_formats())
    assert not RAW_EXTENSIONS & set(config.crop_preview.unsupported_input_extensions)
    for name in RAW_SAMPLES:
        assert Path(name).suffix in ConfigurationService.get_verified_formats()
    assert is_file_supported("photo.NEF")
    assert is_raw_file("photo.Cr3")


@pytest.mark.parametrize("filename", ["photo.x3f", "photo.raw"])
def test_x3f_and_generic_raw_are_not_accepted(filename):
    assert not is_raw_file(filename)
    assert not is_file_supported(filename)


def test_bundled_libraw_has_the_known_security_fixes():
    import rawpy

    assert rawpy.libraw_version >= (0, 22, 1)


@pytest.mark.parametrize(("name", "size"), RAW_SAMPLES.items())
def test_raw_sample_decodes_to_an_srgb_png_without_metadata(name, size):
    result = create_payload_expander(MagicMock()).expand(name, _sample(name))
    assert result.is_successful, result.error
    (payload,) = result.value
    assert payload.label == name
    assert payload.page_index is None
    with Image.open(BytesIO(payload.data)) as image:
        assert image.format == "PNG"
        assert image.mode == "RGB"
        assert image.size == size
        assert not image.getexif()
        assert "icc_profile" not in image.info
        assert "exif" not in image.info
        assert "XML:com.adobe.xmp" not in image.info
        assert image.convert("L").getextrema() != (0, 0)


@pytest.mark.parametrize(
    "data",
    [
        _sample("nikon-d70s.nef")[:50_000],
        _sample("nikon-d70s.nef")[:2_500_000],
        _sample("pexels-pealdesign-28594392.jpg"),
        b"",
    ],
    ids=["truncated-header", "truncated-data", "jpeg-renamed", "empty"],
)
def test_corrupt_or_renamed_raw_fails_without_leaking_libraw_errors(data):
    logger = MagicMock()
    result = RawRenderer(logger).render("photo.nef", data)
    assert not result.is_successful
    assert result.error == DECODE_FAILURE
    logger.log.assert_called_once()
    assert logger.log.call_args.args[1] == "error"


def test_megapixel_limit_is_checked_before_decoding(monkeypatch):
    raw = _FakeRaw(width=20_000, height=10_000)
    monkeypatch.setattr(RawRenderer, "_import_rawpy", staticmethod(lambda: _fake_rawpy(raw)))
    result = RawRenderer(MagicMock()).render("huge.dng", b"data")
    assert not result.is_successful
    limit = settings.get().upscaling.max_output_megapixels
    assert result.error == (
        f"The RAW image is 20000x10000 and exceeds the {limit} MP limit."
    )
    raw.postprocess.assert_not_called()


def test_decoder_threads_follow_the_upscaling_thread_setting(monkeypatch):
    from backend.image_converter.infrastructure import ai_upscaler

    environ = {}
    monkeypatch.setattr(raw_renderer.os, "environ", environ)
    monkeypatch.setattr(ai_upscaler, "available_cpu_count", lambda: 3)
    RawRenderer._import_rawpy()
    expected = ai_upscaler.resolve_thread_count(settings.get().upscaling.threads)
    assert environ == {"OMP_NUM_THREADS": str(expected)}


def test_operator_thread_override_is_kept(monkeypatch):
    environ = {"OMP_NUM_THREADS": "1"}
    monkeypatch.setattr(raw_renderer.os, "environ", environ)
    RawRenderer._import_rawpy()
    assert environ == {"OMP_NUM_THREADS": "1"}


def test_rawpy_is_lazy_loaded_and_missing_dependency_is_reported(monkeypatch):
    monkeypatch.setattr(raw_renderer.os, "environ", {"OMP_NUM_THREADS": "1"})
    monkeypatch.delitem(sys.modules, "rawpy", raising=False)
    renderer = RawRenderer(MagicMock())
    assert "rawpy" not in sys.modules
    monkeypatch.setitem(sys.modules, "rawpy", None)
    result = renderer.render("photo.dng", b"data")
    assert not result.is_successful
    assert result.error == "rawpy is not installed; cannot process camera RAW files."


def test_web_use_case_converts_raw_files_and_reports_a_corrupt_one(tmp_path):
    source = tmp_path / "source"
    destination = tmp_path / "converted"
    source.mkdir()
    destination.mkdir()
    (source / "apple-iphone-xs.dng").write_bytes(_sample("apple-iphone-xs.dng"))
    (source / "canon-eos-r6.CR3").write_bytes(_sample("canon-eos-r6.cr3"))
    (source / "broken.nef").write_bytes(b"not a raw file")
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
        image_format=ImageFormat.WEBP,
        quality=80,
        width=600,
        target_size=None,
    )
    result = use_case.execute(request)
    assert sorted(result.processed_files) == ["apple-iphone-xs.webp", "canon-eos-r6.webp"]
    assert len(result.errors) == 1
    assert "broken.nef" in str(result.errors[0])
    assert DECODE_FAILURE in str(result.errors[0])
    with Image.open(destination / "apple-iphone-xs.webp") as image:
        assert image.format == "WEBP"
        assert image.size == (600, 450)


def test_cli_directory_conversion_includes_raw(tmp_path):
    source = tmp_path / "source"
    source.mkdir()
    (source / "sony-ilce-7s.ARW").write_bytes(_sample("sony-ilce-7s.arw"))
    destination = tmp_path / "converted"
    processor = ImageConversionProcessor(str(source), str(destination), ImageFormat.JPEG)
    processor.run()
    assert len(processor.results) == 1
    with Image.open(destination / "sony-ilce-7s.jpg") as image:
        assert image.size == (2784, 1872)


def test_raw_crop_preview_matches_the_converted_size():
    logger = MagicMock()
    service = CropPreviewService(
        logger,
        create_payload_expander(logger),
        settings.get().crop_preview.unsupported_input_extensions,
        1,
    )
    result = service.build_preview("nikon-d70s.nef", _sample("nikon-d70s.nef"))
    assert result.is_successful, result.error
    with Image.open(result.value) as image:
        assert image.format == "PNG"
        assert image.size == RAW_SAMPLES["nikon-d70s.nef"]


def test_preview_api_rejects_a_corrupt_raw_with_a_generic_message():
    from backend.image_converter.presentation.web.server import app

    response = app.test_client().post(
        "/api/v1/preview",
        data={"file": (BytesIO(b"not a raw file"), "broken.cr2")},
    )
    assert 400 <= response.status_code < 500
    assert b"LibRaw" not in response.data
    assert b"Unsupported file format" not in response.data
