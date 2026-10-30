"""Editor backgrounds: patterns, dimming and a custom background image."""

import os
from dataclasses import replace
import tempfile
from io import BytesIO

import numpy as np
import pytest
from PIL import Image
from werkzeug.datastructures import FileStorage

from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.domain.fit_to_size import (
    FitAnchor,
    FitBackground,
    FitMode,
    FitPattern,
    FitPlacement,
    FitToSize,
    DEFAULT_BLUR_STRENGTH,
)
from backend.image_converter.domain.image_resizer import ImageResizer
from backend.image_converter.presentation.web.services.compression_service import (
    CompressionService,
)
from backend.image_converter.presentation.web.services.fit_preview_service import (
    FitPreviewService,
)
from tests.unit.dummy_logger import DummyLogger
from tests.unit.test_fit_to_size import _CapturingUseCase, _form_data, _TempFolders

GREEN = (0, 200, 0)
RED = (255, 0, 0)
BLUE = (0, 0, 255)
WHITE = (255, 255, 255)
# White under the 16 % black pattern ink.
INKED_WHITE = (214, 214, 214)


def parse(mode="solid", pattern=None, dim=None, color=None):
    return FitToSize.from_strings_result(
        "400", "400", mode, "", color, "", "", "", pattern=pattern, dim=dim
    )


def tiny(mode=FitMode.SOLID, color="#ffffff", pattern=FitPattern.NONE, dim=0.0, image=None, size=(400, 400)):
    """The image shrunk to a dot in the middle, so the corners show the background."""
    return FitToSize(
        *size,
        mode,
        FitAnchor.CENTER,
        color,
        FitPlacement(0.05, 0.5, 0.5),
        FitBackground(pattern, dim, image),
    )


def render(fit, image=None, output_size=None):
    return ImageResizer.fit_image(image or Image.new("RGB", (100, 100), GREEN), fit, output_size).convert("RGB")


def png(image) -> BytesIO:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer


