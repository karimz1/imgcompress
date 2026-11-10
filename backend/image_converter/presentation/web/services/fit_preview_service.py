from contextlib import ExitStack
from dataclasses import replace
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.domain.fit_to_size import (
    FitAnchor,
    FitMode,
    FitToSize,
)
from backend.image_converter.domain.fit_layers import ImageLayer, layers_json, text_json
from backend.image_converter.domain.image_resizer import ImageResizer
from backend.image_converter.domain.smart_crop import to_8bit
from backend.image_converter.infrastructure.editor_asset_store import (
    EditorAssetStore,
    open_limited,
)
from backend.image_converter.infrastructure.svg_renderer import (
    SvgRenderer,
    wrap_svg_crop,
)

# Longest side of the preview shown in the editor. Every preset fits, so a
# preset preview is the exported image pixel for pixel; a large custom size
# gets a scaled preview instead of a full-size PNG on every update. Rendering
# for export (render=true) always returns the full size.
PREVIEW_MAX_SIDE = 2048



class FitPreviewService:
    """Fit a decoded editor bitmap, using explicit crop bounds after Auto fit."""

    def build(
        self,
        upload,
        form,
        full_size: bool = False,
        with_image: bool = True,
        background=None,
        assets: EditorAssetStore = None,
    ):
        """
        Returns the selection in source pixels and the fitted PNG. With
        ``with_image`` False only the selection is computed (PNG is None), which
        is all "Auto fit all images" needs for each file.

        Pictures come from the editor session ``fit_session`` in ``assets``:
        ``fit_background_asset`` for fit mode image and the ids of picture
        layers. ``background`` (an uploaded file) still works for fit mode
        image without a session.
        """
        with ExitStack() as stack:
            return self._build(upload, form, full_size, with_image, background, assets, stack)

    def _build(self, upload, form, full_size, with_image, background, assets, stack):
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
            blur=form.get("fit_blur"),
            tint=form.get("fit_tint"),
            tint_color=form.get("fit_tint_color"),
            rotation=form.get("fit_rotation"),
            bg_scale=form.get("fit_bg_scale"),
            bg_x=form.get("fit_bg_x"),
            bg_y=form.get("fit_bg_y"),
            bg_rotation=form.get("fit_bg_rotation"),
            text=form.get("fit_text"),
            color_to=form.get("fit_color_to"),
            gradient_angle=form.get("fit_gradient_angle"),
            tint_color_to=form.get("fit_tint_color_to"),
            tint_angle=form.get("fit_tint_angle"),
            layers=form.get("fit_layers"),
        )
        if not fit_result.is_successful:
            return Result.failure(fit_result.error)
        fit = fit_result.value
        if fit is None:
            return Result.failure("Choose an output width and height.")
        if upload is None:
            return Result.failure("No editor bitmap uploaded.")
        if with_image:
            scale = 1.0 if full_size else min(1.0, PREVIEW_MAX_SIDE / max(fit.width, fit.height))
            # Scaled previews may use the small proxies; full-size output (and a
            # preset preview, which must equal the export) uses the originals.
            pictures = self._attach_pictures(fit, form, background, assets, scale == 1.0, stack)
            if not pictures.is_successful:
                return Result.failure(pictures.error)
            fit = pictures.value

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
                            fit=replace(
                                fit,
                                width=preview_size[0],
                                height=preview_size[1],
                                anchor=FitAnchor.CENTER,
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
                                    {"placement": self._placement_json(fit.placement)}
                                    if fit.placement is not None
                                    else {}
                                ),
                                **(
                                    {
                                        "background": self._background_json(fit.background)
                                    }
                                    if fit.mode == FitMode.IMAGE or not fit.background.is_plain
                                    else {}
                                ),
                                **({"text": text_json(fit.text)} if fit.text is not None else {}),
                                **({"layers": layers_json(fit.layers)} if fit.layers else {}),
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
    def _placement_json(placement) -> dict:
        data = {"scale": placement.scale, "x": placement.x, "y": placement.y}
        if placement.rotation:
            data["rotation"] = placement.rotation
        return data

    def _attach_pictures(self, fit, form, background, assets, full_size, stack):
        """Loads the pictures this fit draws and holds their session for the request."""
        wants_background = fit.mode == FitMode.IMAGE
        layer_ids = [layer.asset for layer in fit.layers if isinstance(layer, ImageLayer)]
        background_asset = (form.get("fit_background_asset") or "").strip()
        uses_session = layer_ids or (wants_background and background_asset)
        if not wants_background and not layer_ids:
            return Result.success(fit)

        session = None
        if uses_session:
            if assets is None:
                return Result.failure("Editor pictures are not available here.")
            opened = stack.enter_context(assets.open(form.get("fit_session")))
            if not opened.is_successful:
                return Result.failure(opened.error)
            session = opened.value

        if wants_background:
            if background_asset:
                loaded = session.load(background_asset, full_size)
            else:
                loaded = self._load_background(background)
            if not loaded.is_successful:
                return Result.failure(loaded.error)
            fit = replace(fit, background=replace(fit.background, image=loaded.value))

        if layer_ids:
            cache = {}
            layers = []
            for layer in fit.layers:
                if isinstance(layer, ImageLayer):
                    if layer.asset not in cache:
                        loaded = session.load(layer.asset, full_size)
                        if not loaded.is_successful:
                            return Result.failure(loaded.error)
                        cache[layer.asset] = loaded.value
                    layer = replace(layer, image=cache[layer.asset])
                layers.append(layer)
            fit = replace(fit, layers=tuple(layers))
        return Result.success(fit)

    @staticmethod
    def _background_json(background) -> dict:
        """Background settings as the editor stores them; never the picture."""
        data = {"pattern": background.pattern.value, "dim": background.dim}
        if background.blur is not None:
            data["blur"] = background.blur
        if background.tint > 0:
            data["tint"] = {"color": background.tint_color, "opacity": background.tint}
        if background.color_to:
            data["colorTo"] = background.color_to
            data["gradientAngle"] = background.gradient_angle
        if background.tint > 0 and background.tint_color_to:
            data["tint"]["colorTo"] = background.tint_color_to
            data["tint"]["angle"] = background.tint_angle
        if background.image_placement is not None:
            placement = background.image_placement
            data["imagePlacement"] = {
                "scale": placement.scale,
                "x": placement.x,
                "y": placement.y,
                "rotation": placement.rotation,
            }
        return data

    @staticmethod
    def _load_background(upload) -> Result[Image.Image]:
        """
        Decodes the background picture of this request from its upload. Nothing is
        written to disk and nothing is shared, so parallel users cannot see or
        clean up each other's backgrounds.
        """
        if upload is None:
            return Result.failure("Choose a background image.")
        return open_limited(upload, "background image")

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
