# file: backend/image_converter/domain/image_resizer.py

from PIL import Image
from io import BytesIO

class ImageResizer:
    """
    Responsible for resizing images to a given width, returning bytes.
    """

    def resize_image(self, image_data: bytes, target_width: int) -> bytes:
        """
        Resizes the given image (provided as bytes) to 'target_width' px wide.
        Preserves aspect ratio. Returns new image data in the *original* format
        (or PNG if Pillow can't detect a format).
        """
        with Image.open(BytesIO(image_data)) as img:
            if img.width <= 0:
                raise ValueError("Original image width must be > 0 to resize.")

            # Calculate new height
            ratio = target_width / float(img.width)
            new_height = int(img.height * ratio)

            # Resize using high-quality resampling
            img = img.resize((target_width, new_height), Image.Resampling.LANCZOS)

            # Preserve the image's original format if possible, else fallback
            output_format = img.format if img.format else "PNG"

            buffer = BytesIO()
            img.save(buffer, format=output_format)
            return buffer.getvalue()