def split(size, first, second, vertical=True):
    """Left/right (or top/bottom) halves in two colours."""
    image = Image.new("RGB", size, first)
    box = (size[0] // 2, 0, *size) if vertical else (0, size[1] // 2, *size)
    image.paste(second, box)
    return image


def preview(image, background=None, **fields):
    files = {"fit_background": FileStorage(stream=background, filename="bg.png")} if background else {}
    return FitPreviewService().build(
        FileStorage(stream=png(image), filename="photo.png"),
        {"fit_width": "400", "fit_height": "200", **fields},
        background=files.get("fit_background"),
    )


# --- Parsing -----------------------------------------------------------------


def test_When_NoBackgroundOptionsAreGiven_Expect_PlainDefaults():
    fit = parse()
    assert fit.is_successful
    assert fit.value.background == FitBackground()
    assert fit.value.background.is_plain


@pytest.mark.parametrize("pattern", ["checker", "dots", "stripes", "grid", "CHECKER"])
def test_When_SolidHasAPattern_Expect_Parsed(pattern):
    fit = parse(pattern=pattern)
    assert fit.is_successful, fit.error
    assert fit.value.background.pattern == FitPattern(pattern.lower())


@pytest.mark.parametrize("mode", ["blur", "solid", "image"])
def test_When_DimIsGiven_Expect_Parsed(mode):
    fit = parse(mode=mode, dim="0.35")
    assert fit.is_successful, fit.error
    assert fit.value.background.dim == pytest.approx(0.35)


@pytest.mark.parametrize(
    "mode, pattern, dim",
    [
        ("solid", "zigzag", None),
        ("blur", "dots", None),
        ("transparent", "grid", None),
        ("image", "checker", None),
        ("crop", "dots", None),
        ("solid", None, "-0.1"),
        ("solid", None, "0.95"),
        ("solid", None, "nan"),
        ("solid", None, "dark"),
        ("transparent", None, "0.2"),
        ("crop", None, "0.2"),
    ],
)
def test_When_BackgroundOptionDoesNotFitTheMode_Expect_Failure(mode, pattern, dim):
    assert not parse(mode=mode, pattern=pattern, dim=dim).is_successful


def test_When_ImageModeIsUsedWithoutPositionValues_Expect_PlaceableLikeTheOtherBackgrounds():
    fit = FitToSize.from_strings_result("400", "200", "image", "", None, "0.5", "0.3", "0.6")
    assert fit.is_successful, fit.error
    assert fit.value.placement == FitPlacement(0.5, 0.3, 0.6)


# --- Patterns ----------------------------------------------------------------
# One pattern cell is 1/40 of the longer target side: 10 px on a 400 px canvas.


@pytest.mark.parametrize(
    "pattern, inked, plain",
    [
        (FitPattern.CHECKER, [(15, 5), (5, 15)], [(5, 5), (15, 15)]),
        (FitPattern.DOTS, [(5, 5), (15, 25)], [(0, 0), (10, 10), (9, 1)]),
        (FitPattern.STRIPES, [(1, 1), (6, 6), (12, 0)], [(4, 4), (7, 0), (0, 8)]),
        (FitPattern.GRID, [(0, 5), (5, 0), (10, 37)], [(5, 5), (15, 15)]),
    ],
)
def test_When_PatternIsDrawn_Expect_InkOnlyWhereThePatternIs(pattern, inked, plain):
    out = render(tiny(pattern=pattern))
    for point in inked:
        assert out.getpixel(point) == INKED_WHITE, (pattern, point)
    for point in plain:
        assert out.getpixel(point) == WHITE, (pattern, point)
    # The image itself is never patterned.
    assert out.getpixel((200, 200)) == GREEN


def test_When_PatternColourIsDark_Expect_LightInk():
    out = render(tiny(color="#000000", pattern=FitPattern.CHECKER))
    assert out.getpixel((5, 5)) == (0, 0, 0)
    assert out.getpixel((15, 5)) == (41, 41, 41)


def test_When_PatternPreviewIsScaledDown_Expect_SameLayoutAsTheExport():
    fit = tiny(pattern=FitPattern.CHECKER, size=(800, 400))
    full = render(fit)
    small = render(fit, output_size=(400, 200))
    # Cells are 20 px at full size and 10 px in the half-size preview.
    assert full.getpixel((30, 10)) == INKED_WHITE and small.getpixel((15, 5)) == INKED_WHITE
    assert full.getpixel((10, 10)) == WHITE and small.getpixel((5, 5)) == WHITE


def test_When_PatternOnSemiTransparentColour_Expect_AlphaKept():
    out = ImageResizer.fit_image(Image.new("RGB", (100, 100), GREEN), tiny(color="#ffffff80", pattern=FitPattern.GRID))
    assert out.mode == "RGBA"
    assert out.getpixel((5, 5)) == (255, 255, 255, 128)
    assert out.getpixel((0, 5))[3] > 128


# --- Dimming -----------------------------------------------------------------


def test_When_SolidIsDimmed_Expect_DarkerBackgroundButUntouchedImage():
    out = render(tiny(color="#ffffff", dim=0.5))
    assert all(abs(channel - 128) <= 1 for channel in out.getpixel((5, 5)))
    assert out.getpixel((200, 200)) == GREEN


def test_When_BlurIsDimmed_Expect_DarkerThanWithoutDim():
    image = Image.new("RGB", (100, 100), (200, 200, 200))
    plain = render(tiny(FitMode.BLUR), image)
    dimmed = render(tiny(FitMode.BLUR, dim=0.5), image)
    assert dimmed.getpixel((5, 5))[0] == pytest.approx(plain.getpixel((5, 5))[0] / 2, abs=2)
    assert dimmed.getpixel((200, 200)) == plain.getpixel((200, 200))


def test_When_NothingIsSet_Expect_DefaultBlurAndSolidUnchanged():
    image = Image.new("RGB", (300, 120), GREEN)
    for mode in (FitMode.BLUR, FitMode.SOLID):
        before = ImageResizer.fit_image(image, FitToSize(400, 200, mode, FitAnchor.CENTER, "#123456"))
        after = ImageResizer.fit_image(
            image, FitToSize(400, 200, mode, FitAnchor.CENTER, "#123456", None, FitBackground())
        )
        assert np.array_equal(np.asarray(before), np.asarray(after)), mode


# --- Background image --------------------------------------------------------


def test_When_BackgroundImageIsSet_Expect_ItCoversTheCanvasBehindTheImage():
    background = split((100, 100), RED, BLUE, vertical=False)
    out = render(tiny(FitMode.IMAGE, image=background, size=(400, 200)))
    # A square image covering 400x200 is cut at top and bottom, never letterboxed.
    assert out.getpixel((5, 5)) == RED
    assert out.getpixel((395, 5)) == RED
    assert out.getpixel((5, 195)) == BLUE
    assert out.getpixel((200, 100)) == GREEN


def test_When_BackgroundImageIsWider_Expect_CentredCrop():
    background = Image.new("RGB", (300, 100), RED)
    background.paste(BLUE, (100, 0, 200, 100))
    out = render(tiny(FitMode.IMAGE, image=background, size=(200, 200)))
    # Only the middle third (blue) is visible on a square canvas.
    assert out.getpixel((2, 2)) == BLUE
    assert out.getpixel((197, 197)) == BLUE


def test_When_BackgroundImageIsDimmed_Expect_Darker():
    out = render(tiny(FitMode.IMAGE, image=Image.new("RGB", (50, 50), (200, 100, 40)), dim=0.25))
    assert out.getpixel((5, 5)) == pytest.approx((150, 75, 30), abs=1)


def test_When_BackgroundImageHasAlpha_Expect_FlattenedOnWhite():
    out = render(tiny(FitMode.IMAGE, image=Image.new("RGBA", (50, 50), (0, 0, 0, 0))))
    assert out.getpixel((5, 5)) == WHITE


def test_When_ImageModeHasNoBackgroundImage_Expect_Error():
    with pytest.raises(ValueError):
        render(tiny(FitMode.IMAGE))


def test_When_ImageModeIsNotPlaced_Expect_ImageContainedAndCentred():
    fit = FitToSize(400, 200, FitMode.IMAGE, FitAnchor.CENTER, "#ffffff", None,
                    FitBackground(image=Image.new("RGB", (10, 10), RED)))
    out = render(fit, Image.new("RGB", (100, 100), GREEN))
    assert out.getpixel((200, 100)) == GREEN
    assert out.getpixel((105, 100)) == GREEN
    assert out.getpixel((95, 100)) == RED


# --- Web preview service -----------------------------------------------------


def test_When_PreviewHasABackgroundImage_Expect_ItIsRenderedButNotEchoed():
    result = preview(
        Image.new("RGB", (100, 100), GREEN),
        background=png(split((100, 100), RED, BLUE)),
        fit_mode="image",
        fit_dim="0",
    )
    assert result.is_successful, result.error
    crop, data = result.value
    assert crop["fit"]["mode"] == "image"
    assert crop["fit"]["background"] == {"pattern": "none", "dim": 0.0}
    with Image.open(BytesIO(data)) as out:
        out = out.convert("RGB")
        assert out.getpixel((5, 100)) == RED
        assert out.getpixel((395, 100)) == BLUE
        assert out.getpixel((200, 100)) == GREEN


def test_When_PreviewHasPatternAndDim_Expect_EchoedForSaving():
    result = preview(Image.new("RGB", (100, 100)), fit_mode="solid", fit_pattern="dots", fit_dim="0.2")
    assert result.is_successful, result.error
    assert result.value[0]["fit"]["background"] == {"pattern": "dots", "dim": 0.2}


def test_When_PreviewHasNoBackgroundOptions_Expect_NoBackgroundInTheResponse():
    result = preview(Image.new("RGB", (100, 100)), fit_mode="solid")
    assert "background" not in result.value[0]["fit"]


def test_When_ImageModeHasNoUpload_Expect_ClearError():
    result = preview(Image.new("RGB", (100, 100)), fit_mode="image")
    assert not result.is_successful
    assert "background image" in result.error.lower()


def test_When_BackgroundUploadIsNotAnImage_Expect_Rejected():
    result = preview(Image.new("RGB", (100, 100)), background=BytesIO(b"not an image"), fit_mode="image")
    assert not result.is_successful
    assert "background image" in result.error.lower()


def test_When_BackgroundUploadIsAnSvg_Expect_Rejected():
    svg = BytesIO(b'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')
    result = preview(Image.new("RGB", (100, 100)), background=svg, fit_mode="image")
    assert not result.is_successful


def test_When_BackgroundUploadIsTooLarge_Expect_RejectedWithoutReadingItAll(monkeypatch):
    from backend.image_converter.infrastructure import editor_asset_store

    limit = 4 << 20
    monkeypatch.setattr(editor_asset_store, "max_upload_bytes", lambda: limit)

    class Endless:
        read_bytes = 0

        def read(self, size=-1):
            size = 1 << 20 if size is None or size < 0 else size
            self.read_bytes += size
            return b"\0" * size

    stream = Endless()
    result = preview(Image.new("RGB", (100, 100)), background=stream, fit_mode="image")
    assert not result.is_successful
    assert "too large" in result.error.lower()
    assert stream.read_bytes <= limit + (1 << 20)


def test_When_BackgroundUploadIsSentWithOtherModes_Expect_Ignored():
    result = preview(
        Image.new("RGB", (100, 100), GREEN),
        background=png(Image.new("RGB", (10, 10), RED)),
        fit_mode="solid",
        fit_color="#0000ff",
    )
    assert result.is_successful, result.error
    with Image.open(BytesIO(result.value[1])) as out:
        assert out.convert("RGB").getpixel((5, 100)) == BLUE


def test_When_SvgIsPlacedOnABackgroundImage_Expect_BothRendered():
    from backend.image_converter.presentation.web.server import app

    svg = b'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="#00c800"/></svg>'
    response = app.test_client().post(
        "/api/crop/fit",
        data={
            "fit_width": "100",
            "fit_height": "100",
            "fit_mode": "image",
            "fit_scale": "0.5",
            "render": "true",
            "file": (BytesIO(svg), "logo.svg"),
            "fit_background": (png(Image.new("RGB", (30, 30), RED)), "bg.png"),
        },
    )
    assert response.status_code == 200, response.json
    with Image.open(BytesIO(response.data)) as out:
        out = out.convert("RGB")
        assert out.getpixel((50, 50)) == (0, 200, 0)
        assert out.getpixel((5, 5)) == RED


def test_When_BackgroundImageIsRendered_Expect_NoFilesWritten(monkeypatch):
    created = []
    original = tempfile.mkdtemp

    def recording(*args, **kwargs):
        path = original(*args, **kwargs)
        created.append(path)
        return path

    monkeypatch.setattr(tempfile, "mkdtemp", recording)
    before = set(os.listdir(tempfile.gettempdir()))
    result = preview(
        Image.new("RGB", (100, 100), GREEN),
        background=png(Image.new("RGB", (30, 30), RED)),
        fit_mode="image",
    )
    assert result.is_successful
    assert created == []
    assert set(os.listdir(tempfile.gettempdir())) - before == set()


# --- Batch API (/api/compress) -----------------------------------------------


def test_When_CompressionFormAsksForImageMode_Expect_RejectedBecauseItNeedsTheEditor(tmp_path):
    use_case = _CapturingUseCase()
    service = CompressionService(DummyLogger(), use_case=use_case, temp_folder_service=_TempFolders(tmp_path))
    result = service.compress(_form_data(ImageFormat.PNG, fit_width="100", fit_height="100", fit_mode="image"))
    assert not result.is_successful
    assert use_case.request is None


# --- Blur strength and tint --------------------------------------------------


def parse_extra(mode="blur", **fields):
    return FitToSize.from_strings_result("400", "400", mode, "", "", "", "", "", **fields)


def stripes(size=(120, 120), period=6):
    """Hard black and white stripes; any blur greys them out."""
    data = (np.arange(size[0]) // (period // 2) % 2 * 255).astype(np.uint8)
    return Image.fromarray(np.tile(data, (size[1], 1))).convert("RGB")


def with_background(fit, background):
    return replace(fit, background=background)


def contrast(image, box):
    return float(np.asarray(image.crop(box).convert("L"), dtype=np.float32).std())


def test_When_BlurIsLeftOut_Expect_NoneAndModeDefaults():
    fit = parse_extra("blur").value
    assert fit.background.blur is None
    assert fit.background.blur_for(FitMode.BLUR) == DEFAULT_BLUR_STRENGTH
    assert fit.background.blur_for(FitMode.IMAGE) == 0.0
    assert fit.background.is_plain


@pytest.mark.parametrize("mode,value", [("blur", "0.25"), ("image", "0")])
def test_When_BlurEqualsTheModeDefault_Expect_StoredAsDefault(mode, value):
    assert parse_extra(mode, blur=value).value.background.blur is None


@pytest.mark.parametrize("raw,expected", [("0.6", 0.6), ("0", 0.0), ("1", 1.0), ("7", 1.0), ("-3", 0.0)])
def test_When_BlurIsOutOfRange_Expect_Clamped(raw, expected):
    assert parse_extra("blur", blur=raw).value.background.blur == expected


@pytest.mark.parametrize("raw", ["abc", "nan", "inf", "-inf"])
def test_When_BlurIsNotANumber_Expect_Failure(raw):
    assert not parse_extra("blur", blur=raw).is_successful


@pytest.mark.parametrize("mode", ["solid", "transparent", "crop"])
def test_When_BlurIsGivenForAModeWithoutBlur_Expect_Failure(mode):
    result = parse_extra(mode, blur="0.5")
    assert not result.is_successful
    assert "blur" in result.error.lower()


def test_When_BlurRadiusIsMapped_Expect_DefaultUnchangedAndLinear():
    base = max(2.0, 1200 * 0.025) * 600 / 1200
    assert ImageResizer.blur_radius(1200, 630, (600, 315)) == base
    assert ImageResizer.blur_radius(1200, 630, (600, 315), 0.25) == base
    assert ImageResizer.blur_radius(1200, 630, (600, 315), 0.5) == pytest.approx(base * 2)
    assert ImageResizer.blur_radius(1200, 630, (600, 315), 1.0) == pytest.approx(base * 4)
    assert ImageResizer.blur_radius(1200, 630, (600, 315), 0.0) == 0.0


def test_When_BlurIsExplicitDefault_Expect_ByteIdenticalOutput():
    image = Image.new("RGB", (300, 120), GREEN)
    plain = ImageResizer.fit_image(image, FitToSize(400, 200, FitMode.BLUR))
    parsed = FitToSize.from_strings_result("400", "200", "blur", "", "", "", "", "", blur="0.25").value
    assert np.array_equal(np.asarray(plain), np.asarray(ImageResizer.fit_image(image, parsed)))


def test_When_BlurIsStronger_Expect_SofterBackground():
    image = stripes()
    corner = (0, 0, 60, 60)
    sharp = render(with_background(tiny(FitMode.BLUR), FitBackground(blur=0.0)), image)
    default = render(tiny(FitMode.BLUR), image)
    strong = render(with_background(tiny(FitMode.BLUR), FitBackground(blur=1.0)), image)
    assert contrast(sharp, corner) > contrast(default, corner) > contrast(strong, corner)


def test_When_BackgroundImageIsBlurred_Expect_SofterThanSharpDefault():
    background = stripes((200, 200), 10)
    sharp = render(tiny(FitMode.IMAGE, image=background))
    blurred_fit = tiny(FitMode.IMAGE, image=background)
    blurred = render(with_background(blurred_fit, FitBackground(image=background, blur=0.5)))
    corner = (0, 0, 80, 80)
    assert contrast(sharp, corner) > 40
    assert contrast(blurred, corner) < contrast(sharp, corner) / 2
    # The image in front stays sharp.
    assert blurred.getpixel((200, 200)) == GREEN


def test_When_TintIsGiven_Expect_ParsedClampedAndValidated():
    bg = parse_extra("solid", tint="0.4", tint_color="#3366FF").value.background
    assert (bg.tint, bg.tint_color) == (0.4, "#3366ff")
    assert parse_extra("solid", tint="5").value.background.tint == 1.0
    assert parse_extra("solid", tint="-1").value.background.tint == 0.0
    assert not parse_extra("solid", tint="x").is_successful
    assert not parse_extra("solid", tint="0.3", tint_color="transparent").is_successful
    assert not parse_extra("solid", tint="0.3", tint_color="#11223344").is_successful
    assert not parse_extra("solid", tint="0.3", tint_color="url(x)").is_successful
    assert not parse_extra("transparent", tint="0.3").is_successful
    # No opacity means no tint; the colour alone changes nothing.
    assert parse_extra("solid", tint_color="#ff0000").value.background.is_plain


@pytest.mark.parametrize("mode", [FitMode.SOLID, FitMode.BLUR, FitMode.IMAGE])
def test_When_BackgroundIsTinted_Expect_ColourMixedInButImageUntouched(mode):
    image = Image.new("RGB", (100, 100), GREEN)
    base_bg = Image.new("RGB", (50, 50), (200, 200, 200))
    fit = tiny(mode, color="#c8c8c8", image=base_bg if mode == FitMode.IMAGE else None)
    plain = render(with_background(fit, FitBackground(image=fit.background.image)), image)
    tinted = render(
        with_background(fit, FitBackground(image=fit.background.image, tint=0.5, tint_color="#ff0000")), image
    )
    before, after = plain.getpixel((5, 5)), tinted.getpixel((5, 5))
    assert after == pytest.approx(((before[0] + 255) / 2, before[1] / 2, before[2] / 2), abs=2)
    assert tinted.getpixel((200, 200)) == GREEN


def test_When_TintAndPatternOnTransparentColour_Expect_AlphaKept():
    fit = tiny(FitMode.SOLID, color="#ffffff80", pattern=FitPattern.CHECKER)
    out = ImageResizer.fit_image(
        Image.new("RGB", (100, 100), GREEN),
        with_background(fit, FitBackground(FitPattern.CHECKER, tint=0.5, tint_color="#0000ff")),
    )
    assert out.mode == "RGBA"
    assert out.getpixel((5, 5))[3] == 128


def test_When_PreviewHasBlurAndTint_Expect_EchoedForSaving():
    result = preview(Image.new("RGB", (100, 100)), fit_mode="blur", fit_blur="0.6", fit_tint="0.3", fit_tint_color="#ff8800")
    assert result.is_successful, result.error
    assert result.value[0]["fit"]["background"] == {
        "pattern": "none",
        "dim": 0.0,
        "blur": 0.6,
        "tint": {"color": "#ff8800", "opacity": 0.3},
    }


def test_When_PreviewHasDefaultBlur_Expect_NoBackgroundEchoed():
    result = preview(Image.new("RGB", (100, 100)), fit_mode="blur", fit_blur="0.25", fit_tint="0")
    assert "background" not in result.value[0]["fit"]
