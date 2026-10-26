from dataclasses import replace
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.domain.fit_to_size import (
    FitAnchor,
    FitMode,
    FitPattern,
    FitToSize,
)
from backend.image_converter.domain.image_resizer import ImageResizer
from backend.image_converter.domain.smart_crop import to_8bit
from backend.image_converter.infrastructure.svg_renderer import (
    SvgRenderer,
    wrap_svg_crop,
)

# Longest side of the preview shown in the editor. Every preset fits, so a
# preset preview is the exported image pixel for pixel; a large custom size
# gets a scaled preview instead of a full-size PNG on every update. Rendering
# for export (render=true) always returns the full size.
PREVIEW_MAX_SIDE = 2048

# A background picture for FitMode.IMAGE is read into memory for the one
# request that needs it, so it is limited much more tightly than uploads.
MAX_BACKGROUND_BYTES = 25 * 1024 * 1024
# Raster formats Pillow decodes itself. No SVG, PSD or PDF: those need their
# own renderers and are not worth that for a backdrop.
BACKGROUND_FORMATS = ("PNG", "JPEG", "WEBP", "GIF", "BMP", "TIFF", "AVIF", "HEIF")


class FitPreviewService:
    """Fit a decoded editor bitmap, using explicit crop bounds after Auto fit."""

    def build(
        self,
        upload,
        form,
        full_size: bool = False,
        with_image: bool = True,
        background=None,
    ):
        """
        Returns the selection in source pixels and the fitted PNG. With
        ``with_image`` False only the selection is computed (PNG is None), which
        is all "Auto fit all images" needs for each file. ``background`` is the
        uploaded picture for fit mode image; other modes ignore it.
        """
        fit_result = FitToSize.from_strings_result(
            form.get("fit_width"),
            form.get("fit_height"),
            form.get("fit_mode"),
            "center",
            form.get("fit_color"),
            form.get("fit_scale"),
            form.get("fit_x"),
            form.get("fit_y"),
            pattern=form.get("fit_pattern"),
            dim=form.get("fit_dim"),
        )
        if not fit_result.is_successful:
            return Result.failure(fit_result.error)
        fit = fit_result.value
        if fit is None:
            return Result.failure("Choose an output width and height.")
        if upload is None:
            return Result.failure("No editor bitmap uploaded.")
        if fit.mode == FitMode.IMAGE and with_image:
            loaded = self._load_background(background)
            if not loaded.is_successful:
                return Result.failure(loaded.error)
            fit = replace(fit, background=replace(fit.background, image=loaded.value))

        try:
            svg_data = None
            if (upload.filename or "").lower().endswith(".svg"):
                svg_data = upload.stream.read()
                rendered = SvgRenderer().render(upload.filename, svg_data)
                if not rendered.is_successful:
                    return Result.failure(rendered.error)
                source_stream = BytesIO(rendered.value)
            else:
                source_stream = upload.stream
            with Image.open(source_stream) as source:
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
                png = None
                if with_image:
                    scale = (
                        1.0
                        if full_size
                        else min(1.0, PREVIEW_MAX_SIDE / max(fit.width, fit.height))
                    )
                    preview_size = (
                        max(1, round(fit.width * scale)),
                        max(1, round(fit.height * scale)),
                    )
                    # Render directly at preview resolution while using the
                    # export geometry. Do not allocate an 8192px canvas just to
                    # shrink it for every editor update.
                    if svg_data is not None:
                        clipped = wrap_svg_crop(
                            svg_data, img.size, (x, y, width, height)
                        )
                        rendered = SvgRenderer().render(
                            upload.filename,
                            clipped,
                            fit=FitToSize(
                                *preview_size,
                                fit.mode,
                                FitAnchor.CENTER,
                                fit.color,
                                fit.placement,
                                fit.background,
                            ),
                        )
                        if not rendered.is_successful:
                            return Result.failure(rendered.error)
                        png = rendered.value
                    else:
                        selected = img.crop((x, y, x + width, y + height))
                        fitted = ImageResizer.fit_image(
                            selected, fit, output_size=preview_size
                        )
                        if (
                            fitted.mode in ("RGB", "RGBA")
                            and icc_profile
                            and icc_profile[16:20] != b"RGB "
                        ):
                            icc_profile = None
                        buffer = BytesIO()
                        fitted.save(buffer, format="PNG", icc_profile=icc_profile)
                        png = buffer.getvalue()
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
                                **({"color": fit.color} if fit.mode in (FitMode.SOLID, FitMode.TRANSPARENT) else {}),
                                **(
                                    {
                                        "placement": {
                                            "scale": fit.placement.scale,
                                            "x": fit.placement.x,
                                            "y": fit.placement.y,
                                        }
                                    }
                                    if fit.placement is not None
                                    else {}
                                ),
                                **(
                                    {
                                        "background": {
                                            "pattern": fit.background.pattern.value,
                                            "dim": fit.background.dim,
                                        }
                                    }
                                    if fit.mode == FitMode.IMAGE
                                    or fit.background.pattern != FitPattern.NONE
                                    or fit.background.dim > 0
                                    else {}
                                ),
                            },
                        },
                        png,
                    )
                )
        except (
            UnidentifiedImageError,
            OSError,
            ValueError,
            Image.DecompressionBombError,
        ):
            return Result.failure("Could not read the editor bitmap.")

    @staticmethod
    def _load_background(upload) -> Result[Image.Image]:
        """
        Decodes the background picture of this request in memory. Nothing is
        written to disk and nothing is shared, so parallel users cannot see or
        clean up each other's backgrounds.
        """
        if upload is None:
            return Result.failure("Choose a background image.")
        stream = getattr(upload, "stream", upload)
        data = stream.read(MAX_BACKGROUND_BYTES + 1)
        if len(data) > MAX_BACKGROUND_BYTES:
            return Result.failure(
                f"The background image is too large (max {MAX_BACKGROUND_BYTES // (1024 * 1024)} MB)."
            )
        Image.init()
        # Only formats whose plugin is installed; Pillow fails on unknown names.
        formats = [name for name in BACKGROUND_FORMATS if name in Image.OPEN]
        try:
            with Image.open(BytesIO(data), formats=formats) as source:
                image = to_8bit(ImageOps.exif_transpose(source))
                image.load()
                return Result.success(image)
        except (
            UnidentifiedImageError,
            OSError,
            ValueError,
            Image.DecompressionBombError,
        ):
            return Result.failure(
                "Could not read the background image. Use a PNG, JPEG, WebP, GIF, BMP or TIFF file."
            )

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
        if fit.mode != FitMode.CROP:
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
