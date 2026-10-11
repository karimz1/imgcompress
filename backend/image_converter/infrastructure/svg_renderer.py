from xml.etree.ElementTree import ParseError, tostring

from backend.image_converter.core.internals.utilities import Result


class SvgRenderer:
    """Render self-contained SVG uploads into transparent PNG payloads."""

    def __init__(self, logger=None):
        self.logger = logger

    def render(self, source_name: str, data: bytes) -> Result[bytes]:
        try:
            from defusedxml.common import DefusedXmlException
            from defusedxml.ElementTree import fromstring
            from resvg_py import svg_to_bytes
        except ImportError:
            return Result.failure(
                "resvg-py and defusedxml must be installed to process SVG files."
            )

        try:
            root = fromstring(data)
            if root.tag != "{http://www.w3.org/2000/svg}svg":
                raise ValueError("The document is not an SVG image.")

            # resvg can read local images by default. Only allow embedded images
            # and fragment references in uploaded SVGs, including filter images.
            for element in root.iter():
                if element.tag.rsplit("}", 1)[-1] not in ("image", "feImage"):
                    continue
                for attribute, value in element.attrib.items():
                    if attribute.rsplit("}", 1)[
                        -1
                    ] == "href" and not value.strip().startswith(("#", "data:")):
                        return Result.failure(
                            "SVG images must be embedded; external image references are not supported."
                        )

            png_bytes = svg_to_bytes(svg_string=tostring(root, encoding="unicode"))
            return Result.success(png_bytes)
        except (DefusedXmlException, ParseError, ValueError, RuntimeError) as exc:
            if self.logger:
                self.logger.log(
                    f"Failed to render SVG '{source_name}': {exc!r}", "error"
                )
            return Result.failure("SVG could not be rendered.")
