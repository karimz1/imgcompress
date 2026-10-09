"""Content-aware placement of a fixed-size crop window.

Used by "Fit to size" in crop mode. The image has already been scaled so that
one axis matches the target exactly, which leaves a single free axis: the window
can only slide horizontally or only vertically. That keeps the search to one
dimension and makes it cheap enough to run on every upload (a few ms).

How a position is scored:

1. Build a small importance map from two signals:
   - detail: gradient magnitude of the luminance. This is the main signal and
     finds text, outlines, faces, and textured objects.
   - colour distinctness: how far each pixel's (slightly blurred) Lab colour is
     from the image's mean colour, after Achanta et al., "Frequency-tuned
     Salient Region Detection" (CVPR 2009). It helps with flat, coloured
     subjects on a plain background whose inside has little detail.
   Each signal is normalised by its own high percentile, so neither dominates
   just because of its units, and fully transparent pixels count as empty.
2. Collapse the map onto the free axis and score every window position by the
   importance it keeps.
3. Penalise windows whose edges cut through something. A line "cuts through"
   where important pixels sit directly on both sides of it, so a line of text
   or a face scores high while scattered texture (sparkles, foliage) does not.
   This is what keeps a title whole or leaves it out instead of slicing it.
4. Among positions that score about the same, prefer the one closest to the
   centre, so a flat image or a uniform pattern gets the same result as a plain
   centred crop.

No face or skin-colour detector on purpose: those need a model or skin-tone
heuristics, and the detail signal already picks up eyes, hair, and outlines.
"""

import numpy as np
from PIL import Image, ImageFilter

# Longest side of the analysis copy. Large enough to see a line of title text on
# a 1280px card, small enough that the analysis costs a few milliseconds.
_ANALYSIS_SIZE = 384
_MIN_ANALYSIS_SIDE = 8
_DISTINCTNESS_WEIGHT = 0.5
# How strongly content under a cut line counts against a window, relative to
# the content inside it.
_CUT_PENALTY = 1.5
# Half-width of the band around a cut line and the distance used to decide that
# content continues across it, as a share of the free axis.
_CUT_BAND = 0.012
_CUT_REACH = 0.008
# Scores within this share of an average window's content count as a tie.
_TIE_MARGIN = 0.002
# Values below these count as "nothing there", so a flat image or a soft
# gradient is not blown up to full importance by normalisation. Luminance
# gradient is in 0..1 units per pixel; colour distance is in Lab units, where
# about 2.3 is the smallest difference people notice.
_DETAIL_FLOOR = 0.02
_DISTINCTNESS_FLOOR = 10.0


def find_crop_offset(img: Image.Image, crop_width: int, crop_height: int) -> tuple[int, int]:
    """
    Returns the (left, top) offset of the crop window that keeps the most
    important content of ``img``. ``img`` must already cover the window, i.e. be
    at least ``crop_width`` x ``crop_height`` with one side matching exactly.
    """
    free_x = max(img.width - crop_width, 0)
    free_y = max(img.height - crop_height, 0)
    if free_x == 0 and free_y == 0:
        return 0, 0

    analysis_scale = min(1.0, _ANALYSIS_SIZE / max(img.width, img.height))
    if min(img.width, img.height) * analysis_scale < _MIN_ANALYSIS_SIDE:
        # Too small (or too thin) to say anything about content.
        return free_x // 2, free_y // 2

    importance = _importance_map(img)
    if free_x > 0:
        # Work on columns as if they were rows.
        return _best_start(importance.T, crop_width / img.width, free_x), 0
    return 0, _best_start(importance, crop_height / img.height, free_y)


def to_8bit(img: Image.Image) -> Image.Image:
    """
    Pillow clips 16-bit greyscale to white when converting to RGB, so scale it
    down to 8 bits first. Other modes are returned unchanged.
    """
    if img.mode in ("I;16", "I;16L", "I;16B", "I"):
        return img.convert("I").point(lambda value: value * (1 / 256)).convert("L")
    return img


