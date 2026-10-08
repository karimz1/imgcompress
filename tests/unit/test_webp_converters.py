import sys
from io import BytesIO
from unittest.mock import MagicMock

import numpy as np
import pytest
from PIL import Image

from backend.image_converter.application.compress_images_usecase import CompressImagesUseCase
from backend.image_converter.application.dtos import CompressionFormData, CompressRequest
from backend.image_converter.application.payload_expander_factory import create_payload_expander
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.core.factory.converter_factory import ImageConverterFactory
from backend.image_converter.core.factory.rembg_webp_converter import RembgWebpConverter
from backend.image_converter.core.factory.webp_converter import WebpConverter
from backend.image_converter.core.interfaces.base_converter import WEBP_MAX_DIMENSION
from backend.image_converter.domain.image_resizer import ImageResizer
from backend.image_converter.domain.units import TargetSize
from backend.image_converter.infrastructure.local_storage import LocalStorage
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.presentation.web.services.compression_service import (
    CompressionService,
)
from tests.unit.dummy_logger import DummyLogger


def _encode(img: Image.Image, fmt: str = "PNG", **params) -> bytes:
    buffer = BytesIO()
    img.save(buffer, format=fmt, **params)
    return buffer.getvalue()


@pytest.fixture
def logger():
    return Logger(debug=False, json_output=False)


@pytest.fixture
def gradient_rgba_png() -> bytes:
    """64x48 RGBA image with a horizontal alpha ramp, so alpha has many distinct values."""
    img = Image.new("RGBA", (64, 48))
    img.putdata([(x * 4, y * 5, 128, x * 4) for y in range(48) for x in range(64)])
    return _encode(img)


def _assert_is_webp(data: bytes) -> None:
    assert data[:4] == b"RIFF"
    assert data[8:12] == b"WEBP"


def test_When_EncodingLossy_Expect_ValidWebpWithSameDimensions(logger):
    source = _encode(Image.effect_noise((120, 80), 64).convert("RGB"), "JPEG")

    data = WebpConverter(quality=80, logger=logger).encode_to_bytes(source)

    _assert_is_webp(data)
    with Image.open(BytesIO(data)) as out:
        assert out.format == "WEBP"
        assert out.size == (120, 80)
        assert out.mode == "RGB"


def test_When_SourceHasAlpha_Expect_AlphaChannelPreserved(gradient_rgba_png, logger):
    data = WebpConverter(quality=80, logger=logger).encode_to_bytes(gradient_rgba_png)

    with Image.open(BytesIO(data)) as out:
        assert out.mode == "RGBA"
        alpha_min, alpha_max = out.getchannel("A").getextrema()
        assert alpha_min < 10
        assert alpha_max > 240


def test_When_EncodingLossless_Expect_PixelsUnchanged(gradient_rgba_png, logger):
    data = WebpConverter(quality=80, logger=logger, lossless=True).encode_to_bytes(gradient_rgba_png)

    with Image.open(BytesIO(gradient_rgba_png)) as src, Image.open(BytesIO(data)) as out:
        assert out.mode == "RGBA"
        # libwebp may rewrite the colour of fully transparent pixels, so compare
        # only the pixels that are actually visible.
        src_pixels = np.asarray(src)
        out_pixels = np.asarray(out)
        visible = src_pixels[..., 3] > 0
        assert np.array_equal(src_pixels[visible], out_pixels[visible])


def test_When_LoweringQuality_Expect_SmallerFile(logger):
    source = _encode(Image.effect_noise((256, 256), 100).convert("RGB"))

    small = WebpConverter(quality=30, logger=logger).encode_to_bytes(source)
    large = WebpConverter(quality=95, logger=logger).encode_to_bytes(source)

    assert len(small) < len(large)


def test_When_PaletteImageHasTransparency_Expect_RgbaOutput(logger):
    palette_img = Image.new("P", (16, 16), 0)
    palette_img.putpalette([255, 0, 0, 0, 0, 255] + [0] * 762)
    palette_img.paste(1, (8, 0, 16, 16))
    source = _encode(palette_img, transparency=0)

    data = WebpConverter(quality=90, logger=logger).encode_to_bytes(source)

    with Image.open(BytesIO(data)) as out:
        assert out.mode == "RGBA"
        assert out.getpixel((0, 0))[3] == 0
        assert out.getpixel((15, 15))[3] == 255


