"""Text / watermark overlay drawn on a finished canvas.

Only bundled fonts can be used: a font is picked by an id from FONT_FILES,
never by a path, so a request cannot make the server open arbitrary files.
The same font files are served to the browser (frontend/public/fonts), so
the editor preview and the export use identical glyphs.

Layout, so the browser can match it with plain CSS:
  font-size   = size * canvas height (px)
  line-height = LINE_HEIGHT * font-size
  lines aligned inside the block (text-align: left, center or right)
  the block of lines is centred on (x * width, y * height)
  rotation    = degrees clockwise about that centre (CSS rotate()), shadow included
"""

import math
import unicodedata
from dataclasses import dataclass
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from types import MappingProxyType
from typing import Any, Mapping

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from backend.image_converter.core.internals.utilities import Result

MAX_TEXT_LENGTH = 200
MAX_TEXT_LINES = 10

# Font size as a share of the canvas height, so the text keeps its look
# in the scaled preview and the full-size export.
MIN_TEXT_SIZE = 0.01
MAX_TEXT_SIZE = 0.5
DEFAULT_TEXT_SIZE = 0.08
DEFAULT_TEXT_COLOR = "#ffffff"
LINE_HEIGHT = 1.2

# Soft drop shadow: offset and blur as a share of the font size.
_SHADOW_OFFSET = 0.04
_SHADOW_BLUR = 0.06
_SHADOW_ALPHA = 0.5

FONTS_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"


def _faces(folder: str, prefix: str, *, italics: bool = True) -> Mapping[tuple[bool, bool], str]:
    regular, bold = f"{folder}/{prefix}-Regular.ttf", f"{folder}/{prefix}-Bold.ttf"
    return MappingProxyType({
        (False, False): regular,
        (True, False): bold,
        # Families without italics use the upright face, in the browser too.
        (False, True): f"{folder}/{prefix}-Italic.ttf" if italics else regular,
        (True, True): f"{folder}/{prefix}-BoldItalic.ttf" if italics else bold,
    })


# Font id -> (bold, italic) -> file relative to FONTS_DIR. Read-only.
FONT_FILES: Mapping[str, Mapping[tuple[bool, bool], str]] = MappingProxyType({
    "inter": _faces("inter", "Inter"),
    "noto-serif": _faces("noto-serif", "NotoSerif"),
    "jetbrains-mono": _faces("jetbrains-mono", "JetBrainsMono"),
    "caveat": _faces("caveat", "Caveat", italics=False),
})
DEFAULT_FONT_ID = "inter"
TEXT_ALIGNS = ("left", "center", "right")


def _clean_text(value: Any) -> str:
    """Newlines kept, other control characters dropped, length and lines capped."""
    text = str(value or "").replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\u2028", "\n").replace("\u2029", "\n")
    text = "".join(
        ch for ch in text
        if ch == "\n" or unicodedata.category(ch) not in ("Cc", "Cs")
    )
    text = "\n".join(text.split("\n")[:MAX_TEXT_LINES])
    return text[:MAX_TEXT_LENGTH]


def _clamp(value: Any, label: str, low: float, high: float) -> float:
    """A number pulled into low..high. Words, NaN and infinity are refused."""
    if isinstance(value, bool):
        raise ValueError(f"Text {label} must be a number, got '{value}'.")
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"Text {label} must be a number, got '{value}'.") from None
    if not math.isfinite(parsed):
        raise ValueError(f"Text {label} must be a number, got '{value}'.")
    return min(high, max(low, parsed))


def _fold_angle(angle: float) -> float:
    """Degrees in (-180, 180], like the image and picture layers."""
    folded = math.fmod(angle, 360.0)
    if folded > 180:
        folded -= 360
    elif folded <= -180:
        folded += 360
    return folded + 0.0


def _parse_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ("1", "true", "yes", "on")


