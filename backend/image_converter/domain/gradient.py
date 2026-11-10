"""Two-colour linear gradients, drawn exactly like CSS linear-gradient.

``angle`` follows CSS: 0 points up, 90 to the right, clockwise. The gradient
line runs through the centre and is |W·sin a| + |H·cos a| long, so the corners
get the pure end colours. Colours mix in sRGB, as CSS does by default, and
are sampled at pixel centres.
"""

import math

import numpy as np
from PIL import Image

DEFAULT_GRADIENT_ANGLE = 180.0


def normalize_gradient_angle(angle: float) -> float:
    """Folds any finite angle into 0 <= angle < 360."""
    folded = math.fmod(angle, 360.0)
    return folded + 360.0 if folded < 0 else folded + 0.0


def linear_gradient(
    size: tuple[int, int],
    start: tuple[int, int, int],
    end: tuple[int, int, int],
    angle: float = DEFAULT_GRADIENT_ANGLE,
) -> Image.Image:
    """An RGB image of ``size`` going from ``start`` to ``end`` along ``angle``."""
    width, height = size
    rad = math.radians(angle)
    dx, dy = math.sin(rad), -math.cos(rad)
    length = abs(width * dx) + abs(height * dy) or 1.0
    xs = (np.arange(width, dtype=np.float32) + 0.5 - width / 2) * dx
    ys = (np.arange(height, dtype=np.float32) + 0.5 - height / 2) * dy
    t = np.clip((ys[:, None] + xs[None, :]) / length + 0.5, 0.0, 1.0)
    first = np.asarray(start, dtype=np.float32)
    last = np.asarray(end, dtype=np.float32)
    pixels = first + (last - first) * t[..., None]
    return Image.fromarray(np.rint(pixels).astype(np.uint8), "RGB")
