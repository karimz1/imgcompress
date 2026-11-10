"""Text / watermark overlay: validation, drawing and thread safety."""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace

import numpy as np
import pytest
from PIL import Image

from backend.image_converter.domain.text_overlay import (
    FONT_FILES,
    FONTS_DIR,
    MAX_TEXT_LENGTH,
    MAX_TEXT_LINES,
    MAX_TEXT_SIZE,
    MIN_TEXT_SIZE,
    TextSpec,
    font_path,
    render_text_overlay,
)


def _ink_box(image: Image.Image, background=(0, 0, 0)):
    """Bounding box of every pixel that differs from the background colour."""
    pixels = np.asarray(image.convert("RGB"), dtype=np.int16)
    mask = np.any(np.abs(pixels - np.array(background)) > 8, axis=2)
    rows, cols = np.nonzero(mask)
    assert rows.size, "no text was drawn"
    return cols.min(), rows.min(), cols.max() + 1, rows.max() + 1


def _black(size=(400, 400), mode="RGB"):
    return Image.new(mode, size, (0, 0, 0, 255) if mode == "RGBA" else (0, 0, 0))


# --- fonts ----------------------------------------------------------------

def test_every_font_face_is_bundled_with_its_licence():
    for font_id, faces in FONT_FILES.items():
        for bold in (False, True):
            for italic in (False, True):
                assert font_path(font_id, bold, italic).is_file()
        assert (FONTS_DIR / font_id / "OFL.txt").is_file()


def test_frontend_copies_are_identical():
    public = FONTS_DIR.parents[3] / "frontend" / "public" / "fonts"
    for path in FONTS_DIR.rglob("*.ttf"):
        twin = public / path.relative_to(FONTS_DIR)
        assert twin.read_bytes() == path.read_bytes(), twin


# --- validation -----------------------------------------------------------

def test_unknown_font_id_is_rejected():
    with pytest.raises(ValueError):
        TextSpec(text="hi", font_id="comic-sans")


@pytest.mark.parametrize("font_id", [
    "../inter", "inter/../../etc/passwd", "/etc/passwd", "inter/Inter-Bold.ttf",
    "C:\\Windows\\Fonts\\arial.ttf", "", None, 1,
])
def test_path_like_font_ids_are_rejected(font_id):
    with pytest.raises(ValueError):
        TextSpec(text="hi", font_id=font_id)
    assert not TextSpec.from_dict_result({"text": "hi", "font_id": font_id}).is_successful


def test_text_is_capped_in_length_and_lines():
    assert len(TextSpec(text="a" * 500).text) == MAX_TEXT_LENGTH
    spec = TextSpec(text="\n".join(str(i) for i in range(25)))
    assert spec.text.split("\n") == [str(i) for i in range(MAX_TEXT_LINES)]


def test_control_characters_are_stripped_but_newlines_kept():
    spec = TextSpec(text="a\x00b\x07c\x1b[31m\r\nd\te\x7f\u2028f")
    assert spec.text == "abc[31m\nde\nf"


def test_numbers_are_clamped():
    spec = TextSpec(text="hi", size=5, opacity=-3, x=-1, y=9)
    assert (spec.size, spec.opacity, spec.x, spec.y) == (MAX_TEXT_SIZE, 0.0, 0.0, 1.0)
    assert TextSpec(text="hi", size=0).size == MIN_TEXT_SIZE


@pytest.mark.parametrize("bad", ["nan", "inf", "abc", None, True])
def test_non_numbers_are_refused(bad):
    with pytest.raises(ValueError):
        TextSpec(text="hi", opacity=bad)


def test_colour_is_normalised_and_checked():
    assert TextSpec(text="hi", color="#ABC").color == "#aabbcc"
    with pytest.raises(ValueError):
        TextSpec(text="hi", color="red")
    with pytest.raises(ValueError):
        TextSpec(text="hi", color="#12345g")


def test_from_dict_uses_defaults_and_ignores_unknown_keys():
    spec = TextSpec.from_dict({"text": "hi", "bold": "true", "x": "0.25", "path": "/etc"})
    assert spec == TextSpec(text="hi", bold=True, x=0.25)
    assert not TextSpec.from_dict_result(["not", "a", "dict"]).is_successful


# --- drawing --------------------------------------------------------------

@pytest.mark.parametrize("mode", ["RGB", "RGBA"])
def test_renders_on_rgb_and_rgba(mode):
    canvas = _black(mode=mode)
    result = render_text_overlay(canvas, TextSpec(text="Hello", size=0.2))
    assert result.mode == mode and result.size == canvas.size
    assert result.tobytes() != canvas.tobytes()
    assert canvas.getextrema()[0] == (0, 0)  # input untouched


