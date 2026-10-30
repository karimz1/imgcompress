"""Extra layers drawn above the main image: texts and pictures, in order.

The editor sends them as one JSON list, bottom first. Pictures are not part
of the JSON: an image layer names an asset that was uploaded once per editor
session (see EditorAssetStore), and the decoded picture is attached for the
one request that draws it.
"""

import json
import math
import re
from dataclasses import dataclass, field
from typing import Any, Optional, Union

from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.domain.text_overlay import MAX_TEXT_LENGTH, TextSpec

MAX_IMAGE_LAYERS = 5
MAX_TEXT_LAYERS = 5
MAX_LAYERS_JSON_LENGTH = 16 * 1024

# Picture size as a share of the canvas width and height; the position is the
# centre as a share of the canvas and may lie partly outside it.
MIN_LAYER_SIZE = 0.005
MAX_LAYER_SIZE = 10.0
MIN_LAYER_POSITION = -1.0
MAX_LAYER_POSITION = 2.0

# Same shape as the tokens EditorAssetStore hands out.
ASSET_ID_PATTERN = re.compile(r"[A-Za-z0-9_-]{16,64}")


@dataclass(frozen=True)
class ImageLayer:
    """A picture centred on (x, y), ``width`` × ``height`` of the canvas, turned clockwise."""

    asset: str
    x: float = 0.5
    y: float = 0.5
    width: float = 0.25
    height: float = 0.25
    rotation: float = 0.0
    opacity: float = 1.0
    image: Optional[Any] = field(default=None, compare=False, repr=False)


Layer = Union[TextSpec, ImageLayer]


def parse_layers(value: Optional[str]) -> Result[tuple[Layer, ...]]:
    """The layer list as JSON. Blank means none; invisible layers are dropped."""
    value = (value or "").strip()
    if not value:
        return Result.success(())
    if len(value) > MAX_LAYERS_JSON_LENGTH:
        return Result.failure("The layer settings are too long.")
    try:
        data = json.loads(value)
    except ValueError:
        return Result.failure("The layer settings must be a JSON list.")
    if not isinstance(data, list):
        return Result.failure("The layer settings must be a JSON list.")

    layers: list[Layer] = []
    texts = images = 0
    for item in data:
        if not isinstance(item, dict):
            return Result.failure("Each layer must be a JSON object.")
        kind = item.get("type")
        if kind == "text":
            texts += 1
            if texts > MAX_TEXT_LAYERS:
                return Result.failure(f"At most {MAX_TEXT_LAYERS} text layers are allowed.")
            res = _parse_text_layer(item)
        elif kind == "image":
            images += 1
            if images > MAX_IMAGE_LAYERS:
                return Result.failure(f"At most {MAX_IMAGE_LAYERS} picture layers are allowed.")
            res = _parse_image_layer(item)
        else:
            return Result.failure("A layer type must be 'text' or 'image'.")
        if not res.is_successful:
            return Result.failure(res.error)
        if res.value is not None:
            layers.append(res.value)
    return Result.success(tuple(layers))


def _parse_text_layer(item: dict) -> Result[Optional[TextSpec]]:
    if len(str(item.get("text") or "")) > MAX_TEXT_LENGTH:
        return Result.failure(f"A text can have at most {MAX_TEXT_LENGTH} characters.")
    spec_res = TextSpec.from_dict_result(item)
    if not spec_res.is_successful:
        return Result.failure(spec_res.error)
    return Result.success(spec_res.value if spec_res.value.is_visible else None)


def _number(item: dict, key: str, default: float, low: float, high: float) -> float:
    value = item.get(key, default)
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"Layer {key} must be a number.")
    return min(high, max(low, float(value)))


def _parse_image_layer(item: dict) -> Result[Optional[ImageLayer]]:
    asset = item.get("asset")
    if not isinstance(asset, str) or not ASSET_ID_PATTERN.fullmatch(asset):
        return Result.failure("A picture layer needs a valid picture id.")
    try:
        rotation = _number(item, "rotation", 0.0, -1e6, 1e6)
        layer = ImageLayer(
            asset=asset,
            x=_number(item, "x", 0.5, MIN_LAYER_POSITION, MAX_LAYER_POSITION),
            y=_number(item, "y", 0.5, MIN_LAYER_POSITION, MAX_LAYER_POSITION),
            width=_number(item, "width", 0.25, MIN_LAYER_SIZE, MAX_LAYER_SIZE),
            height=_number(item, "height", 0.25, MIN_LAYER_SIZE, MAX_LAYER_SIZE),
            rotation=_fold(rotation),
            opacity=_number(item, "opacity", 1.0, 0.0, 1.0),
        )
    except ValueError as exc:
        return Result.failure(str(exc))
    return Result.success(layer if layer.opacity > 0 else None)


def _fold(angle: float) -> float:
    """Degrees in (-180, 180], like the main image's rotation."""
    folded = math.fmod(angle, 360.0)
    if folded > 180:
        folded -= 360
    elif folded <= -180:
        folded += 360
    return folded + 0.0


def layers_json(layers: tuple[Layer, ...]) -> list[dict]:
    """The layers as the editor sends them, for the response echo."""
    out = []
    for layer in layers:
        if isinstance(layer, ImageLayer):
            out.append({
                "type": "image",
                "asset": layer.asset,
                "x": layer.x,
                "y": layer.y,
                "width": layer.width,
                "height": layer.height,
                "rotation": layer.rotation,
                "opacity": layer.opacity,
            })
        else:
            out.append({"type": "text", **text_json(layer)})
    return out


def text_json(text: TextSpec) -> dict:
    """Same keys the editor sends, so a saved fit can be sent again as is."""
    return {
        "text": text.text,
        "font_id": text.font_id,
        "bold": text.bold,
        "italic": text.italic,
        "size": text.size,
        "color": text.color,
        "opacity": text.opacity,
        "x": text.x,
        "y": text.y,
        "shadow": text.shadow,
        "align": text.align,
        **({"rotation": text.rotation} if text.rotation else {}),
    }
