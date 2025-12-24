from pathlib import Path
import pytest
from io import BytesIO

from PIL import Image

from backend.image_converter.application.dtos import ConversionDetails
from backend.image_converter.core.factory.converter_factory import ImageConverterFactory
from backend.image_converter.core.factory.jpeg_converter import JpegConverter
from backend.image_converter.core.factory.png_converter import PngConverter
from backend.image_converter.core.factory.rembg_png_converter import RembgPngConverter
import backend.image_converter.core.factory.rembg_png_converter as rembg_module
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.infrastructure.logger import Logger

@pytest.fixture
def sample_rgba_png():
    """Create a 64x64 RGBA image in memory."""
    buf = BytesIO()
    img = Image.new("RGBA", (64, 64), (0, 255, 0, 128))                     
    img.save(buf, format="PNG")
    return buf.getvalue()

@pytest.fixture
def mock_logger():
    """A basic logger stub."""
    return Logger(debug=True, json_output=False)

def test_When_ImageContainsTransparency_Expect_JpegConverterFlattensAlpha(sample_rgba_png, tmp_path, mock_logger):
    """
    Ensure JpegConverter composites alpha over white.
    """
    converter = JpegConverter(quality=80, logger=mock_logger)
    source_path = "/fake/source.png"
    dest_path = str(tmp_path / "out.jpg")

    result = converter.convert(sample_rgba_png, source_path, dest_path)
    assert result.is_successful is True
    assert result.error is None
    assert isinstance(result.value, ConversionDetails)
    assert result.value.destination == dest_path

                                             
    with open(dest_path, "rb") as f:
        output_data = f.read()
    with Image.open(BytesIO(output_data)) as out_img:
        assert out_img.mode == "RGB"
                                           
        assert out_img.size == (64, 64)

def test_When_ImageContainsTransparency_Expect_PngConverterPreservesAlpha(sample_rgba_png, tmp_path, mock_logger):
    """
    Ensure PngConverter preserves alpha channel.
    """
    converter = PngConverter(logger=mock_logger)
    source_path = "/fake/source.png"
    dest_path = str(tmp_path / "out.png")

    result = converter.convert(sample_rgba_png, source_path, dest_path)
    assert result.is_successful is True
    assert result.error is None
    assert isinstance(result.value, ConversionDetails)
    assert result.value.destination == dest_path

    with open(dest_path, "rb") as f:
        output_data = f.read()
    with Image.open(BytesIO(output_data)) as out_img:
        assert out_img.mode == "RGBA"                       
        assert out_img.size == (64, 64)


def test_When_RembgRequested_Expect_FactoryReturnsRembgConverter(mock_logger):
    converter = ImageConverterFactory.create_converter(
        ImageFormat.PNG,
        80,
        mock_logger,
        use_rembg=True,
    )
    assert isinstance(converter, RembgPngConverter)


def test_When_RembgConverts_Expect_PngWithAlpha(tmp_path, mock_logger, monkeypatch):
    sample_path = Path(__file__).resolve().parents[1] / "sample-images" / "test_image.png"
    image_data = sample_path.read_bytes()

    def fake_new_session(model_name: str):
        return {"model": model_name}

    def fake_remove(data, session, post_process_mask, alpha_matting):
        assert data == image_data
        assert post_process_mask is True
        assert alpha_matting is False
        buffer = BytesIO()
        img = Image.new("RGBA", (32, 32), (255, 0, 0, 128))
        img.save(buffer, format="PNG")
        return buffer.getvalue()

    monkeypatch.setattr(rembg_module, "new_session", fake_new_session)
    monkeypatch.setattr(rembg_module, "remove", fake_remove)

    converter = RembgPngConverter(logger=mock_logger, model_name="u2net")
    dest_path = tmp_path / "out.png"
    result = converter.convert(image_data, str(sample_path), str(dest_path))

    assert result.is_successful is True
    assert result.error is None
    assert isinstance(result.value, ConversionDetails)
    assert result.value.destination == str(dest_path)

    with Image.open(dest_path) as out_img:
        assert out_img.mode == "RGBA"
