from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from io import BytesIO

from backend.image_converter.domain.fit_to_size import FitAnchor, FitMode, FitToSize
from backend.image_converter.domain.smart_crop import find_crop_offset, to_8bit

# Blurred background for FitMode.BLUR: blur radius as a share of the longer
# target side, and how much the background is darkened so the image in front
# stands out. Matches the hand-made social preview this feature started from.
_BLUR_RADIUS_SHARE = 0.025
_BLUR_BRIGHTNESS = 0.85


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

            # The TIFF written below carries no EXIF, so apply the orientation now.
            # This also makes the target width the width the user actually sees.
            try:
                img = ImageOps.exif_transpose(img)
            except Exception:
                pass

            # Calculate dimensions
            ratio = target_width / float(img.width)
            new_size = (target_width, max(1, int(img.height * ratio)))

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

    def fit_to_size(self, image_data: bytes, fit: FitToSize) -> bytes:
        """
        Returns the image at exactly ``fit.width`` x ``fit.height``.

        CROP scales the image to cover the target and cuts off the overflow,
        either where the least important content is (AUTO) or at the given
        anchor. BLUR scales the whole image to fit and fills the empty sides
        with a blurred, slightly darkened copy of itself; the result is opaque.
        """
        with Image.open(BytesIO(image_data)) as img:
            try:
                img = ImageOps.exif_transpose(img)
            except Exception:
                pass
            icc_profile = img.info.get("icc_profile")
            result = self.fit_image(img, fit)

            buffer = BytesIO()
            result.save(
                buffer,
                format="TIFF",
                icc_profile=icc_profile,
                compression="tiff_deflate",
            )
            return buffer.getvalue()

    @classmethod
    def fit_image(cls, img: Image.Image, fit: FitToSize) -> Image.Image:
        """
        Same as ``fit_to_size`` for an image that is already decoded and upright.
        The editor preview uses this directly so it does not have to encode and
        decode the full-resolution selection in between.
        """
        if img.mode in ("P", "PA"):
            img = img.convert("RGBA" if cls._has_alpha(img) else "RGB")
        if fit.mode == FitMode.BLUR:
            return cls._fit_on_blurred_background(img, fit.width, fit.height)
        box = cls.fit_crop_box(img, fit.width, fit.height, fit.anchor)
        return img.resize((fit.width, fit.height), Image.Resampling.LANCZOS, box=box)

    @staticmethod
    def fit_crop_box(
        img: Image.Image, width: int, height: int, anchor: FitAnchor
    ) -> tuple[float, float, float, float]:
        """
        The part of ``img``, in its own pixels, that crop mode scales to
        ``width`` x ``height``. Working in source pixels means only that part is
        resampled. Scaling the whole image to cover the target first would need
        width x (height * aspect ratio) pixels, which for a thin strip runs into
        gigabytes.
        """
        scale = max(width / img.width, height / img.height)
        box_width = min(float(img.width), width / scale)
        box_height = min(float(img.height), height / scale)
        free_x = img.width - box_width
        free_y = img.height - box_height

        if anchor == FitAnchor.AUTO:
            left, top = find_crop_offset(
                img, max(1, round(box_width)), max(1, round(box_height))
            )
            left, top = min(float(left), free_x), min(float(top), free_y)
        else:
            left = {FitAnchor.LEFT: 0.0, FitAnchor.RIGHT: free_x}.get(anchor, free_x / 2)
            top = {FitAnchor.TOP: 0.0, FitAnchor.BOTTOM: free_y}.get(anchor, free_y / 2)
        return left, top, left + box_width, top + box_height

    @classmethod
    def _fit_on_blurred_background(cls, img: Image.Image, width: int, height: int) -> Image.Image:
        # Blur and compositing work on 8-bit RGB; the output is opaque anyway.
        img = to_8bit(img)
        if cls._has_alpha(img):
            rgba = img.convert("RGBA")
            # Transparent areas would blur into whatever colour hides behind
            # them (often black), so flatten onto white first.
            flat = Image.new("RGB", rgba.size, (255, 255, 255))
            flat.paste(rgba.convert("RGB"), mask=rgba.getchannel("A"))
        else:
            rgba = None
            flat = img.convert("RGB")

        box = cls.fit_crop_box(flat, width, height, FitAnchor.CENTER)
        background = flat.resize((width, height), Image.Resampling.LANCZOS, box=box)
        radius = max(2.0, max(width, height) * _BLUR_RADIUS_SHARE)
        background = background.filter(ImageFilter.GaussianBlur(radius))
        background = ImageEnhance.Brightness(background).enhance(_BLUR_BRIGHTNESS)

        ratio = min(width / img.width, height / img.height)
        size = (max(1, min(width, round(img.width * ratio))), max(1, min(height, round(img.height * ratio))))
        offset = ((width - size[0]) // 2, (height - size[1]) // 2)
        if rgba is not None:
            foreground = rgba.resize(size, Image.Resampling.LANCZOS)
            background.paste(foreground.convert("RGB"), offset, mask=foreground.getchannel("A"))
        else:
            background.paste(flat.resize(size, Image.Resampling.LANCZOS), offset)
        return background

    @staticmethod
    def _has_alpha(img: Image.Image) -> bool:
        return img.mode in ("RGBA", "LA", "PA") or (img.mode == "P" and "transparency" in img.info)

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