def test_text_keeps_a_transparent_canvas_transparent_around_it():
    canvas = Image.new("RGBA", (300, 300), (0, 0, 0, 0))
    result = render_text_overlay(canvas, TextSpec(text="Hi", size=0.2))
    alpha = np.asarray(result.getchannel("A"))
    assert alpha[0, 0] == 0 and alpha.max() == 255


@pytest.mark.parametrize("mode", ["RGB", "RGBA"])
def test_zero_opacity_or_empty_text_leaves_canvas_unchanged(mode):
    canvas = Image.new(mode, (200, 120), (10, 120, 200, 77)[: len(mode)])
    for spec in (TextSpec(text="Hello", opacity=0), TextSpec(text="  \n ")):
        assert render_text_overlay(canvas, spec).tobytes() == canvas.tobytes()


def test_half_opacity_is_dimmer():
    canvas = _black()
    full = np.asarray(render_text_overlay(canvas, TextSpec(text="H", size=0.4)))
    half = np.asarray(render_text_overlay(canvas, TextSpec(text="H", size=0.4, opacity=0.5)))
    assert abs(int(half.max()) - 128) <= 2 and full.max() == 255


def test_colour_is_used():
    result = render_text_overlay(_black(), TextSpec(text="H", size=0.4, color="#ff0000"))
    pixels = np.asarray(result)
    assert pixels[..., 0].max() == 255 and pixels[..., 1].max() == 0


@pytest.mark.parametrize("x, y", [(0.5, 0.5), (0.25, 0.75), (0.8, 0.2)])
def test_text_is_centred_on_the_position(x, y):
    width, height = 600, 400
    result = render_text_overlay(_black((width, height)), TextSpec(text="HOX", size=0.1, x=x, y=y))
    left, top, right, bottom = _ink_box(result)
    assert abs((left + right) / 2 - x * width) <= 0.02 * width
    assert abs((top + bottom) / 2 - y * height) <= 0.03 * height


def test_multiple_lines_are_stacked_and_centred():
    one = _ink_box(render_text_overlay(_black(), TextSpec(text="HHH", size=0.1)))
    two = _ink_box(render_text_overlay(_black(), TextSpec(text="HHH\nHHH", size=0.1)))
    assert (two[3] - two[1]) > 1.8 * (one[3] - one[1])
    assert abs((two[1] + two[3]) / 2 - 200) <= 6


def test_size_scales_with_output_resolution():
    spec = TextSpec(text="Hello", size=0.1, x=0.5, y=0.5)
    small = _ink_box(render_text_overlay(_black((300, 200)), spec))
    large = _ink_box(render_text_overlay(_black((1200, 800)), spec))
    ratio_w = (large[2] - large[0]) / (small[2] - small[0])
    ratio_h = (large[3] - large[1]) / (small[3] - small[1])
    assert ratio_w == pytest.approx(4, rel=0.08)
    assert ratio_h == pytest.approx(4, rel=0.08)


@pytest.mark.parametrize("font_id", sorted(FONT_FILES))
def test_bold_differs_from_regular(font_id):
    canvas = _black()
    regular = render_text_overlay(canvas, TextSpec(text="Bold", font_id=font_id, size=0.15))
    bold = render_text_overlay(canvas, TextSpec(text="Bold", font_id=font_id, size=0.15, bold=True))
    assert np.asarray(bold).sum() > np.asarray(regular).sum()


def test_fonts_differ_from_each_other():
    renders = {
        render_text_overlay(_black(), TextSpec(text="Ag", font_id=font_id, size=0.2)).tobytes()
        for font_id in FONT_FILES
    }
    assert len(renders) == len(FONT_FILES)


def test_shadow_adds_dark_pixels_around_text():
    canvas = Image.new("RGB", (300, 200), (200, 200, 200))
    plain = np.asarray(render_text_overlay(canvas, TextSpec(text="Hi", size=0.3)))
    shaded = np.asarray(render_text_overlay(canvas, TextSpec(text="Hi", size=0.3, shadow=True)))
    assert shaded.min() < plain.min()


# --- thread safety --------------------------------------------------------

def test_parallel_renders_do_not_mix_up_texts():
    canvas = Image.new("RGB", (320, 180), (30, 60, 90))
    specs = [
        TextSpec(text=f"User {i}\nline {i * 7}", font_id=sorted(FONT_FILES)[i % 4],
                 bold=i % 2 == 0, italic=i % 3 == 0, size=0.1 + i * 0.01,
                 color=f"#{(i * 15):02x}ff{(255 - i * 15):02x}", x=0.3 + i * 0.02,
                 y=0.4 + i * 0.01, shadow=i % 4 == 1)
        for i in range(16)
    ]
    expected = [render_text_overlay(canvas, spec).tobytes() for spec in specs]
    assert len(set(expected)) == len(specs)

    with ThreadPoolExecutor(max_workers=16) as pool:
        for _ in range(4):
            results = list(pool.map(lambda spec: render_text_overlay(canvas, spec).tobytes(),
                                    specs * 2))
            assert results == expected * 2


