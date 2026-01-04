from io import BytesIO
import pytest
from PIL import Image
from unittest.mock import MagicMock
import sys

from backend.image_converter.application.dtos import ConversionDetails
from backend.image_converter.core.factory.converter_factory import ImageConverterFactory
from backend.image_converter.core.factory.avif_converter import AvifConverter
from backend.image_converter.core.factory.rembg_avif_converter import RembgAvifConverter
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

def test_avif_converter_encodes_to_avif(sample_rgba_png, tmp_path, mock_logger):
    """Ensure AvifConverter correctly saves as AVIF."""
    
    converter = AvifConverter(quality=80, logger=mock_logger)
    source_path = "/fake/source.png"
    dest_path = str(tmp_path / "out.avif")

    result = converter.convert(sample_rgba_png, source_path, dest_path)
    
    assert result.is_successful is True
    assert result.error is None
    assert isinstance(result.value, ConversionDetails)
    
    with Image.open(dest_path) as out_img:
        assert out_img.format == "AVIF"
        assert out_img.size == (64, 64)

def test_rembg_avif_converter_encodes_to_avif(sample_rgba_png, tmp_path, mock_logger, monkeypatch):
    """Ensure RembgAvifConverter uses rembg and saves as AVIF."""
    
    # Mock rembg
    mock_rembg = MagicMock()
    mock_rembg.new_session.return_value = {"model": "u2net"}
    
    def fake_remove(data, session, post_process_mask, alpha_matting):
        buffer = BytesIO()
        img = Image.new("RGBA", (32, 32), (255, 0, 0, 128))
        img.save(buffer, format="PNG")
        return buffer.getvalue()
    
    mock_rembg.remove = fake_remove
    monkeypatch.setitem(sys.modules, "rembg", mock_rembg)

    converter = RembgAvifConverter(quality=80, logger=mock_logger, model_name="u2net")
    source_path = "/fake/source.png"
    dest_path = str(tmp_path / "out_rembg.avif")

    result = converter.convert(sample_rgba_png, source_path, dest_path)

    assert result.is_successful is True
    assert result.error is None
    
    with Image.open(dest_path) as out_img:
        assert out_img.format == "AVIF"
        assert out_img.size == (32, 32)
        assert out_img.mode == "RGBA"

def test_factory_returns_avif_converters(mock_logger):
    """Ensure ImageConverterFactory returns AVIF converters."""
    # Without Rembg
    converter = ImageConverterFactory.create_converter(
        ImageFormat.AVIF,
        quality=80,
        logger=mock_logger,
        use_rembg=False
    )
    assert isinstance(converter, AvifConverter)
    
    # With Rembg
    converter_rembg = ImageConverterFactory.create_converter(
        ImageFormat.AVIF,
        quality=80,
        logger=mock_logger,
        use_rembg=True
    )
    assert isinstance(converter_rembg, RembgAvifConverter)
