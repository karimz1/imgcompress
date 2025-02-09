import pytest
from PIL import Image
from io import BytesIO
from backend.image_converter.core.factory.jpeg_converter import JpegConverter
from backend.image_converter.core.factory.png_converter import PngConverter
from backend.image_converter.infrastructure.logger import Logger

@pytest.fixture
def sample_rgba_png():
    """Create a 64x64 RGBA image in memory."""
    buf = BytesIO()
    img = Image.new("RGBA", (64, 64), (0, 255, 0, 128))  # translucent green
    img.save(buf, format="PNG")
    return buf.getvalue()

@pytest.fixture
def mock_logger():
    """A basic logger stub."""
    return Logger(debug=True, json_output=False)

def test_jpeg_converter_alpha(sample_rgba_png, tmp_path, mock_logger):
    """
    Ensure JpegConverter composites alpha over white.
    """
    converter = JpegConverter(quality=80, logger=mock_logger)
    source_path = "/fake/source.png"
    dest_path = str(tmp_path / "out.jpg")

    result = converter.convert(sample_rgba_png, source_path, dest_path)
    assert result["is_successful"] is True
    assert result["error"] is None

    # Now open the output file from dest_path
    with open(dest_path, "rb") as f:
        output_data = f.read()
    with Image.open(BytesIO(output_data)) as out_img:
        assert out_img.mode == "RGB"
        # No alpha channel, since it's JPEG
        assert out_img.size == (64, 64)

def test_png_converter_preserves_alpha(sample_rgba_png, tmp_path, mock_logger):
    """
    Ensure PngConverter preserves alpha channel.
    """
    converter = PngConverter(logger=mock_logger)
    source_path = "/fake/source.png"
    dest_path = str(tmp_path / "out.png")

    result = converter.convert(sample_rgba_png, source_path, dest_path)
    assert result["is_successful"]
    assert result["error"] is None

    with open(dest_path, "rb") as f:
        output_data = f.read()
    with Image.open(BytesIO(output_data)) as out_img:
        assert out_img.mode == "RGBA"  # alpha should remain
        assert out_img.size == (64, 64)
