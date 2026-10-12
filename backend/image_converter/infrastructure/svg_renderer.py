from base64 import b64encode
from dataclasses import dataclass
from gzip import decompress
from io import BytesIO
from math import isfinite
from types import SimpleNamespace
from urllib.request import urlopen
from xml.etree.ElementTree import Element, tostring

from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.domain.fit_to_size import FitAnchor, FitMode, FitToSize
from backend.image_converter.domain.upscaling import UpscaleTarget, plan_upscale


class ExternalSvgResourceError(ValueError):
    """An uploaded SVG attempted to load a file or network resource."""


class SvgSizeError(ValueError):
    """The requested SVG raster exceeds the configured output limit."""


@dataclass(frozen=True)
class RenderedSvg:
    data: bytes
    source_size: tuple[int, int]


def wrap_svg_crop(
    data: bytes,
    source_size: tuple[float, float],
    crop: tuple[float, float, float, float],
) -> bytes:
    """Clip an embedded SVG in viewport pixels while retaining its vectors."""
    x, y, width, height = crop
    source_width, source_height = source_size
    encoded = b64encode(data).decode("ascii")
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="{x} {y} {width} {height}">
      <image href="data:image/svg+xml;base64,{encoded}" width="{source_width}" height="{source_height}"/>
    </svg>'''.encode()


def _require_embedded_resource(url: str) -> None:
    if not url.startswith("data:"):
        raise ExternalSvgResourceError(
            "SVG resources must be embedded; external references are not supported."
        )


def _validate_stylesheet_imports(stylesheet: str) -> None:
    from tinycss2 import parse_one_component_value, parse_stylesheet

    for rule in parse_stylesheet(stylesheet, skip_comments=True, skip_whitespace=True):
        if (
            rule.type != "at-rule"
            or rule.lower_at_keyword != "import"
            or rule.content is not None
        ):
            continue
        # The URL is the first token; media queries and layer declarations
        # may follow it. Quoted url() values are represented as functions.
        token = next(
            (
                part
                for part in rule.prelude
                if part.type not in ("whitespace", "comment")
            ),
            None,
        )
        if token is None:
            continue
        if token.type == "function" and token.lower_name == "url":
            token = parse_one_component_value(token.arguments, skip_comments=True)
        if token.type in ("string", "url"):
            _require_embedded_resource(token.value)


def _validate_svg_stylesheets(xml_tree: Element) -> None:
    for element in xml_tree.iter("{http://www.w3.org/2000/svg}style"):
        if element.get("type", "text/css") == "text/css" and element.text:
            _validate_stylesheet_imports(element.text)


def _fetch_embedded_resource(url: str, resource_type: str) -> bytes:
    _require_embedded_resource(url)
    svg_media_type = (
        url.split(";", 1)[0].split(",", 1)[0].lower() == "data:image/svg+xml"
    )
    with urlopen(url) as resource:
        data = resource.read()
    if resource_type == "text/css":
        _validate_stylesheet_imports(data.decode("utf-8"))
    elif (
        resource_type == "image/svg+xml"
        or svg_media_type
        or data.startswith((b"<?xml", b"<!DOC", b"\x1f\x8b"))
        or b"<svg" in data
    ):
        # CairoSVG also detects embedded SVGs by their contents, including
        # gzip payloads, even when the data URL has another media type.
        from defusedxml.ElementTree import fromstring

        svg_data = decompress(data) if data.startswith(b"\x1f\x8b") else data
        xml_tree = fromstring(svg_data, forbid_entities=True, forbid_external=True)
        _validate_svg_stylesheets(xml_tree)
        if svg_media_type:
            # CairoSVG identifies image contents by ASCII prefixes. A UTF-8
            # declaration also lets cropped SVGs with UTF-16 encoding or a
            # namespace-prefixed root stay recognizable as vector images.
            data = tostring(xml_tree, encoding="utf-8", xml_declaration=True)
    return data


class SvgRenderer:
    """Render self-contained SVG uploads into transparent PNG payloads."""

    def __init__(self, logger=None):
        self.logger = logger

    def render(
        self,
        source_name: str,
        data: bytes,
        *,
        width: int | None = None,
        upscale: UpscaleTarget | None = None,
        fit: FitToSize | None = None,
        preview: bool = False,
    ) -> Result[bytes]:
        rendered = self.render_image(
            source_name, data, width=width, upscale=upscale, fit=fit, preview=preview
        )
        if not rendered.is_successful:
            return Result.failure(rendered.error)
        return Result.success(rendered.value.data)

    def render_image(
        self,
        source_name: str,
        data: bytes,
        *,
        width: int | None = None,
        upscale: UpscaleTarget | None = None,
        fit: FitToSize | None = None,
        preview: bool = False,
    ) -> Result[RenderedSvg]:
        try:
            from cairosvg.helpers import node_format
            from cairosvg.parser import Tree
        except (ImportError, OSError):
            return Result.failure(
                "CairoSVG and the Cairo system library must be installed to process SVG files."
            )

        try:
            # The fetcher blocks resource reads. Check CSS imports too, since
            # CairoSVG silently skips some valid forms without calling it.
            tree = Tree(
                bytestring=data, unsafe=False, url_fetcher=_fetch_embedded_resource
            )
            if tree.tag != "svg":
                raise ValueError("The document is not an SVG image.")
            _validate_svg_stylesheets(tree.xml_tree)
            # Match CairoSVG's initial viewport without allocating a native-size
            # bitmap. Physical units, percentages and viewBox-only SVGs use the
            # same dimension resolver as the rendering surface.
            viewport = SimpleNamespace(
                dpi=96, font_size=16, context_width=None, context_height=None
            )
            source_width, source_height, _ = node_format(viewport, tree)
            if not all(
                isfinite(side) and side > 0 for side in (source_width, source_height)
            ):
                raise ValueError("The SVG size is undefined.")
            source_size = (max(1, round(source_width)), max(1, round(source_height)))

            if fit:
                png = self._render_fit(tree, data, source_size, fit)
            else:
                output_size = source_size
                if preview:
                    scale = 2048 / max(source_width, source_height)
                    output_size = (
                        max(1, round(source_width * scale)),
                        max(1, round(source_height * scale)),
                    )
                elif upscale:
                    plan = plan_upscale(
                        *source_size, upscale, self._max_output_pixels()
                    )
                    if not plan.is_successful:
                        raise SvgSizeError(plan.error)
                    output_size = plan.value.output_size
                elif width and width > 0:
                    output_size = (
                        width,
                        max(1, round(source_height * width / source_width)),
                    )
                png = self._render_png(
                    tree,
                    output_size,
                    width_only=bool(
                        width
                        and width > 0
                        and not upscale
                        and not preview
                        and source_height * width / source_width >= 1
                    ),
                )
            return Result.success(RenderedSvg(png, source_size))
        except (ExternalSvgResourceError, SvgSizeError) as exc:
            return Result.failure(str(exc))
        except Exception as exc:  # noqa: BLE001 - Third-party rendering errors cross a Result boundary.
            if self.logger:
                self.logger.log(
                    f"Failed to render SVG '{source_name}': {exc!r}", "error"
                )
            return Result.failure("SVG could not be rendered.")

    @staticmethod
    def _max_output_pixels() -> int:
        from backend.image_converter.config import settings

        return settings.get().upscaling.max_output_megapixels * 1_000_000

    def _check_output_size(self, output_size: tuple[int, int]) -> None:
        width, height = output_size
        limit = self._max_output_pixels()
        if width * height > limit:
            raise SvgSizeError(
                f"Rendering SVG at {width}x{height} exceeds the "
                f"{limit / 1_000_000:.0f} MP limit. Choose a smaller output size."
            )

    def _render_png(
        self, tree, output_size: tuple[int, int], *, width_only: bool = False
    ) -> bytes:
        from cairosvg.surface import PNGSurface

        self._check_output_size(output_size)
        width, height = output_size
        buffer = BytesIO()
        surface = PNGSurface(
            tree,
            buffer,
            dpi=96,
            output_width=width,
            output_height=None if width_only else height,
        )
        surface.finish()
        return buffer.getvalue()

    def _render_fit(self, tree, data: bytes, source_size, fit: FitToSize) -> bytes:
        from cairosvg.parser import Tree
        from PIL import Image

        from backend.image_converter.domain.image_resizer import ImageResizer

        self._check_output_size((fit.width, fit.height))
        width, height = source_size
        if fit.mode == FitMode.BLUR:
            # Only the contained foreground needs crisp pixels; the background
            # is intentionally blurred by the shared fit implementation.
            scale = min(fit.width / width, fit.height / height)
            png = self._render_png(
                tree, (max(1, round(width * scale)), max(1, round(height * scale)))
            )
            with Image.open(BytesIO(png)) as image:
                fitted = ImageResizer.fit_image(image, fit)
                buffer = BytesIO()
                fitted.save(buffer, format="PNG")
                return buffer.getvalue()

        scale = max(fit.width / width, fit.height / height)
        crop_width, crop_height = (
            min(width, fit.width / scale),
            min(height, fit.height / scale),
        )
        free_x, free_y = width - crop_width, height - crop_height
        x, y = free_x / 2, free_y / 2
        if fit.anchor == FitAnchor.AUTO and (free_x > 0 or free_y > 0):
            # Automatic placement can use a small analysis raster. The export
            # itself is drawn again from vectors at its final resolution.
            analysis_scale = min(1.0, 512 / max(width, height))
            analysis = self._render_png(
                tree,
                (
                    max(1, round(width * analysis_scale)),
                    max(1, round(height * analysis_scale)),
                ),
            )
            with Image.open(BytesIO(analysis)) as image:
                left, top, _, _ = ImageResizer.fit_crop_box(
                    image, fit.width, fit.height, FitAnchor.AUTO
                )
                x = min(free_x, max(0, left * width / image.width))
                y = min(free_y, max(0, top * height / image.height))
        elif fit.anchor == FitAnchor.TOP:
            y = 0
        elif fit.anchor == FitAnchor.BOTTOM:
            y = free_y
        elif fit.anchor == FitAnchor.LEFT:
            x = 0
        elif fit.anchor == FitAnchor.RIGHT:
            x = free_x

        cropped = wrap_svg_crop(data, source_size, (x, y, crop_width, crop_height))
        cropped_tree = Tree(
            bytestring=cropped, unsafe=False, url_fetcher=_fetch_embedded_resource
        )
        return self._render_png(cropped_tree, (fit.width, fit.height))
