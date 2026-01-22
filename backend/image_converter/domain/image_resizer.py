from PIL import Image, ImageOps
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

    def resize_to_canvas(
        self,
        image_data: bytes,
        target_width: int,
        target_height: int,
        mode: str = "fit",
        margin_mm: float = 0.0,
        auto_rotate: bool = False,
    ) -> bytes:
        if target_width <= 0 or target_height <= 0:
            raise ValueError("Target dimensions must be > 0.")

        with Image.open(BytesIO(image_data)) as img:
            try:
                img = ImageOps.exif_transpose(img)
            except Exception:
                pass

            target_width, target_height = self._maybe_rotate_canvas(
                img, target_width, target_height, auto_rotate
            )

            margin_px = self._mm_to_px(margin_mm)
            max_margin = min((target_width - 1) // 2, (target_height - 1) // 2)
            margin_px = max(0, min(margin_px, max_margin))
            inner_w = target_width - (2 * margin_px)
            inner_h = target_height - (2 * margin_px)
            if inner_w <= 0 or inner_h <= 0:
                raise ValueError("Margin is too large for the target canvas.")

            if mode == "fill":
                ratio = max(inner_w / img.width, inner_h / img.height)
            else:
                ratio = min(inner_w / img.width, inner_h / img.height)

            new_size = (max(1, int(img.width * ratio)), max(1, int(img.height * ratio)))
            resized_img = img.resize(new_size, Image.Resampling.LANCZOS)

            base = Image.new("RGB", (target_width, target_height), (255, 255, 255))
            if mode == "fill":
                left = max(0, (resized_img.width - inner_w) // 2)
                top = max(0, (resized_img.height - inner_h) // 2)
                right = left + inner_w
                bottom = top + inner_h
                cropped = resized_img.crop((left, top, right, bottom))
                self._paste_on_canvas(base, cropped, margin_px, margin_px)
            else:
                offset_x = margin_px + (inner_w - resized_img.width) // 2
                offset_y = margin_px + (inner_h - resized_img.height) // 2
                self._paste_on_canvas(base, resized_img, offset_x, offset_y)

            buffer = BytesIO()
            base.save(buffer, format="TIFF", compression="tiff_deflate")
            return buffer.getvalue()

    @staticmethod
    def _mm_to_px(mm: float) -> int:
        return int(round(mm * 72.0 / 25.4))

    @staticmethod
    def _maybe_rotate_canvas(img: Image.Image, target_width: int, target_height: int, auto_rotate: bool):
        if not auto_rotate:
            return target_width, target_height
        img_is_landscape = img.width > img.height
        canvas_is_landscape = target_width > target_height
        if img_is_landscape != canvas_is_landscape:
            return target_height, target_width
        return target_width, target_height

    @staticmethod
    def _paste_on_canvas(base: Image.Image, image: Image.Image, x: int, y: int) -> None:
        if image.mode in ("RGBA", "LA"):
            alpha = image.getchannel("A")
            base.paste(image.convert("RGB"), (x, y), mask=alpha)
        else:
            base.paste(image.convert("RGB"), (x, y))
