from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.domain.fit_to_size import FitAnchor, FitMode, FitToSize
from backend.image_converter.domain.image_resizer import ImageResizer
from backend.image_converter.domain.smart_crop import to_8bit

# Longest side of the preview shown in the editor. Every preset fits, so a
# preset preview is the exported image pixel for pixel; a large custom size
# gets a scaled preview instead of a full-size PNG on every update. Rendering
# for export (render=true) always returns the full size.
PREVIEW_MAX_SIDE = 2048


class FitPreviewService:
    """Fit a decoded editor bitmap, using explicit crop bounds after Auto fit."""

    def build(self, upload, form, full_size: bool = False):
        fit_result = FitToSize.from_strings_result(
            form.get("fit_width"),
            form.get("fit_height"),
            form.get("fit_mode"),
            "center",
        )
        if not fit_result.is_successful:
            return Result.failure(fit_result.error)
        fit = fit_result.value
        if fit is None:
            return Result.failure("Choose an output width and height.")
        if upload is None:
            return Result.failure("No editor bitmap uploaded.")

        try:
            with Image.open(upload.stream) as source:
                img = to_8bit(ImageOps.exif_transpose(source))
                img.load()
                icc_profile = img.info.get("icc_profile")
                if img.mode not in ("RGB", "RGBA", "L", "LA", "P"):
                    img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
                    # The profile described the old colour space (e.g. CMYK).
                    icc_profile = None
                original_width, original_height = img.size
                crop = self._crop_bounds(img, fit, form)
                if crop is None:
                    return Result.failure(
                        "Crop bounds must be whole pixels inside the image."
                    )
                x, y, width, height = crop
                selected = img.crop((x, y, x + width, y + height))
                fitted = ImageResizer.fit_image(selected, fit)
                if not full_size:
                    fitted.thumbnail(
                        (PREVIEW_MAX_SIDE, PREVIEW_MAX_SIDE), Image.Resampling.LANCZOS
                    )
                png = BytesIO()
                fitted.save(png, format="PNG", icc_profile=icc_profile)
                return Result.success(
                    (
                        {
                            "x": x,
                            "y": y,
                            "width": width,
                            "height": height,
                            "originalWidth": original_width,
                            "originalHeight": original_height,
                            "preset": "free",
                            "fit": {
                                "width": fit.width,
                                "height": fit.height,
                                "mode": fit.mode.value,
                            },
                        },
                        png.getvalue(),
                    )
                )
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
            return Result.failure("Could not read the editor bitmap.")

    @staticmethod
    def _crop_bounds(img, fit, form):
        keys = ("crop_x", "crop_y", "crop_width", "crop_height")
        if any(key in form for key in keys):
            try:
                x, y, width, height = (int(form[key]) for key in keys)
            except (KeyError, ValueError, TypeError):
                return None
            if x < 0 or y < 0 or width < 1 or height < 1:
                return None
            if x + width > img.width or y + height > img.height:
                return None
            return x, y, width, height
        if fit.mode == FitMode.BLUR:
            return 0, 0, img.width, img.height

        # Expose the automatic selection in source pixels so it can be edited
        # and saved without rerunning automatic placement at conversion time.
        left, top, right, bottom = ImageResizer.fit_crop_box(
            img, fit.width, fit.height, FitAnchor.AUTO
        )
        width = min(img.width, max(1, round(right - left)))
        height = min(img.height, max(1, round(bottom - top)))
        x = max(0, min(img.width - width, round(left)))
        y = max(0, min(img.height - height, round(top)))
        return x, y, width, height
