import pytest
from PIL import Image
from io import BytesIO
from backend.image_converter.domain.image_resizer import ImageResizer

@pytest.fixture
def sample_png_bytes():
    """Return a small in-memory PNG for testing."""
    buf = BytesIO()
    img = Image.new("RGBA", (100, 50), (255, 0, 0, 128))  # semi-transparent red
    img.save(buf, format="PNG")
    return buf.getvalue()

def test_resize_image(sample_png_bytes):
    resizer = ImageResizer()
    target_width = 50

    resized_bytes = resizer.resize_image(sample_png_bytes, target_width)

    # Now open the returned bytes with Pillow to confirm
    with Image.open(BytesIO(resized_bytes)) as img:
        assert img.width == target_width
        # Original was 100x50 => new is 50x25 if aspect ratio is preserved
        assert img.height == 25

def test_resize_invalid_width(sample_png_bytes):
    resizer = ImageResizer()

    with pytest.raises(ValueError):
        # Zero or negative width should raise
        resizer.resize_image(sample_png_bytes, 0)
