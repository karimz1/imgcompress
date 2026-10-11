from io import BytesIO
from urllib.request import urlopen

from backend.image_converter.core.internals.utilities import Result


class ExternalSvgResourceError(ValueError):
    """An uploaded SVG attempted to load a file or network resource."""


def _fetch_embedded_resource(url: str, _resource_type: str) -> bytes:
    if not url.startswith("data:"):
        raise ExternalSvgResourceError(
            "SVG resources must be embedded; external references are not supported."
        )
    with urlopen(url) as resource:
        return resource.read()


class SvgRenderer:
    """Render self-contained SVG uploads into transparent PNG payloads."""

    def __init__(self, logger=None):
        self.logger = logger

    def render(self, source_name: str, data: bytes) -> Result[bytes]:
        try:
            from cairosvg.parser import Tree
            from cairosvg.surface import PNGSurface
        except (ImportError, OSError):
            return Result.failure(
                "CairoSVG and the Cairo system library must be installed to process SVG files."
            )

        try:
            # CairoSVG handles XML entities and CSS parsing. The same fetcher
            # applies to images, stylesheets, use elements, and nested SVGs.
            tree = Tree(
                bytestring=data, unsafe=False, url_fetcher=_fetch_embedded_resource
            )
            if tree.tag != "svg":
                raise ValueError("The document is not an SVG image.")
            buffer = BytesIO()
            surface = PNGSurface(tree, buffer, dpi=96)
            surface.finish()
            return Result.success(buffer.getvalue())
        except ExternalSvgResourceError as exc:
            return Result.failure(str(exc))
        except Exception as exc:  # noqa: BLE001 - Third-party rendering errors cross a Result boundary.
            if self.logger:
                self.logger.log(
                    f"Failed to render SVG '{source_name}': {exc!r}", "error"
                )
            return Result.failure("SVG could not be rendered.")
