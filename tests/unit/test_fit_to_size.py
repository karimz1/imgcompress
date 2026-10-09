"""Tests for "Fit to size": request parsing, smart crop placement, and the resizer."""

from io import BytesIO

import numpy as np
import pytest
from PIL import Image, ImageDraw

from backend.image_converter.application.dtos import CompressionFormData
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.core.image_conversion_processor import ImageConversionProcessor
from backend.image_converter.domain.fit_to_size import (
    MAX_FIT_DIMENSION,
    FitAnchor,
    FitMode,
    FitToSize,
)
from backend.image_converter.domain.image_resizer import ImageResizer
from backend.image_converter.domain.smart_crop import find_crop_offset
from backend.image_converter.presentation.web.services.compression_service import (
    CompressionService,
)
from tests.unit.dummy_logger import DummyLogger


def _encode(img: Image.Image, fmt: str = "PNG", **kwargs) -> bytes:
    buffer = BytesIO()
    img.save(buffer, format=fmt, **kwargs)
    return buffer.getvalue()


def _decode(data: bytes) -> Image.Image:
    img = Image.open(BytesIO(data))
    img.load()
    return img


def _stripes(size: tuple[int, int], vertical: bool) -> Image.Image:
    """Three equal stripes: red, green, blue (left to right, or top to bottom)."""
    width, height = size
    img = Image.new("RGB", size)
    draw = ImageDraw.Draw(img)
    for index, colour in enumerate([(255, 0, 0), (0, 255, 0), (0, 0, 255)]):
        if vertical:
            draw.rectangle((index * width // 3, 0, (index + 1) * width // 3, height), fill=colour)
        else:
            draw.rectangle((0, index * height // 3, width, (index + 1) * height // 3), fill=colour)
    return img


# --- FitToSize.from_strings_result -------------------------------------------------


@pytest.mark.parametrize("width, height", [(None, None), ("", ""), ("  ", " ")])
def test_When_FitSizeIsBlank_Expect_FeatureOff(width, height):
    result = FitToSize.from_strings_result(width, height)

    assert result.is_successful
    assert result.value is None


@pytest.mark.parametrize("width, height", [("1280", ""), ("", "640")])
def test_When_FitSizeHasOnlyOneSide_Expect_Failure(width, height):
    result = FitToSize.from_strings_result(width, height)

    assert not result.is_successful
    assert "both a width and a height" in result.error


def test_When_OnlyFitSizeGiven_Expect_CropWithAutoAnchor():
    result = FitToSize.from_strings_result("1280", "640")

    assert result.is_successful
    assert result.value == FitToSize(1280, 640, FitMode.CROP, FitAnchor.AUTO)


def test_When_FitModeAndAnchorGiven_Expect_ParsedCaseInsensitive():
    result = FitToSize.from_strings_result(" 1200 ", "630", "BLUR", " Bottom ")

    assert result.is_successful
    assert result.value == FitToSize(1200, 630, FitMode.BLUR, FitAnchor.BOTTOM)


@pytest.mark.parametrize(
    "width, height",
    [("abc", "640"), ("1280.5", "640"), ("0", "640"), ("1280", "-1"), (str(MAX_FIT_DIMENSION + 1), "640")],
)
def test_When_FitSizeIsInvalid_Expect_Failure(width, height):
    result = FitToSize.from_strings_result(width, height)

    assert not result.is_successful


@pytest.mark.parametrize("mode, anchor, bad", [("stretch", None, "stretch"), (None, "middle", "middle")])
def test_When_FitModeOrAnchorUnknown_Expect_FailureNamingValue(mode, anchor, bad):
    result = FitToSize.from_strings_result("100", "100", mode, anchor)

    assert not result.is_successful
    assert bad in result.error


# --- find_crop_offset ---------------------------------------------------------------


def test_When_ImageIsFlat_Expect_CentredCrop():
    img = Image.new("RGB", (1000, 500), (90, 120, 200))

    assert find_crop_offset(img, 500, 500) == (250, 0)


def test_When_ImageIsUniformNoise_Expect_RoughlyCentredCrop():
    rng = np.random.default_rng(0)
    img = Image.fromarray(rng.integers(0, 255, (500, 1000, 3), dtype=np.uint8))

    left, top = find_crop_offset(img, 500, 500)

    assert top == 0
    assert 150 <= left <= 350


@pytest.mark.parametrize("subject_left, expected_range", [(50, (0, 50)), (950, (750, 800))])
def test_When_SubjectIsOffCentre_Expect_WindowKeepsSubject(subject_left, expected_range):
    img = Image.new("RGB", (1200, 400), (200, 200, 200))
    ImageDraw.Draw(img).ellipse((subject_left, 100, subject_left + 200, 300), fill=(220, 30, 30))

    left, top = find_crop_offset(img, 400, 400)

    assert top == 0
    assert expected_range[0] <= left <= expected_range[1]
    assert left <= subject_left and subject_left + 200 <= left + 400


def test_When_TextSitsNearBottom_Expect_WindowKeepsWholeLine():
    img = Image.new("RGB", (400, 1200), (240, 240, 240))
    ImageDraw.Draw(img).text((20, 1000), "HELLO WORLD", fill=(0, 0, 0), font_size=40)

    _, top = find_crop_offset(img, 400, 400)

    assert top <= 990 and 1050 <= top + 400


def test_When_TitleWouldBeSliced_Expect_WindowMovesToKeepItWhole():
    # Busy texture everywhere, a solid title band 60..120 at the top. A window
    # that touches the top border keeps it; a centred one would slice it.
    rng = np.random.default_rng(1)
    noise = rng.integers(100, 156, (600, 400, 3), dtype=np.uint8)
    img = Image.fromarray(noise)
    draw = ImageDraw.Draw(img)
    for x in range(10, 390, 24):
        draw.rectangle((x, 60, x + 14, 120), fill=(255, 255, 255), outline=(0, 0, 0), width=3)

    _, top = find_crop_offset(img, 400, 400)

    assert top <= 55 or top >= 125
    assert top <= 55, "the title has the most detail and should stay in the frame"


def test_When_OnlyOpaquePartHasContent_Expect_WindowCoversIt():
    img = Image.new("RGBA", (1200, 400), (0, 0, 0, 0))
    ImageDraw.Draw(img).rectangle((900, 50, 1150, 350), fill=(20, 200, 20, 255))

    left, _ = find_crop_offset(img, 400, 400)

    assert left <= 900 and 1150 <= left + 400


@pytest.mark.parametrize("size, window", [((3, 1), (1, 1)), ((9000, 9), (9, 9)), ((100, 100), (100, 100))])
def test_When_ImageIsTinyOrAlreadyExact_Expect_NoError(size, window):
    left, top = find_crop_offset(Image.new("RGB", size), *window)

    assert 0 <= left <= size[0] - window[0]
    assert 0 <= top <= size[1] - window[1]


# --- ImageResizer.fit_to_size --------------------------------------------------------


@pytest.mark.parametrize("mode", list(FitMode))
@pytest.mark.parametrize("source_size", [(1536, 1024), (600, 900), (100, 40), (1280, 640)])
def test_When_FittingAnySize_Expect_ExactTargetDimensions(mode, source_size):
    data = _encode(_stripes(source_size, vertical=True))

    out = _decode(ImageResizer().fit_to_size(data, FitToSize(1280, 640, mode)))

    assert out.size == (1280, 640)


@pytest.mark.parametrize(
    "anchor, vertical, expected",
    [
        (FitAnchor.TOP, False, (255, 0, 0)),
        (FitAnchor.BOTTOM, False, (0, 0, 255)),
        (FitAnchor.CENTER, False, (0, 255, 0)),
        (FitAnchor.LEFT, True, (255, 0, 0)),
        (FitAnchor.RIGHT, True, (0, 0, 255)),
        (FitAnchor.CENTER, True, (0, 255, 0)),
    ],
)
def test_When_CroppingWithAnchor_Expect_ThatSideKept(anchor, vertical, expected):
    # Square target from a 3:1 (or 1:3) image keeps exactly one stripe.
    source = _stripes((900, 300) if vertical else (300, 900), vertical=vertical)

    out = _decode(ImageResizer().fit_to_size(_encode(source), FitToSize(200, 200, FitMode.CROP, anchor)))

    assert out.size == (200, 200)
    centre = out.convert("RGB").getpixel((100, 100))
    assert all(abs(a - b) <= 2 for a, b in zip(centre, expected))


def test_When_AnchorDoesNotMatchFreeAxis_Expect_Centred():
    # The image is wider than the target, so TOP has nothing to do; stay centred.
    source = _stripes((900, 300), vertical=True)

    out = _decode(ImageResizer().fit_to_size(_encode(source), FitToSize(200, 200, FitMode.CROP, FitAnchor.TOP)))

    assert out.convert("RGB").getpixel((100, 100)) == (0, 255, 0)


def test_When_FittingOnBlur_Expect_WholeImageInMiddleAndDarkerBlurredSides():
    source = Image.new("RGB", (400, 400), (240, 240, 240))
    ImageDraw.Draw(source).rectangle((0, 0, 399, 399), outline=(255, 0, 0), width=8)

    out = _decode(ImageResizer().fit_to_size(_encode(source), FitToSize(800, 400, FitMode.BLUR))).convert("RGB")

    assert out.size == (800, 400)
    pixels = np.asarray(out, dtype=np.float32)
    # The red frame of the source sits fully inside the middle 400px.
    assert out.getpixel((202, 200))[0] > 200 and out.getpixel((202, 200))[1] < 60
    assert out.getpixel((597, 200))[0] > 200 and out.getpixel((597, 200))[1] < 60
    # The sides are a darkened, smooth version of the light background.
    side = pixels[:, 20:180]
    assert side.mean() < 240 * 0.95
    assert np.abs(np.diff(side, axis=1)).max() < 12


def test_When_BlurringTransparentImage_Expect_OpaqueOutputOnLightBackground():
    source = Image.new("RGBA", (300, 300), (0, 0, 0, 0))
    ImageDraw.Draw(source).ellipse((50, 50, 250, 250), fill=(0, 0, 255, 255))

    out = _decode(ImageResizer().fit_to_size(_encode(source), FitToSize(600, 300, FitMode.BLUR)))

    assert out.mode == "RGB"
    # Transparent areas were flattened onto white, not onto black.
    assert min(out.getpixel((10, 10))) > 150


def test_When_CroppingTransparentImage_Expect_AlphaKept():
    source = Image.new("RGBA", (600, 300), (0, 0, 0, 0))
    ImageDraw.Draw(source).ellipse((200, 50, 400, 250), fill=(0, 0, 255, 255))

    out = _decode(ImageResizer().fit_to_size(_encode(source), FitToSize(300, 300)))

    assert out.mode == "RGBA"
    assert out.getpixel((0, 0))[3] == 0
    assert out.getpixel((150, 150))[3] == 255


@pytest.mark.parametrize("mode", list(FitMode))
@pytest.mark.parametrize("source_size", [(2, 3000), (3000, 2)])
def test_When_SourceIsThinStrip_Expect_NoResizeBeyondTargetSize(monkeypatch, mode, source_size):
    # Scaling a 2 x 3000 strip to cover 4096 x 4096 first would mean a
    # 4096 x 6 million pixel intermediate image. Only the part that ends up in
    # the output may be resampled.
    sizes = []
    original_resize = Image.Image.resize

    def spy(self, size, *args, **kwargs):
        sizes.append(tuple(size))
        return original_resize(self, size, *args, **kwargs)

    monkeypatch.setattr(Image.Image, "resize", spy)
    data = _encode(_stripes(source_size, vertical=source_size[0] > source_size[1]))

    out = _decode(ImageResizer().fit_to_size(data, FitToSize(4096, 4096, mode)))

    assert out.size == (4096, 4096)
    assert max(width * height for width, height in sizes) <= 4096 * 4096


@pytest.mark.parametrize("anchor", list(FitAnchor))
@pytest.mark.parametrize("source_size", [(1536, 1024), (640, 1280), (7, 3), (1280, 640)])
def test_When_ComputingCropBox_Expect_TargetAspectInsideImage(anchor, source_size):
    img = _stripes(source_size, vertical=True)

    left, top, right, bottom = ImageResizer.fit_crop_box(img, 1280, 640, anchor)

    assert 0 <= left <= right <= img.width
    assert 0 <= top <= bottom <= img.height
    assert (right - left) / (bottom - top) == pytest.approx(2.0)
    assert (right - left) == pytest.approx(img.width) or (bottom - top) == pytest.approx(img.height)


def test_When_SourceHasExifRotation_Expect_FitAppliedToUprightImage():
    # Stored landscape, EXIF says rotate 90 degrees: the upright image is portrait.
    source = _stripes((300, 100), vertical=True)
    exif = Image.Exif()
    exif[0x0112] = 6
    data = _encode(source, "JPEG", exif=exif.tobytes(), quality=95)

    out = _decode(ImageResizer().fit_to_size(data, FitToSize(100, 100, FitMode.CROP, FitAnchor.TOP)))

    # Upright, the first stripe (red) ends up on top.
    top_pixel = out.convert("RGB").getpixel((50, 50))
    assert top_pixel[0] > 200 and top_pixel[1] < 60 and top_pixel[2] < 60


def test_When_Fitting16BitGreyscaleOnBlur_Expect_GreyNotClippedToWhite():
    ramp = np.tile(np.linspace(0, 65535, 300), (600, 1)).astype(np.uint16)

    out = _decode(ImageResizer().fit_to_size(_encode(Image.fromarray(ramp)), FitToSize(400, 200, FitMode.BLUR)))

    assert 100 <= out.getpixel((200, 100))[0] <= 160


# --- Service and CLI processor wiring -------------------------------------------------


def _form_data(image_format: ImageFormat, **overrides) -> CompressionFormData:
    values = dict(
        uploaded_files=(),
        quality=85,
        width=800,
        image_format=image_format,
        target_size_kb=None,
        use_rembg=False,
        pdf_preset="",
        pdf_scale="",
        pdf_margin_mm=10.0,
        pdf_paginate=False,
    )
    values.update(overrides)
    return CompressionFormData(**values)


class _CapturingUseCase:
    def __init__(self):
        self.request = None

    def execute(self, req):
        from backend.image_converter.application.dtos import CompressResult

        self.request = req
        return CompressResult(processed_files=[], errors=["captured"])


class _TempFolders:
    def __init__(self, root):
        self.root = root
        self.count = 0

    def create_temp_dir(self, prefix: str) -> str:
        self.count += 1
        path = self.root / f"{prefix}{self.count}"
        path.mkdir()
        return str(path)


def test_When_CompressingPdfWithFit_Expect_Rejected():
    service = CompressionService(DummyLogger(), use_case=None, temp_folder_service=None)

    result = service.compress(_form_data(ImageFormat.PDF, fit_width="1280", fit_height="640"))

    assert not result.is_successful
    assert "PDF" in result.error


def test_When_CompressingWithInvalidFit_Expect_RejectedBeforeConversion():
    service = CompressionService(DummyLogger(), use_case=None, temp_folder_service=None)

    result = service.compress(_form_data(ImageFormat.JPEG, fit_width="1280", fit_height="", fit_mode="crop"))

    assert not result.is_successful
    assert "both a width and a height" in result.error


def test_When_CompressingWithFit_Expect_FitPassedAndWidthDropped(tmp_path):
    use_case = _CapturingUseCase()
    service = CompressionService(DummyLogger(), use_case=use_case, temp_folder_service=_TempFolders(tmp_path))

    service.compress(
        _form_data(ImageFormat.JPEG, fit_width="1200", fit_height="630", fit_mode="blur", fit_anchor="")
    )

    assert use_case.request.fit == FitToSize(1200, 630, FitMode.BLUR, FitAnchor.AUTO)
    assert use_case.request.width is None


def test_When_CompressingWithoutFit_Expect_WidthKept(tmp_path):
    use_case = _CapturingUseCase()
    service = CompressionService(DummyLogger(), use_case=use_case, temp_folder_service=_TempFolders(tmp_path))

    service.compress(_form_data(ImageFormat.JPEG))

    assert use_case.request.fit is None
    assert use_case.request.width == 800


def test_When_CliProcessorHasFit_Expect_OutputAtExactSize(tmp_path):
    source = tmp_path / "card.png"
    _stripes((900, 600), vertical=True).save(source)
    destination = tmp_path / "out"

    processor = ImageConversionProcessor(
        source=str(source),
        destination=str(destination),
        image_format=ImageFormat.JPEG,
        width=300,
        fit=FitToSize(1280, 640, FitMode.BLUR),
    )
    processor.run()

    with Image.open(destination / "card.jpg") as out:
        assert out.size == (1280, 640)
    assert processor.results[0].resized_width == 1280


def test_When_CliGetsFit_Expect_ProcessorReceivesParsedFitAndNoWidth(monkeypatch):
    from backend.image_converter.presentation.cli import app

    captured = {}

    class _Processor:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        def run(self):
            pass

    monkeypatch.setattr(app, "ImageConversionProcessor", _Processor)

    app.main(["in", "out", "--width", "300", "--fit", "1200X630", "--fit-mode", "blur", "--fit-anchor", "top"])

    assert captured["fit"] == FitToSize(1200, 630, FitMode.BLUR, FitAnchor.TOP)
    assert captured["width"] is None


@pytest.mark.parametrize(
    "argv",
    [
        ["in", "out", "--fit", "1280"],
        ["in", "out", "--fit", "wide x tall"],
        ["in", "out", "--fit", "0x640"],
        ["in", "out", "--fit", "1280x640", "--format", "pdf"],
    ],
)
def test_When_CliFitIsInvalid_Expect_ExitWithError(argv):
    from backend.image_converter.presentation.cli import app

    with pytest.raises(SystemExit) as exc:
        app.main(argv)

    assert exc.value.code == 1
