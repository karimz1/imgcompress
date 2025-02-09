from PIL import Image
from io import BytesIO

class ImageResizer:
    """
    Resizes raw image bytes to a given width, returning new bytes.
    """

    def resize_image(self, image_data: bytes, target_width: int) -> bytes:
        with Image.open(BytesIO(image_data)) as img:
            if img.width <= 0:
                raise ValueError("Original image width must be > 0 to resize.")

            ratio = target_width / float(img.width)
            new_height = int(img.height * ratio)

            resized_img = img.resize((target_width, new_height), Image.Resampling.LANCZOS)

            # Keep original format if known, else fallback to PNG
            output_format = resized_img.format if resized_img.format else (img.format or "PNG")

            buffer = BytesIO()
            resized_img.save(buffer, format=output_format)
            return buffer.getvalue()
