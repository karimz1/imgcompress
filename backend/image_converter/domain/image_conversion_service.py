from typing import Optional
from PIL import Image
from io import BytesIO
from .image_resizer import ImageResizer

class ImageConversionService:
    """
    Core logic for image conversion:
      - If a width is provided, it delegates the resizing step to ImageResizer.
      - Converts alpha channels to RGB if saving as JPEG.
      - Finally writes the image data in the requested output format and quality.
    """

    SUPPORTED_FORMATS = {"jpeg", "png"}

    def __init__(self, resizer: ImageResizer):
        """
        Pass in an ImageResizer instance. This allows us to keep resizing
        separate while still using it here if needed.
        """
        self.resizer = resizer

    def convert_image(
        self,
        image_data: bytes,
        output_format: str = "jpeg",
        quality: int = 85,
        width: Optional[int] = None
    ) -> bytes:
        """
        Convert an image in memory ('image_data'):
          1) If a valid 'width' is given, first resize the image.
          2) If saving as JPEG and the image has alpha or palette, convert to RGB.
          3) Write the final result to bytes in the requested format & quality.
        """
        # Validate or fallback format
        out_fmt = output_format.lower()
        if out_fmt not in self.SUPPORTED_FORMATS:
            out_fmt = "jpeg"

        # 1) Resize if a width is specified
        if width and width > 0:
            image_data = self.resizer.resize_image(image_data, width)

        # 2) Re-open (possibly resized) data
        with Image.open(BytesIO(image_data)) as img:
            # Convert alpha to RGB if saving as JPEG
            if out_fmt == "jpeg" and img.mode in ("RGBA", "P"):
                img = img.convert("RGB")

            # 3) Output to a buffer in the final format
            output_buffer = BytesIO()
            if out_fmt == "jpeg":
                # JPEG with specified quality
                img.save(output_buffer, format="JPEG", quality=quality)
            else:
                # PNG (or other, if you add them)
                img.save(output_buffer, format=out_fmt.upper())

            return output_buffer.getvalue()
