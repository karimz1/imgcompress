"""Turning the image, moving the background picture and the text overlay."""

import json
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from io import BytesIO

import numpy as np
import pytest
from PIL import Image
from werkzeug.datastructures import FileStorage

from backend.image_converter.domain.fit_to_size import (
    FitBackground,
    FitMode,
    FitPlacement,
    FitToSize,
)
from backend.image_converter.domain.image_resizer import ImageResizer
from backend.image_converter.domain.text_overlay import TextSpec
from backend.image_converter.presentation.web.services.fit_preview_service import (
    FitPreviewService,
)

RED = (255, 0, 0)
BLUE = (0, 0, 255)
GREEN = (0, 255, 0)
WHITE = (255, 255, 255)


def parse(mode="solid", **extra):
    return FitToSize.from_strings_result("400", "400", mode, "", "#ffffff", "", "", "", **extra)


def split(size=(200, 100), first=BLUE, second=RED):
    """Left half ``first``, right half ``second``."""
    image = Image.new("RGB", size, first)
    image.paste(second, (size[0] // 2, 0, *size))
    return image


def render(fit, image=None, output_size=None):
    return ImageResizer.fit_image(image or split(), fit, output_size).convert("RGB")


def solid(placement=None, size=(300, 300), **kwargs):
    return FitToSize(*size, FitMode.SOLID, color="#ffffff", placement=placement, **kwargs)


def png(image) -> BytesIO:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer


def preview(image, background=None, **fields):
    return FitPreviewService().build(
        FileStorage(stream=png(image), filename="photo.png"),
        {"fit_width": "400", "fit_height": "200", **fields},
        background=FileStorage(stream=png(background), filename="bg.png") if background else None,
    )


def text_json(**overrides):
    return json.dumps({"text": "Hi", "size": 0.3, "color": "#000000", **overrides})


def changed_box(a, b):
    """Bounding box (left, top, right, bottom) of the pixels that differ."""
    diff = np.abs(np.asarray(a, dtype=int) - np.asarray(b, dtype=int)).sum(axis=2) > 30
    rows, cols = np.where(diff)
    return (cols.min(), rows.min(), cols.max() + 1, rows.max() + 1) if rows.size else None


# --- Parsing ---------------------------------------------------------------


@pytest.mark.parametrize(
    "value, expected",
    [("90", 90.0), ("450", 90.0), ("-190", 170.0), ("180", 180.0), ("-180", 180.0), ("-45.5", -45.5)],
)
def test_When_RotationIsGiven_Expect_FoldedIntoOneTurn(value, expected):
    fit = parse(rotation=value)
    assert fit.is_successful, fit.error
    assert fit.value.placement == FitPlacement(1.0, 0.5, 0.5, expected)


@pytest.mark.parametrize("value", ["", "0", "360", "-720"])
def test_When_RotationIsAFullTurn_Expect_NoPlacement(value):
    assert parse(rotation=value).value.placement is None


@pytest.mark.parametrize("value", ["left", "nan", "inf", "-inf"])
def test_When_RotationIsNotANumber_Expect_Failure(value):
    assert not parse(rotation=value).is_successful


def test_When_RotationIsCombinedWithAPlacement_Expect_BothKept():
    fit = FitToSize.from_strings_result(
        "400", "400", "blur", "", "", "2", "0.25", "0.75", rotation="30"
    )
    assert fit.value.placement == FitPlacement(2.0, 0.25, 0.75, 30.0)


def test_When_FillModeIsTilted_Expect_OnlyTheAngleAccepted():
    assert parse("crop", rotation="10").value.placement == FitPlacement(1.0, 0.5, 0.5, 10.0)
    assert not FitToSize.from_strings_result("400", "400", "crop", "", "#ffffff", "2", "0.5", "0.5").is_successful


def test_When_FillModeIsTilted_Expect_TurnedAndZoomedToStillFillTheFrame():
    # Fill frame keeps filling: the turned picture is zoomed until no corner is empty.
    photo = Image.radial_gradient("L").resize((400, 200)).convert("RGB")
    fit = FitToSize(300, 200, FitMode.CROP, color="#ffffff", placement=FitPlacement(1, 0.5, 0.5, 20))
    out = np.asarray(ImageResizer.fit_image(photo, fit).convert("RGB"), dtype=int)
    assert out.shape == (200, 300, 3)
    # Same as CSS: the filled picture scaled by the cover factor, turned about the centre.
    straight = ImageResizer.fit_image(photo, replace(fit, placement=None)).convert("RGB")
    cos, sin = np.cos(np.radians(20)), np.sin(np.radians(20))
    factor = max((300 * cos + 200 * sin) / 300, (300 * sin + 200 * cos) / 200)
    big = straight.resize((round(300 * factor), round(200 * factor)), Image.Resampling.LANCZOS)
    turned = big.rotate(-20, resample=Image.Resampling.BICUBIC, center=(big.width / 2, big.height / 2))
    left, top = (big.width - 300) / 2, (big.height - 200) / 2
    reference = np.asarray(turned.crop((round(left), round(top), round(left) + 300, round(top) + 200)), dtype=int)
    assert np.abs(out - reference).mean() < 3
    # Nothing white from outside the picture in the corners.
    for x, y in [(0, 0), (299, 0), (0, 199), (299, 199)]:
        assert tuple(out[y, x]) != (255, 255, 255)


@pytest.mark.parametrize(
    "fields, expected",
    [
        ({"bg_scale": "2"}, FitPlacement(2.0, 0.5, 0.5, 0.0)),
        ({"bg_scale": "1000"}, FitPlacement(10.0, 0.5, 0.5, 0.0)),
        ({"bg_scale": "0"}, FitPlacement(0.1, 0.5, 0.5, 0.0)),
        ({"bg_x": "9", "bg_y": "-9"}, FitPlacement(1.0, 2.0, -1.0, 0.0)),
        ({"bg_rotation": "-270"}, FitPlacement(1.0, 0.5, 0.5, 90.0)),
    ],
)
def test_When_BackgroundPlacementIsGiven_Expect_ClampedValues(fields, expected):
    fit = parse("image", **fields)
    assert fit.is_successful, fit.error
    assert fit.value.background.image_placement == expected
    assert not fit.value.background.is_plain


def test_When_BackgroundPlacementIsTheDefault_Expect_None():
    fit = parse("image", bg_scale="1", bg_x="0.5", bg_y="0.5", bg_rotation="360")
    assert fit.value.background.image_placement is None
    assert fit.value == parse("image").value


@pytest.mark.parametrize("mode", ["crop", "blur", "solid", "transparent"])
def test_When_BackgroundPlacementWithoutImageMode_Expect_Failure(mode):
    assert not parse(mode, bg_scale="2").is_successful


@pytest.mark.parametrize("field", ["bg_scale", "bg_x", "bg_y", "bg_rotation"])
def test_When_BackgroundPlacementIsNotANumber_Expect_Failure(field):
    assert not parse("image", **{field: "nan"}).is_successful


def test_When_TextIsGiven_Expect_ParsedAndClamped():
    fit = parse("crop", text=json.dumps({"text": "Hello", "font_id": "caveat", "size": 9, "x": -3}))
    assert fit.is_successful, fit.error
    assert fit.value.text == TextSpec("Hello", "caveat", size=0.5, x=0.0)


@pytest.mark.parametrize(
    "value",
    [json.dumps({"text": "  "}), json.dumps({"text": "Hi", "opacity": 0}), ""],
)
def test_When_TextIsInvisible_Expect_NoText(value):
    fit = parse(text=value)
    assert fit.is_successful, fit.error
    assert fit.value.text is None


@pytest.mark.parametrize(
    "value",
    [
        "{not json",
        "[1, 2]",
        json.dumps({"text": "Hi", "font_id": "../../etc/passwd"}),
        json.dumps({"text": "Hi", "font_id": "Arial"}),
        json.dumps({"text": "Hi", "size": "big"}),
        json.dumps({"text": "Hi", "color": "red"}),
        json.dumps({"text": "x" * 201}),
        json.dumps({"text": "Hi", "pad": "x" * 5000}),
    ],
)
def test_When_TextIsInvalid_Expect_Failure(value):
    assert not parse(text=value).is_successful


def test_When_TextHasTheMaximumLength_Expect_Accepted():
    assert parse(text=json.dumps({"text": "x" * 200})).value.text.text == "x" * 200


# --- Rendering: defaults ----------------------------------------------------


def test_When_NewFieldsAreAtTheirDefaults_Expect_IdenticalOutput():
    plain = parse("blur").value
    defaults = parse(
        "blur", rotation="0", text=json.dumps({"text": ""})
    ).value
    assert plain == defaults
    assert np.array_equal(np.asarray(render(plain)), np.asarray(render(defaults)))

    image = Image.new("RGB", (100, 50), GREEN)
    plain_image = replace(parse("image").value, background=FitBackground(image=image))
    moved_back = parse("image", bg_scale="1", bg_x="0.5", bg_y="0.5", bg_rotation="0").value
    moved_back = replace(moved_back, background=replace(moved_back.background, image=image))
    assert np.array_equal(np.asarray(render(plain_image)), np.asarray(render(moved_back)))


# --- Rendering: rotation ----------------------------------------------------


def test_When_ImageIsTurnedClockwise_Expect_LeftHalfOnTop():
    out = render(solid(FitPlacement(1, 0.5, 0.5, 90)))
    assert out.getpixel((150, 40)) == BLUE
    assert out.getpixel((150, 260)) == RED
    # A 2:1 image turned upright leaves the sides free.
    assert out.getpixel((40, 150)) == WHITE


def test_When_ImageIsTurnedHalfway_Expect_HalvesSwapped():
    out = render(solid(FitPlacement(1, 0.5, 0.5, 180)))
    assert out.getpixel((60, 150)) == RED
    assert out.getpixel((240, 150)) == BLUE


def test_When_ImageIsTurned_Expect_CentreStaysAndCornersShowBackground():
    square = Image.new("RGB", (100, 100), GREEN)
    out = render(solid(FitPlacement(1, 0.5, 0.5, 45)), square)
    assert out.getpixel((150, 150)) == GREEN
    assert out.getpixel((5, 5)) == WHITE
    # The turned square reaches past the canvas edge in the middle of each side.
    assert out.getpixel((150, 2)) == GREEN


def test_When_TurnedImageHasAlpha_Expect_TransparentCornersOnTransparentMode():
    fit = FitToSize(200, 200, FitMode.TRANSPARENT, color="transparent",
                    placement=FitPlacement(0.5, 0.5, 0.5, 30))
    out = ImageResizer.fit_image(Image.new("RGB", (100, 100), GREEN), fit)
    assert out.mode == "RGBA"
    assert out.getpixel((100, 100))[3] == 255
    assert out.getpixel((2, 2))[3] == 0


def test_When_TurnedPreviewIsScaledDown_Expect_SameLayoutAsTheExport():
    fit = solid(FitPlacement(0.8, 0.4, 0.6, 33), size=(400, 400))
    full = render(fit).resize((200, 200), Image.Resampling.BILINEAR)
    small = render(fit, output_size=(200, 200))
    diff = np.abs(np.asarray(full, dtype=int) - np.asarray(small, dtype=int))
    assert diff.mean() < 3


def test_When_TurnedImageIsHuge_Expect_OnlyTheCanvasIsRendered():
    fit = solid(FitPlacement(20, 0.5, 0.5, 30), size=(4000, 4000))
    out = render(fit, Image.new("RGB", (4000, 2000), GREEN))
    assert out.size == (4000, 4000)
    assert out.getpixel((2000, 2000)) == GREEN


def test_When_TurnedImageIsFarOffCanvas_Expect_JustTheBackground():
    out = render(solid(FitPlacement(0.2, -0.9, -0.9, 45)))
    assert out.getcolors() == [(300 * 300, WHITE)]


# --- Rendering: background picture -------------------------------------------


def image_fit(placement, picture=None):
    picture = picture or split((400, 200))
    return FitToSize(
        400,
        200,
        FitMode.IMAGE,
        placement=FitPlacement(0.05, 0.5, 0.5),
        background=FitBackground(image=picture, image_placement=placement),
    )


def test_When_BackgroundIsZoomed_Expect_ScaledAroundItsCentre():
    out = render(image_fit(FitPlacement(2, 0.5, 0.5)), Image.new("RGB", (10, 10), GREEN))
    # Twice as large: the blue half now reaches from -200 to 200.
    assert out.getpixel((150, 20)) == BLUE
    assert out.getpixel((250, 20)) == RED


def test_When_BackgroundIsMoved_Expect_UncoveredPartsWhite():
    out = render(image_fit(FitPlacement(1, 1.0, 0.5)), Image.new("RGB", (10, 10), GREEN))
    assert out.getpixel((100, 20)) == WHITE
    assert out.getpixel((300, 20)) == BLUE


def test_When_BackgroundIsTurnedHalfway_Expect_HalvesSwapped():
    out = render(image_fit(FitPlacement(1, 0.5, 0.5, 180)), Image.new("RGB", (10, 10), GREEN))
    assert out.getpixel((50, 20)) == RED
    assert out.getpixel((350, 20)) == BLUE


def test_When_BackgroundIsShrunk_Expect_NoAliasingAndWhiteAround():
    stripes = Image.new("RGB", (4000, 2000), WHITE)
    for x in range(0, 4000, 2):
        stripes.paste((0, 0, 0), (x, 0, x + 1, 2000))
    out = render(image_fit(FitPlacement(0.25, 0.5, 0.5), stripes), Image.new("RGB", (2, 2), GREEN))
    centre = np.asarray(out.crop((160, 80, 240, 95)), dtype=int)
    # Fine stripes average to grey instead of moire.
    assert abs(centre.mean() - 127) < 20
    assert centre.std() < 25
    assert out.getpixel((10, 10)) == WHITE


# --- Rendering: text ---------------------------------------------------------


@pytest.mark.parametrize("mode", list(FitMode))
def test_When_TextIsSet_Expect_DrawnInEveryMode(mode):
    background = FitBackground(image=Image.new("RGB", (50, 50), GREEN)) if mode == FitMode.IMAGE else FitBackground()
    fit = FitToSize(400, 200, mode, color="#ffffff" if mode != FitMode.TRANSPARENT else "transparent",
                    background=background)
    with_text = replace(fit, text=TextSpec("Hi", size=0.3, color="#000000", x=0.25, y=0.5))
    box = changed_box(render(fit), render(with_text))
    assert box is not None
    left, top, right, bottom = box
    assert 50 < (left + right) / 2 < 150
    assert 70 < (top + bottom) / 2 < 130


def test_When_TextPreviewIsScaled_Expect_SameRelativeSize():
    fit = solid(size=(800, 400))
    spec = TextSpec("Wide text", size=0.2, color="#000000")
    full = changed_box(render(fit), render(replace(fit, text=spec)))
    small = changed_box(
        render(fit, output_size=(400, 200)), render(replace(fit, text=spec), output_size=(400, 200))
    )
    assert abs((full[2] - full[0]) / 2 - (small[2] - small[0])) <= 3
    assert abs((full[3] - full[1]) / 2 - (small[3] - small[1])) <= 3


def test_When_TextIsSet_Expect_OnTopOfTheTurnedImage():
    fit = solid(FitPlacement(1, 0.5, 0.5, 20))
    blue = Image.new("RGB", (100, 100), BLUE)
    plain = render(fit, blue)
    with_text = render(replace(fit, text=TextSpec("X", size=0.3, color="#ffffff")), blue)
    assert plain.getpixel((150, 150)) == BLUE
    centre = (130, 130, 170, 170)
    assert np.mean(with_text.crop(centre)) > np.mean(plain.crop(centre)) + 20


# --- Preview service ----------------------------------------------------------


def test_When_PreviewHasLayers_Expect_EchoedInTheSavedFit():
    result = preview(
        split(),
        background=split((300, 100), GREEN, RED),
        fit_mode="image",
        fit_rotation="-30",
        fit_bg_scale="1.5",
        fit_bg_x="0.4",
        fit_bg_rotation="10",
        fit_text=text_json(font_id="noto-serif", bold=True, shadow=True),
    )
    assert result.is_successful, result.error
    saved, image = result.value
    assert image
    assert saved["fit"]["placement"] == {"scale": 1.0, "x": 0.5, "y": 0.5, "rotation": -30.0}
    assert saved["fit"]["background"]["imagePlacement"] == {
        "scale": 1.5, "x": 0.4, "y": 0.5, "rotation": 10.0,
    }
    assert saved["fit"]["text"] == {
        "text": "Hi", "font_id": "noto-serif", "bold": True, "italic": False, "size": 0.3,
        "color": "#000000", "opacity": 1.0, "x": 0.5, "y": 0.5, "shadow": True,
        "align": "center",
    }


def test_When_SavedTextIsSentAgain_Expect_SameSpec():
    first = preview(split(), fit_mode="crop", fit_text=text_json(italic=True, opacity=0.5))
    echoed = first.value[0]["fit"]["text"]
    again = parse("crop", text=json.dumps(echoed))
    assert again.value.text == TextSpec("Hi", italic=True, size=0.3, color="#000000", opacity=0.5)


def test_When_PreviewIsPlain_Expect_NoNewKeysInTheEcho():
    saved = preview(split(), fit_mode="blur").value[0]["fit"]
    assert "text" not in saved and "placement" not in saved and "background" not in saved


def test_When_PreviewTextIsInvalid_Expect_Failure():
    result = preview(split(), fit_mode="solid", fit_color="#ffffff", fit_text=text_json(font_id="nope"))
    assert not result.is_successful
    assert "font" in result.error.lower()


def test_When_ManyUsersRenderAtOnce_Expect_EveryResultAsAlone():
    picture = split((300, 150), GREEN, RED)
    fits = [
        replace(
            solid(FitPlacement(0.7, 0.4 + i * 0.02, 0.5, i * 23 - 90)),
            text=TextSpec(f"User {i}", font_id=["inter", "caveat", "noto-serif", "jetbrains-mono"][i % 4],
                          size=0.1 + i * 0.01, color="#000000", shadow=i % 2 == 0),
        )
        for i in range(8)
    ] + [
        replace(image_fit(FitPlacement(1 + i * 0.3, 0.5, 0.5, i * 40), picture),
                text=TextSpec(str(i), size=0.2))
        for i in range(8)
    ]
    expected = [np.asarray(render(fit)) for fit in fits]
    with ThreadPoolExecutor(max_workers=16) as pool:
        results = list(pool.map(lambda fit: np.asarray(render(fit)), fits * 3))
    for index, result in enumerate(results):
        assert np.array_equal(result, expected[index % len(fits)])
