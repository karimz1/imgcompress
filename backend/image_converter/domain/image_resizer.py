from PIL import Image
from io import BytesIO

class ImageResizer:
    """
    Resizes raw image bytes to a given width and returns the resized image bytes.
    """
    def resize_image(self, image_data: bytes, target_width: int) -> bytes:
        with Image.open(BytesIO(image_data)) as img:
            if img.width <= 0:
                raise ValueError("Original image width must be > 0 to resize.")

            ratio = target_width / float(img.width)
            new_height = int(img.height * ratio)

            resized_img = img.resize((target_width, new_height), Image.Resampling.LANCZOS)
            
                                                                                                               
            buffer = BytesIO()
            resized_img.save(buffer, format="PNG")
            return buffer.getvalue()
