import math
from io import BytesIO
from typing import Optional

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

from backend.image_converter.domain.fit_to_size import (
    PLACEABLE_FIT_MODES,
    FitAnchor,
    FitMode,
    FitPattern,
    DEFAULT_BLUR_STRENGTH,
    FitPlacement,
    FitToSize,
)
from backend.image_converter.domain.smart_crop import find_crop_offset, to_8bit
from backend.image_converter.domain.fit_layers import ImageLayer
from backend.image_converter.domain.gradient import linear_gradient
from backend.image_converter.domain.text_overlay import render_text_overlay

# Blurred background for FitMode.BLUR: blur radius as a share of the longer
# target side, and how much the background is darkened so the image in front
# stands out. Matches the hand-made social preview this feature started from.
_BLUR_RADIUS_SHARE = 0.025
_BLUR_BRIGHTNESS = 0.85

# Background patterns: one cell is this share of the longer target side, so a
# pattern looks the same in the scaled preview and the export. The ink is
# black or white (whichever contrasts with the colour) at this opacity.
_PATTERN_CELL_SHARE = 1 / 40
_PATTERN_INK_ALPHA = 41
_PATTERN_DOT_RADIUS = 0.22
_PATTERN_LINE_WIDTH = 0.08
# Rows per step when drawing a pattern, to bound the temporary arrays.
_PATTERN_ROWS = 256


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
            if result.mode in ("RGB", "RGBA") and icc_profile and icc_profile[16:20] != b"RGB ":
                # Blur mode converts CMYK and grayscale pixels to RGB. Their
                # original profiles no longer describe the exported pixels.
                icc_profile = None

            buffer = BytesIO()
            result.save(
                buffer,
                format="TIFF",
                icc_profile=icc_profile,
                compression="tiff_deflate",
            )
            return buffer.getvalue()

    @classmethod
    def fit_image(
        cls, img: Image.Image, fit: FitToSize, output_size: tuple[int, int] | None = None
    ) -> Image.Image:
        """
        Same as ``fit_to_size`` for an image that is already decoded and upright.
        The editor preview uses this directly so it does not have to encode and
        decode the full-resolution selection in between.
        """
        fitted = cls._fit_canvas(img, fit, output_size or (fit.width, fit.height))
        return cls.draw_overlays(fitted, fit)

    @classmethod
    def draw_overlays(cls, canvas: Image.Image, fit: FitToSize) -> Image.Image:
        """Extra layers in order, bottom first, then the single text of ``fit_text``."""
        for layer in fit.layers:
            if isinstance(layer, ImageLayer):
                canvas = cls._draw_image_layer(canvas, layer)
            else:
                canvas = render_text_overlay(canvas, layer)
        if fit.text is not None:
            canvas = render_text_overlay(canvas, fit.text)
        return canvas

    @classmethod
    def _draw_image_layer(cls, canvas: Image.Image, layer: ImageLayer) -> Image.Image:
        """Draws a picture layer; transparency in the picture is kept."""
        if layer.image is None:
            raise ValueError("A picture layer has no picture.")
        picture = to_8bit(layer.image).convert("RGBA")
        if layer.opacity < 1:
            opacity = layer.opacity
            picture.putalpha(picture.getchannel("A").point(lambda a: round(a * opacity)))
        if canvas.mode not in ("RGB", "RGBA"):
            canvas = canvas.convert("RGBA")
        else:
            canvas = canvas.copy()
        width, height = canvas.size
        cls._draw_turned(
            canvas,
            picture,
            (layer.x * width, layer.y * height),
            (layer.width * width, layer.height * height),
            layer.rotation,
        )
        return canvas

    @classmethod
    def _fit_canvas(
        cls, img: Image.Image, fit: FitToSize, size: tuple[int, int]
    ) -> Image.Image:
        if img.mode in ("P", "PA"):
            img = img.convert("RGBA" if cls._has_alpha(img) else "RGB")
        if fit.mode == FitMode.IMAGE and fit.background.image is None:
            raise ValueError("Fit mode image needs a background image.")
        if fit.mode in PLACEABLE_FIT_MODES and (
            fit.placement is not None
            or fit.mode == FitMode.IMAGE
            or not fit.background.is_plain
        ):
            return cls._fit_placed(img, fit, size)
        if fit.mode == FitMode.BLUR:
            return cls._fit_on_blurred_background(img, fit.width, fit.height, size)
        if fit.mode in (FitMode.SOLID, FitMode.TRANSPARENT):
            return cls._fit_on_solid_background(img, fit.width, fit.height, size, fit)
        box = cls.fit_crop_box(img, fit.width, fit.height, fit.anchor)
        if fit.placement is not None and fit.placement.rotation:
            return cls._fill_turned(img, box, size, fit.placement.rotation)
        return img.resize(size, Image.Resampling.LANCZOS, box=box)

    @staticmethod
    def _fill_turned(
        img: Image.Image, box: tuple[float, float, float, float],
        size: tuple[int, int], angle: float,
    ) -> Image.Image:
        """
        Fill frame with a tilt: the filled picture is zoomed just enough that,
        turned clockwise about its centre, it still covers every corner. The
        editor shows the same with CSS scale() and rotate().
        """
        width, height = size
        rad = math.radians(angle)
        cos, sin = abs(math.cos(rad)), abs(math.sin(rad))
        factor = max((width * cos + height * sin) / width, (width * sin + height * cos) / height)
        big_size = (max(1, round(width * factor)), max(1, round(height * factor)))
        big = img.resize(big_size, Image.Resampling.LANCZOS, box=box)
        alpha = big.mode in ("RGBA", "LA")
        if alpha:
            big = big.convert("RGBa")
        turned = big.rotate(
            -angle, resample=Image.Resampling.BICUBIC,
            center=(big.width / 2, big.height / 2),
        )
        if alpha:
            turned = turned.convert("RGBA")
        left = round((big.width - width) / 2)
        top = round((big.height - height) / 2)
        return turned.crop((left, top, left + width, top + height))

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
    def _fit_on_blurred_background(
        cls, img: Image.Image, width: int, height: int, output_size: tuple[int, int]
    ) -> Image.Image:
        # Blur and compositing work on 8-bit RGB; the output is opaque anyway.
        img = to_8bit(img)
        rgba, flat = cls._flatten_for_blur(img)
        background = cls._blurred_background(flat, width, height, output_size)

        ratio = min(width / img.width, height / img.height)
        size = (max(1, min(width, round(img.width * ratio))), max(1, min(height, round(img.height * ratio))))
        offset = ((width - size[0]) // 2, (height - size[1]) // 2)
        scale_x, scale_y = output_size[0] / width, output_size[1] / height
        size = (max(1, round(size[0] * scale_x)), max(1, round(size[1] * scale_y)))
        offset = (round(offset[0] * scale_x), round(offset[1] * scale_y))
        if rgba is not None:
            foreground = rgba.resize(size, Image.Resampling.LANCZOS)
            background.paste(foreground.convert("RGB"), offset, mask=foreground.getchannel("A"))
        else:
            background.paste(flat.resize(size, Image.Resampling.LANCZOS), offset)
        return background

    @classmethod
    def _flatten_for_blur(cls, img: Image.Image) -> tuple[Image.Image | None, Image.Image]:
        """The image with alpha (or None) and an opaque RGB copy to blur."""
        if cls._has_alpha(img):
            rgba = img.convert("RGBA")
            # Transparent areas would blur into whatever colour hides behind
            # them (often black), so flatten onto white first.
            flat = Image.new("RGB", rgba.size, (255, 255, 255))
            flat.paste(rgba.convert("RGB"), mask=rgba.getchannel("A"))
            return rgba, flat
        return None, img.convert("RGB")

    @staticmethod
    def blur_radius(
        width: int, height: int, output_size: tuple[int, int], strength: float = DEFAULT_BLUR_STRENGTH
    ) -> float:
        """
        Gaussian radius in output pixels for a blur ``strength`` (0..1). The
        default strength gives exactly the radius blur mode always used; the
        radius grows linearly with the strength, so 0 is no blur at all.
        """
        base = max(2.0, max(width, height) * _BLUR_RADIUS_SHARE) * max(output_size) / max(width, height)
        if strength == DEFAULT_BLUR_STRENGTH:
            return base
        return base * strength / DEFAULT_BLUR_STRENGTH

    @classmethod
    def _blurred_background(
        cls,
        flat: Image.Image,
        width: int,
        height: int,
        output_size: tuple[int, int],
        strength: float = DEFAULT_BLUR_STRENGTH,
    ) -> Image.Image:
        box = cls.fit_crop_box(flat, width, height, FitAnchor.CENTER)
        background = flat.resize(output_size, Image.Resampling.LANCZOS, box=box)
        radius = cls.blur_radius(width, height, output_size, strength)
        if radius > 0:
            background = background.filter(ImageFilter.GaussianBlur(radius))
        return ImageEnhance.Brightness(background).enhance(_BLUR_BRIGHTNESS)

    @staticmethod
    def placement_box(
        source_size: tuple[int, int], width: int, height: int, placement: FitPlacement
    ) -> tuple[float, float, float, float]:
        """
        Left, top, width and height of the whole image on a ``width`` x
        ``height`` canvas. The editor uses the same formula for its live preview.
        """
        source_width, source_height = source_size
        ratio = min(width / source_width, height / source_height) * placement.scale
        placed_width, placed_height = source_width * ratio, source_height * ratio
        left = placement.x * width - placed_width / 2
        top = placement.y * height - placed_height / 2
        return left, top, placed_width, placed_height

    @classmethod
    def _fit_placed(
        cls, img: Image.Image, fit: FitToSize, output_size: tuple[int, int]
    ) -> Image.Image:
        """
        Blur, solid, transparent or image background with the image at
        ``fit.placement`` (centred at full size when there is none).
        """
        img = to_8bit(img)
        placement = fit.placement or FitPlacement()
        if fit.mode == FitMode.BLUR:
            rgba, flat = cls._flatten_for_blur(img)
            canvas = cls._blurred_background(
                flat, fit.width, fit.height, output_size, fit.background.blur_for(fit.mode)
            )
            foreground = rgba if rgba is not None else flat
        elif fit.mode == FitMode.IMAGE:
            canvas = cls._image_background(
                fit.background.image, output_size, fit.background.image_placement
            )
            radius = cls.blur_radius(
                fit.width, fit.height, output_size, fit.background.blur_for(fit.mode)
            )
            if radius > 0:
                canvas = canvas.filter(ImageFilter.GaussianBlur(radius))
            foreground = img.convert("RGBA") if cls._has_alpha(img) else img.convert("RGB")
        else:
            if fit.mode == FitMode.TRANSPARENT or fit.color.strip().lower() == "transparent":
                background = (0, 0, 0, 0)
            else:
                background = cls._parse_rgba_hex(fit.color)
            if fit.background.color_to and fit.mode == FitMode.SOLID:
                canvas = linear_gradient(
                    output_size,
                    background[:3],
                    cls._parse_rgba_hex(fit.background.color_to)[:3],
                    fit.background.gradient_angle,
                )
                if cls._has_alpha(img):
                    canvas = canvas.convert("RGBA")
                    foreground = img.convert("RGBA")
                else:
                    foreground = img.convert("RGB")
            elif background[3] < 255 or cls._has_alpha(img):
                canvas = Image.new("RGBA", output_size, background)
                foreground = img.convert("RGBA")
            else:
                canvas = Image.new("RGB", output_size, background[:3])
                foreground = img.convert("RGB")
            if fit.mode == FitMode.SOLID and fit.background.pattern != FitPattern.NONE:
                canvas = cls._draw_pattern(canvas, fit, background)
        if fit.background.tint > 0:
            canvas = cls._tint(
                canvas,
                fit.background.tint_color,
                fit.background.tint,
                fit.background.tint_color_to,
                fit.background.tint_angle,
            )
        if fit.background.dim > 0:
            canvas = cls._dim(canvas, fit.background.dim)
        cls._paste_placed(canvas, foreground, fit, placement)
        return canvas

    @classmethod
    def _image_background(
        cls,
        image: Image.Image,
        output_size: tuple[int, int],
        placement: Optional[FitPlacement] = None,
    ) -> Image.Image:
        """
        The background picture, opaque. Without ``placement`` it covers the
        canvas, centred; otherwise it is scaled relative to that size, moved
        and turned, and uncovered areas stay white.
        """
        image = to_8bit(image)
        if cls._has_alpha(image):
            rgba = image.convert("RGBA")
            flat = Image.new("RGB", rgba.size, (255, 255, 255))
            flat.paste(rgba.convert("RGB"), mask=rgba.getchannel("A"))
        else:
            flat = image.convert("RGB")
        if placement is None:
            box = cls.fit_crop_box(flat, output_size[0], output_size[1], FitAnchor.CENTER)
            return flat.resize(output_size, Image.Resampling.LANCZOS, box=box)
        width, height = output_size
        ratio = max(width / flat.width, height / flat.height) * placement.scale
        canvas = Image.new("RGB", output_size, (255, 255, 255))
        cls._draw_turned(
            canvas,
            flat,
            (placement.x * width, placement.y * height),
            (flat.width * ratio, flat.height * ratio),
            placement.rotation,
        )
        return canvas

    @classmethod
    def _tint(
        cls,
        canvas: Image.Image,
        color: str,
        opacity: float,
        color_to: Optional[str] = None,
        angle: float = 180.0,
    ) -> Image.Image:
        """
        Lays ``color`` (or a gradient to ``color_to``) at ``opacity`` over the
        colours; alpha stays as it is.
        """
        rgb = canvas.convert("RGB")
        start = cls._parse_rgba_hex(color)[:3]
        layer = (
            linear_gradient(rgb.size, start, cls._parse_rgba_hex(color_to)[:3], angle)
            if color_to
            else Image.new("RGB", rgb.size, start)
        )
        tinted = Image.blend(rgb, layer, opacity)
        if canvas.mode == "RGBA":
            tinted.putalpha(canvas.getchannel("A"))
        return tinted

    @staticmethod
    def _dim(canvas: Image.Image, dim: float) -> Image.Image:
        """Lays black at ``dim`` opacity over the colours; alpha stays as it is."""
        if canvas.mode == "RGBA":
            rgb = ImageEnhance.Brightness(canvas.convert("RGB")).enhance(1 - dim)
            rgb.putalpha(canvas.getchannel("A"))
            return rgb
        return ImageEnhance.Brightness(canvas).enhance(1 - dim)

    @classmethod
    def _draw_pattern(
        cls, canvas: Image.Image, fit: FitToSize, colour: tuple[int, int, int, int]
    ) -> Image.Image:
        """
        Draws ``fit.background.pattern`` over ``canvas``. Geometry is in target
        pixels and sampled at pixel centres, so the preview, the export and the
        editor's CSS version all line up.
        """
        red, green, blue = colour[:3]
        light = 0.2126 * red + 0.7152 * green + 0.0722 * blue > 127.5
        ink = (0, 0, 0) if light else (255, 255, 255)
        mask = cls._pattern_mask(fit.background.pattern, canvas.size, fit.width, fit.height)
        layer = Image.new("RGBA", canvas.size, (*ink, 0))
        layer.putalpha(mask)
        if canvas.mode == "RGBA":
            # Ink over a see-through colour: the ink adds to the coverage.
            return Image.alpha_composite(canvas, layer)
        return Image.alpha_composite(canvas.convert("RGBA"), layer).convert("RGB")

    @staticmethod
    def _pattern_mask(
        pattern: FitPattern, output_size: tuple[int, int], width: int, height: int
    ) -> Image.Image:
        out_width, out_height = output_size
        scale_x, scale_y = out_width / width, out_height / height
        cell = max(width, height) * _PATTERN_CELL_SHARE
        # Pixel centres in target pixels.
        u = (np.arange(out_width) + 0.5) / scale_x
        rows = []
        for start in range(0, out_height, _PATTERN_ROWS):
            v = ((np.arange(start, min(out_height, start + _PATTERN_ROWS)) + 0.5) / scale_y)[:, None]
            if pattern == FitPattern.CHECKER:
                inked = (np.floor(u / cell) + np.floor(v / cell)) % 2 == 1
            elif pattern == FitPattern.DOTS:
                du = u % cell - cell / 2
                dv = v % cell - cell / 2
                inked = du * du + dv * dv <= (cell * _PATTERN_DOT_RADIUS) ** 2
            elif pattern == FitPattern.STRIPES:
                inked = (u + v) % cell < cell / 2
            else:
                line = max(1 / min(scale_x, scale_y), cell * _PATTERN_LINE_WIDTH)
                inked = (u % cell < line) | (v % cell < line)
            rows.append(np.broadcast_to(inked, (v.shape[0], out_width)))
        alpha = np.where(np.vstack(rows), _PATTERN_INK_ALPHA, 0).astype(np.uint8)
        return Image.fromarray(alpha)

    @classmethod
    def _paste_placed(
        cls, canvas: Image.Image, img: Image.Image, fit: FitToSize, placement: FitPlacement
    ) -> None:
        """
        Draws ``img`` onto ``canvas`` at ``placement``. Only the visible part
        is resampled, so a large scale never allocates more than the canvas.
        """
        scale_x = canvas.width / fit.width
        scale_y = canvas.height / fit.height
        left, top, placed_width, placed_height = cls.placement_box(
            img.size, fit.width, fit.height, placement
        )
        left, top = left * scale_x, top * scale_y
        placed_width, placed_height = placed_width * scale_x, placed_height * scale_y
        if placement.rotation:
            cls._draw_turned(
                canvas,
                img,
                (left + placed_width / 2, top + placed_height / 2),
                (placed_width, placed_height),
                placement.rotation,
            )
            return
        x0, y0 = max(0, round(left)), max(0, round(top))
        x1 = min(canvas.width, round(left + placed_width))
        y1 = min(canvas.height, round(top + placed_height))
        if x1 <= x0 or y1 <= y0:
            return
        source_x = img.width / placed_width
        source_y = img.height / placed_height
        box = (
            max(0.0, (x0 - left) * source_x),
            max(0.0, (y0 - top) * source_y),
            min(float(img.width), (x1 - left) * source_x),
            min(float(img.height), (y1 - top) * source_y),
        )
        if box[2] <= box[0] or box[3] <= box[1]:
            return
        part = img.resize((x1 - x0, y1 - y0), Image.Resampling.LANCZOS, box=box)
        if canvas.mode == "RGBA":
            canvas.alpha_composite(part.convert("RGBA"), dest=(x0, y0))
        elif part.mode == "RGBA":
            canvas.paste(part.convert("RGB"), (x0, y0), mask=part.getchannel("A"))
        else:
            canvas.paste(part, (x0, y0))

    @staticmethod
    def _draw_turned(
        canvas: Image.Image,
        img: Image.Image,
        centre: tuple[float, float],
        size: tuple[float, float],
        angle: float,
    ) -> None:
        """
        Draws ``img`` stretched to ``size`` canvas pixels, turned ``angle``
        degrees clockwise about ``centre``. One affine resample of only the
        covered part of the canvas: no full-size intermediate, whatever the
        scale. Matches CSS ``rotate()`` about the element centre.
        """
        width, height = size
        if width <= 0 or height <= 0:
            return
        rad = math.radians(angle)
        cos, sin = math.cos(rad), math.sin(rad)
        reach_x = abs(width / 2 * cos) + abs(height / 2 * sin)
        reach_y = abs(width / 2 * sin) + abs(height / 2 * cos)
        x0 = max(0, math.floor(centre[0] - reach_x))
        y0 = max(0, math.floor(centre[1] - reach_y))
        x1 = min(canvas.width, math.ceil(centre[0] + reach_x))
        y1 = min(canvas.height, math.ceil(centre[1] + reach_y))
        if x1 <= x0 or y1 <= y0:
            return
        source = img.convert("RGBA")
        # A strong reduction first, so the bicubic resample does not alias.
        if width < source.width / 2 and height < source.height / 2:
            source = source.resize(
                (max(1, round(width * 2)), max(1, round(height * 2))),
                Image.Resampling.LANCZOS,
            )
        # One transparent pixel around the picture gives smooth turned edges.
        padded = Image.new("RGBA", (source.width + 2, source.height + 2), (0, 0, 0, 0))
        padded.paste(source, (1, 1))
        step_x, step_y = source.width / width, source.height / height
        # Canvas point -> picture point: undo the move, the turn, the scale.
        dx, dy = x0 - centre[0], y0 - centre[1]
        coefficients = (
            step_x * cos,
            step_x * sin,
            step_x * (cos * dx + sin * dy) + padded.width / 2,
            -step_y * sin,
            step_y * cos,
            step_y * (-sin * dx + cos * dy) + padded.height / 2,
        )
        part = padded.transform(
            (x1 - x0, y1 - y0),
            Image.Transform.AFFINE,
            coefficients,
            resample=Image.Resampling.BICUBIC,
            fillcolor=(0, 0, 0, 0),
        )
        if canvas.mode == "RGBA":
            canvas.alpha_composite(part, dest=(x0, y0))
        else:
            canvas.paste(part.convert("RGB"), (x0, y0), mask=part.getchannel("A"))

    @classmethod
    def _fit_on_solid_background(
        cls,
        img: Image.Image,
        width: int,
        height: int,
        output_size: tuple[int, int],
        fit: FitToSize,
    ) -> Image.Image:
        img = to_8bit(img)
        if fit.mode == FitMode.TRANSPARENT or fit.color.strip().lower() == "transparent":
            bg_rgba = (0, 0, 0, 0)
            is_transparent = True
        else:
            bg_rgba = cls._parse_rgba_hex(fit.color)
            is_transparent = (bg_rgba[3] < 255)

        has_alpha = cls._has_alpha(img) or is_transparent

        ratio = min(width / img.width, height / img.height)
        size = (max(1, min(width, round(img.width * ratio))), max(1, min(height, round(img.height * ratio))))
        free_x = width - size[0]
        free_y = height - size[1]
        offset_x = {FitAnchor.LEFT: 0, FitAnchor.RIGHT: free_x}.get(fit.anchor, free_x // 2)
        offset_y = {FitAnchor.TOP: 0, FitAnchor.BOTTOM: free_y}.get(fit.anchor, free_y // 2)
        offset = (offset_x, offset_y)

        scale_x, scale_y = output_size[0] / width, output_size[1] / height
        target_size = (max(1, round(size[0] * scale_x)), max(1, round(size[1] * scale_y)))
        target_offset = (round(offset[0] * scale_x), round(offset[1] * scale_y))

        if has_alpha:
            canvas = Image.new("RGBA", output_size, bg_rgba)
            fg = img.convert("RGBA").resize(target_size, Image.Resampling.LANCZOS)
            canvas.paste(fg, target_offset, mask=fg.getchannel("A"))
            return canvas
        else:
            canvas = Image.new("RGB", output_size, bg_rgba[:3])
            fg = img.convert("RGB").resize(target_size, Image.Resampling.LANCZOS)
            canvas.paste(fg, target_offset)
            return canvas

    @staticmethod
    def _parse_rgba_hex(color: str) -> tuple[int, int, int, int]:
        cleaned = color.lstrip("#")
        if len(cleaned) == 6:
            return (int(cleaned[0:2], 16), int(cleaned[2:4], 16), int(cleaned[4:6], 16), 255)
        elif len(cleaned) == 8:
            return (
                int(cleaned[0:2], 16),
                int(cleaned[2:4], 16),
                int(cleaned[4:6], 16),
                int(cleaned[6:8], 16),
            )
        return (255, 255, 255, 255)

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