def test_When_ExifOrientationIsRotated_Expect_PixelsRotatedBeforeEncoding(logger):
    img = Image.new("RGB", (40, 20), (255, 0, 0))
    exif = Image.Exif()
    exif[0x0112] = 6  # rotate 90 degrees clockwise when displayed
    source = _encode(img, "JPEG", exif=exif.tobytes())

    data = WebpConverter(quality=90, logger=logger).encode_to_bytes(source)

    with Image.open(BytesIO(data)) as out:
        assert out.size == (20, 40)


def test_When_ImageExceedsWebpLimit_Expect_ConversionFailsWithClearMessage(tmp_path, logger):
    source = _encode(Image.new("L", (WEBP_MAX_DIMENSION + 1, 1)))

    result = WebpConverter(quality=80, logger=logger).convert(
        source, "/fake/wide.png", str(tmp_path / "wide.webp")
    )

    assert not result.is_successful
    assert "16383" in result.error


def test_When_RembgWebpConverts_Expect_TransparentWebp(logger, monkeypatch):
    mock_rembg = MagicMock()
    mock_rembg.new_session.return_value = {"model": "u2net"}
    mock_rembg.remove = lambda data, session, post_process_mask, alpha_matting: _encode(
        Image.new("RGBA", (32, 32), (255, 0, 0, 0))
    )
    monkeypatch.setitem(sys.modules, "rembg", mock_rembg)

    converter = RembgWebpConverter(quality=80, logger=logger, model_name="u2net")
    data = converter.encode_to_bytes(_encode(Image.new("RGB", (32, 32))))

    assert converter.removes_background is True
    _assert_is_webp(data)
    with Image.open(BytesIO(data)) as out:
        assert out.mode == "RGBA"
        assert out.getchannel("A").getextrema() == (0, 0)


@pytest.mark.parametrize(
    "use_rembg, expected_type",
    [(False, WebpConverter), (True, RembgWebpConverter)],
)
def test_When_FactoryAskedForWebp_Expect_MatchingConverterWithLosslessFlag(
    logger, use_rembg, expected_type
):
    converter = ImageConverterFactory.create_converter(
        ImageFormat.WEBP, 70, logger, use_rembg=use_rembg, webp_lossless=True
    )

    assert isinstance(converter, expected_type)
    assert converter.quality == 70
    assert converter.lossless is True


def test_When_ParsingWebpFormat_Expect_WebpExtension():
    image_format = ImageFormat.from_string("webp")

    assert image_format is ImageFormat.WEBP
    assert image_format.get_file_extension() == ".webp"


def test_When_TargetSizeSetForWebp_Expect_OutputUnderLimit(tmp_path):
    source_dir = tmp_path / "source"
    dest_dir = tmp_path / "converted"
    source_dir.mkdir()
    # Encodes to roughly 35 KB at quality 10 and 110 KB at quality 95, so a 60 KB
    # target is reachable only by actually searching the quality range.
    (source_dir / "noise.png").write_bytes(
        _encode(Image.effect_noise((400, 400), 40).convert("RGB"))
    )
    logger = Logger(debug=False, json_output=False)
    use_case = CompressImagesUseCase(
        logger, ImageResizer(), ImageConverterFactory, LocalStorage(logger), create_payload_expander(logger)
    )
    target = TargetSize(bytes=60 * 1024)

    result = use_case.execute(CompressRequest(
        source_folder=str(source_dir),
        dest_folder=str(dest_dir),
        image_format=ImageFormat.WEBP,
        quality=85,
        width=None,
        target_size=target,
    ))

    assert result.errors == []
    assert result.processed_files == ["noise.webp"]
    output = (dest_dir / "noise.webp").read_bytes()
    _assert_is_webp(output)
    assert target.within_tolerance(len(output))


def test_When_LosslessWebpCombinedWithTargetSize_Expect_RejectedBeforeConversion():
    service = CompressionService(DummyLogger(), use_case=None, temp_folder_service=None)
    form_data = CompressionFormData(
        uploaded_files=(),
        quality=85,
        width=None,
        image_format=ImageFormat.WEBP,
        target_size_kb=500,
        use_rembg=False,
        pdf_preset="",
        pdf_scale="",
        pdf_margin_mm=10.0,
        pdf_paginate=False,
        webp_lossless=True,
    )

    result = service.compress(form_data)

    assert not result.is_successful
    assert "Lossless WebP" in result.error
