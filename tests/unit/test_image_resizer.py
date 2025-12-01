import pytest
from PIL import Image
from io import BytesIO
from backend.image_converter.domain.image_resizer import ImageResizer

@pytest.fixture
def sample_png_bytes():
    """Return a small in-memory PNG for testing."""
    buf = BytesIO()
    img = Image.new("RGBA", (100, 50), (255, 0, 0, 128))                        
    img.save(buf, format="PNG")
    return buf.getvalue()

def test_When_ImageNeedsResize_Expect_WidthMatchesTarget(sample_png_bytes):
    resizer = ImageResizer()
    target_width = 50

    resized_bytes = resizer.resize_image(sample_png_bytes, target_width)

                                                        
    with Image.open(BytesIO(resized_bytes)) as img:
        assert img.width == target_width
                                                                          
        assert img.height == 25

def test_When_InvalidResizeWidthProvided_Expect_ValueError(sample_png_bytes):
    resizer = ImageResizer()

    with pytest.raises(ValueError):
                                             
        resizer.resize_image(sample_png_bytes, 0)