def _parse_color(value: Any) -> str:
    """'#rgb' or '#rrggbb', returned as lower-case '#rrggbb'."""
    text = str(value or "").strip().lower()
    digits = text[1:] if text.startswith("#") else ""
    if len(digits) == 3:
        digits = "".join(ch * 2 for ch in digits)
    if len(digits) != 6 or any(ch not in "0123456789abcdef" for ch in digits):
        raise ValueError(f"Text colour must look like #rrggbb, got '{value}'.")
    return f"#{digits}"


def _parse_align(value: Any) -> str:
    if value not in TEXT_ALIGNS:
        raise ValueError(f"Text alignment must be one of: {', '.join(TEXT_ALIGNS)}.")
    return value


def _parse_font_id(value: Any) -> str:
    if not isinstance(value, str) or value not in FONT_FILES:
        raise ValueError(
            f"Unknown text font '{value}'. Use one of: {', '.join(FONT_FILES)}."
        )
    return value


@dataclass(frozen=True)
class TextSpec:
    """One line or block of text placed on the canvas.

    size is the font size as a share of the canvas height; x and y are the
    centre of the text block as a share of the canvas (0..1). Every value is
    checked and clamped on construction, so an instance is always safe to draw.
    """

    text: str
    font_id: str = DEFAULT_FONT_ID
    bold: bool = False
    italic: bool = False
    size: float = DEFAULT_TEXT_SIZE
    color: str = DEFAULT_TEXT_COLOR
    opacity: float = 1.0
    x: float = 0.5
    y: float = 0.5
    shadow: bool = False
    align: str = "center"
    rotation: float = 0.0

    def __post_init__(self) -> None:
        normalised = {
            "text": _clean_text(self.text),
            "font_id": _parse_font_id(self.font_id),
            "bold": _parse_bool(self.bold),
            "italic": _parse_bool(self.italic),
            "size": _clamp(self.size, "size", MIN_TEXT_SIZE, MAX_TEXT_SIZE),
            "color": _parse_color(self.color),
            "opacity": _clamp(self.opacity, "opacity", 0.0, 1.0),
            "x": _clamp(self.x, "x position", 0.0, 1.0),
            "y": _clamp(self.y, "y position", 0.0, 1.0),
            "shadow": _parse_bool(self.shadow),
            "align": _parse_align(self.align),
            "rotation": _fold_angle(_clamp(self.rotation, "rotation", -1e6, 1e6)),
        }
        for name, value in normalised.items():
            object.__setattr__(self, name, value)

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "TextSpec":
        """Builds a spec from request data; missing keys get their defaults.

        Raises ValueError for an unknown font, a bad colour or a non-number.
        """
        if not isinstance(data, Mapping):
            raise ValueError("Text settings must be an object.")
        keys = ("text", "font_id", "bold", "italic", "size", "color",
                "opacity", "x", "y", "shadow", "align", "rotation")
        return cls(**{key: data[key] for key in keys if key in data})

    @classmethod
    def from_dict_result(cls, data: Mapping[str, Any]) -> Result["TextSpec"]:
        try:
            return Result.success(cls.from_dict(data))
        except (TypeError, ValueError) as exc:
            return Result.failure(str(exc))

    @property
    def is_visible(self) -> bool:
        return bool(self.text.strip()) and self.opacity > 0


@lru_cache(maxsize=None)
def _font_bytes(relative_path: str) -> bytes:
    """Font file contents. Cached bytes are immutable, so threads can share them."""
    return (FONTS_DIR / relative_path).read_bytes()


def font_path(font_id: str, bold: bool = False, italic: bool = False) -> Path:
    return FONTS_DIR / FONT_FILES[_parse_font_id(font_id)][(bool(bold), bool(italic))]


def _load_font(spec: TextSpec, pixel_size: int) -> ImageFont.FreeTypeFont:
    # A fresh FreeType face per render: faces are not shared between threads.
    data = _font_bytes(FONT_FILES[spec.font_id][(spec.bold, spec.italic)])
    return ImageFont.truetype(BytesIO(data), pixel_size)


