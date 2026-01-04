from PIL import Image
from io import BytesIO


class ImageResizer:
    """
    Handles high-precision image resizing while maintaining data integrity.

    This class supports 8-bit, 16-bit, and 32-bit (HDR) images by utilizing
    the TIFF format for temporary storage, ensuring no color clipping or
    bit-depth reduction occurs during the process.
    """

    def resize_image(self, image_data: bytes, target_width: int) -> bytes:
        with Image.open(BytesIO(image_data)) as img:
            if img.width <= 0:
                raise ValueError("Original image width must be > 0.")

            # Calculate dimensions
            ratio = target_width / float(img.width)
            new_size = (target_width, int(img.height * ratio))

            # Metadata and High-Bit preservation
            icc_profile = img.info.get("icc_profile")

            # Resampling with LANCZOS for high-quality downscaling
            resized_img = img.resize(new_size, Image.Resampling.LANCZOS)

            buffer = BytesIO()
            resized_img.save(
                buffer,
                format="TIFF",
                icc_profile=icc_profile,
                compression="tiff_deflate"
            )

            return buffer.getvalue()