def _importance_map(img: Image.Image) -> np.ndarray:
    # Shrink before converting, so a large photo is never copied to RGBA at
    # full resolution just to be thrown away.
    small = to_8bit(img)
    if small.mode not in ("RGB", "RGBA", "L", "LA"):
        small = small.convert("RGBA")
    scale = min(1.0, _ANALYSIS_SIZE / max(small.width, small.height))
    size = (max(1, round(small.width * scale)), max(1, round(small.height * scale)))
    small = small.resize(size, Image.Resampling.BILINEAR, reducing_gap=2.0).convert("RGBA")

    rgba = np.asarray(small, dtype=np.float32) / 255.0
    alpha = rgba[..., 3]
    rgb = rgba[..., :3]

    luminance = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    grad_y, grad_x = np.gradient(luminance)
    detail = np.hypot(grad_x, grad_y)

    blurred = small.convert("RGB").filter(ImageFilter.GaussianBlur(1))
    lab = _srgb_to_lab(np.asarray(blurred, dtype=np.float32) / 255.0)
    mean_lab = (lab * alpha[..., None]).sum(axis=(0, 1)) / max(float(alpha.sum()), 1e-6)
    distinctness = np.linalg.norm(lab - mean_lab, axis=2)

    importance = _normalise(detail, _DETAIL_FLOOR) + _DISTINCTNESS_WEIGHT * _normalise(
        distinctness, _DISTINCTNESS_FLOOR
    )
    return importance * alpha


def _srgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    """sRGB in [0, 1] to CIE Lab (D65)."""
    linear = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    to_xyz = np.array(
        [[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]],
        dtype=np.float32,
    )
    xyz = linear @ to_xyz.T / np.array([0.95047, 1.0, 1.08883], dtype=np.float32)
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    lightness = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([lightness, a, b], axis=2)


def _normalise(values: np.ndarray, floor: float) -> np.ndarray:
    scale = max(float(np.percentile(values, 99)), floor)
    return np.minimum(values / scale, 1.0)


def _best_start(importance: np.ndarray, window_share: float, free_pixels: int) -> int:
    """``importance`` is laid out so that axis 0 is the free axis."""
    length = importance.shape[0]
    window = min(length, max(1, round(window_share * length)))
    positions = length - window + 1
    if positions <= 1:
        return free_pixels // 2

    kept_cumulative = _cumulative(importance.sum(axis=1))
    starts = np.arange(positions)
    kept = kept_cumulative[starts + window] - kept_cumulative[starts]

    # crossing[i]: how much content continues across a line at index i.
    reach = max(1, round(_CUT_REACH * length))
    band = max(1, round(_CUT_BAND * length))
    crossing = np.zeros(length)
    if length > 2 * reach:
        crossing[reach:-reach] = np.sqrt(importance[: -2 * reach] * importance[2 * reach :]).sum(axis=1)
        typical = float(np.median(crossing[reach:-reach]))
    else:
        typical = 0.0
    # Lines too close to the border to measure, and the border itself, cost
    # what an average line costs. Charging the border nothing would drag every
    # busy image against an edge; charging the average keeps a uniform texture
    # neutral while a cut through a title still costs far more than the border.
    crossing[:reach] = typical
    crossing[length - reach :] = typical
    padded = np.concatenate((np.full(band, typical), crossing, np.full(band, typical)))
    crossing_cumulative = _cumulative(padded)

    def cut_cost(lines: np.ndarray) -> np.ndarray:
        # Sum over [line - band, line + band) in unpadded coordinates.
        return crossing_cumulative[lines + 2 * band] - crossing_cumulative[lines]

    score = kept - _CUT_PENALTY * (cut_cost(starts) + cut_cost(starts + window))

    # Positions within a small margin of the best score are treated as equally
    # good; of those, take the one closest to the centre.
    tolerance = _TIE_MARGIN * float(np.mean(kept)) + 1e-9
    candidates = np.flatnonzero(score >= score.max() - tolerance)
    centre = (positions - 1) / 2
    best = int(candidates[np.argmin(np.abs(candidates - centre))])

    offset = round(best * free_pixels / (positions - 1))
    return min(max(offset, 0), free_pixels)


def _cumulative(values: np.ndarray) -> np.ndarray:
    return np.concatenate(([0.0], np.cumsum(values, dtype=np.float64)))