# --- alignment ----------------------------------------------------------------

def _line_edges(align):
    """Ink box of the short top line and the long bottom line of a two-line text."""
    spec = TextSpec(text="I\nWWWW", size=0.15, color="#ffffff", shadow=False, align=align)
    image = render_text_overlay(_black((600, 400)), spec)
    top = _ink_box(image.crop((0, 0, 600, 200)))
    bottom = _ink_box(image.crop((0, 200, 600, 400)))
    return top, bottom


def test_left_aligned_lines_share_their_left_edge():
    top, bottom = _line_edges("left")
    assert abs(top[0] - bottom[0]) <= 6
    assert top[2] < bottom[2] - 50


def test_right_aligned_lines_share_their_right_edge():
    top, bottom = _line_edges("right")
    assert abs(top[2] - bottom[2]) <= 6
    assert top[0] > bottom[0] + 50


def test_centred_lines_share_their_middle():
    top, bottom = _line_edges("center")
    assert abs((top[0] + top[2]) - (bottom[0] + bottom[2])) <= 8


def test_alignment_keeps_the_block_in_place():
    boxes = [_line_edges(align)[1] for align in ("left", "center", "right")]
    # The longest line fills the block, so it sits at the same spot for every alignment.
    assert max(box[0] for box in boxes) - min(box[0] for box in boxes) <= 2


@pytest.mark.parametrize("value", ["justify", "", 3, None])
def test_invalid_alignment_is_refused(value):
    result = TextSpec.from_dict_result({"text": "x", "align": value})
    assert not result.is_successful


def test_alignment_defaults_to_centre():
    assert TextSpec(text="x").align == "center"
    assert TextSpec.from_dict_result({"text": "x"}).value.align == "center"


# --- rotation: same as CSS rotate() about the centre of the text block -----

def _turned_reference(canvas, spec, angle):
    """The straight text, turned with PIL about its centre (clockwise like CSS)."""
    big = Image.new("RGB", (canvas.width * 3, canvas.height * 3), (0, 0, 0))
    straight = render_text_overlay(big, replace(spec, x=(spec.x * canvas.width + canvas.width) / big.width,
                                                y=(spec.y * canvas.height + canvas.height) / big.height,
                                                size=spec.size * canvas.height / big.height))
    centre = (spec.x * canvas.width + canvas.width, spec.y * canvas.height + canvas.height)
    turned = straight.rotate(-angle, resample=Image.Resampling.BICUBIC, center=centre)
    return turned.crop((canvas.width, canvas.height, canvas.width * 2, canvas.height * 2))


def test_rotation_is_read_folded_and_echoed():
    assert TextSpec.from_dict({"text": "hi", "rotation": 380}).rotation == 20
    assert TextSpec.from_dict({"text": "hi", "rotation": -200}).rotation == 160
    assert TextSpec(text="hi").rotation == 0
    with pytest.raises(ValueError):
        TextSpec.from_dict({"text": "hi", "rotation": "steep"})


@pytest.mark.parametrize("angle, shadow", [(20, False), (-35, True), (90, False)])
def test_turned_text_matches_the_straight_text_turned_about_its_centre(angle, shadow):
    canvas = _black((500, 300))
    spec = TextSpec(text="Tilted!", size=0.18, x=0.45, y=0.55, bold=True, shadow=shadow, rotation=angle)
    result = np.asarray(render_text_overlay(canvas, spec), dtype=np.int16)
    reference = np.asarray(_turned_reference(canvas, replace(spec, rotation=0), angle), dtype=np.int16)
    assert np.abs(result - reference).mean() < 1.0
    # Anti-aliased edges, not just on/off pixels.
    values = np.unique(result[..., 0])
    assert len(values) > 50


def test_positive_rotation_turns_clockwise():
    canvas = _black((600, 600))
    result = render_text_overlay(canvas, TextSpec(text="HHHHHHHH", size=0.08, rotation=20))
    ink = np.asarray(result.convert("L")) > 128
    rows, cols = np.nonzero(ink)
    left, right = rows[cols < 300].mean(), rows[cols >= 300].mean()
    assert right > left + 20  # the right end went down


def test_turned_text_is_not_clipped_to_its_straight_box():
    canvas = _black((400, 400))
    straight = _ink_box(render_text_overlay(canvas, TextSpec(text="WIDE TEXT", size=0.1)))
    upright = _ink_box(render_text_overlay(canvas, TextSpec(text="WIDE TEXT", size=0.1, rotation=90)))
    assert abs((upright[3] - upright[1]) - (straight[2] - straight[0])) <= 3
    assert abs((upright[2] - upright[0]) - (straight[3] - straight[1])) <= 3