def _draw_lines(size: tuple[int, int], spec: TextSpec, font, pixel_size: int,
                fill: tuple[int, int, int, int], offset: float = 0.0,
                centre: tuple[float, float] | None = None) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    lines = spec.text.split("\n")
    line_height = LINE_HEIGHT * pixel_size
    cx, cy = centre if centre is not None else (spec.x * size[0], spec.y * size[1])
    centre_x = cx + offset
    top = cy - line_height * len(lines) / 2 + offset
    # Left and right alignment line up with the edges of the widest line.
    half_block = max(font.getlength(line) for line in lines) / 2
    x, anchor = {
        "left": (centre_x - half_block, "lm"),
        "right": (centre_x + half_block, "rm"),
    }.get(spec.align, (centre_x, "mm"))
    for index, line in enumerate(lines):
        if line:
            draw.text((x, top + line_height * (index + 0.5)), line,
                      font=font, fill=fill, anchor=anchor)
    return layer


def _text_overlay(size: tuple[int, int], spec: TextSpec, font, pixel_size: int,
                  centre: tuple[float, float] | None = None) -> Image.Image:
    """Shadow and text of ``spec`` on a transparent layer of ``size``."""
    red, green, blue = (int(spec.color[i:i + 2], 16) for i in (1, 3, 5))
    overlay = Image.new("RGBA", size, (0, 0, 0, 0))
    if spec.shadow:
        shadow = _draw_lines(size, spec, font, pixel_size, (0, 0, 0, 255),
                             offset=_SHADOW_OFFSET * pixel_size, centre=centre)
        shadow = shadow.filter(ImageFilter.GaussianBlur(_SHADOW_BLUR * pixel_size))
        alpha = shadow.getchannel("A").point(lambda a: round(a * _SHADOW_ALPHA))
        shadow.putalpha(alpha)
        overlay = Image.alpha_composite(overlay, shadow)
    text_layer = _draw_lines(size, spec, font, pixel_size, (red, green, blue, 255), centre=centre)
    return Image.alpha_composite(overlay, text_layer)


def _turned_overlay(size: tuple[int, int], spec: TextSpec, font, pixel_size: int) -> Image.Image:
    """
    The text drawn straight on a square tile around its centre, turned there
    and placed on a canvas-sized layer. The tile covers the whole turned block
    plus shadow, so nothing is cut off that CSS would show.
    """
    lines = spec.text.split("\n")
    block_w = max(font.getlength(line) for line in lines)
    block_h = LINE_HEIGHT * pixel_size * len(lines)
    half = math.ceil(math.hypot(block_w, block_h) / 2 + 1.5 * pixel_size)
    cx, cy = spec.x * size[0], spec.y * size[1]
    # A whole-pixel origin keeps the sub-pixel position of the straight text.
    ox, oy = math.floor(cx) - half, math.floor(cy) - half
    local = (cx - ox, cy - oy)
    tile = _text_overlay((2 * half + 2, 2 * half + 2), spec, font, pixel_size, centre=local)
    # Premultiplied while resampling, so the edges do not get a dark fringe.
    tile = tile.convert("RGBa").rotate(
        -spec.rotation, resample=Image.Resampling.BICUBIC, center=local
    ).convert("RGBA")
    overlay = Image.new("RGBA", size, (0, 0, 0, 0))
    overlay.paste(tile, (ox, oy))
    return overlay


def render_text_overlay(canvas: Image.Image, spec: TextSpec) -> Image.Image:
    """Returns a new image with the text drawn on top; the input is not changed.

    RGB stays RGB and RGBA stays RGBA; other modes come back as RGBA.
    """
    if not spec.is_visible:
        return canvas.copy()

    height = canvas.size[1]
    pixel_size = max(1, round(spec.size * height))
    font = _load_font(spec, pixel_size)
    if spec.rotation:
        overlay = _turned_overlay(canvas.size, spec, font, pixel_size)
    else:
        overlay = _text_overlay(canvas.size, spec, font, pixel_size)

    if spec.opacity < 1:
        opacity = spec.opacity
        overlay.putalpha(overlay.getchannel("A").point(lambda a: round(a * opacity)))

    base = canvas if canvas.mode == "RGBA" else canvas.convert("RGBA")
    result = Image.alpha_composite(base, overlay)
    return result.convert("RGB") if canvas.mode == "RGB" else result
