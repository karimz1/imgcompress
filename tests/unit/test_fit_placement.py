"""Free placement (scale + position) of the whole image on a fit canvas."""

import base64
import math
import threading
from io import BytesIO

import numpy as np
import pytest
from PIL import Image
from werkzeug.datastructures import FileStorage

from backend.image_converter.domain.fit_to_size import (
    FitAnchor,
    FitMode,
    FitPlacement,
    FitToSize,
)
from backend.image_converter.domain.image_resizer import ImageResizer
from backend.image_converter.infrastructure.svg_renderer import SvgRenderer
from backend.image_converter.core.enums.image_format import ImageFormat
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


def placed(mode=FitMode.SOLID, color="#ff0000", scale=0.5, x=0.25, y=0.25, size=(400, 400)):
    return FitToSize(*size, mode, FitAnchor.CENTER, color, FitPlacement(scale, x, y))


def preview(image, **fields):
    bitmap = BytesIO()
    image.save(bitmap, format="PNG")
    bitmap.seek(0)
    return FitPreviewService().build(
        FileStorage(stream=bitmap), {"fit_width": "400", "fit_height": "200", **fields}
    )


# --- Parsing -----------------------------------------------------------------


def test_When_NoPlacementIsGiven_Expect_NoneSoTheDefaultLayoutIsKept():
    fit = FitToSize.from_strings_result("400", "200", "solid", "", "#000000", "", "", "")
    assert fit.is_successful
    assert fit.value.placement is None


def test_When_PlacementIsGiven_Expect_ParsedWithCentreDefaults():
    scale_only = FitToSize.from_strings_result("400", "200", "blur", "", None, "1.5", "", "")
    assert scale_only.value.placement == FitPlacement(1.5, 0.5, 0.5)
    full = FitToSize.from_strings_result("400", "200", "transparent", "", None, "", "0.1", "-0.2")
    assert full.value.placement == FitPlacement(1.0, 0.1, -0.2)


@pytest.mark.parametrize(
    "mode, scale, x, y",
    [
        ("blur", "", "0.5", ""),
        ("blur", "abc", "", ""),
        ("blur", "nan", "", ""),
        ("blur", "inf", "", ""),
        ("blur", "0", "", ""),
        ("blur", "21", "", ""),
        ("solid", "", "-1.5", "0.5"),
        ("solid", "", "0.5", "2.5"),
        ("crop", "1.2", "", ""),
        ("crop", "", "0.5", "0.5"),
    ],
)
def test_When_PlacementIsInvalid_Expect_Failure(mode, scale, x, y):
    assert not FitToSize.from_strings_result("400", "200", mode, "", None, scale, x, y).is_successful


# --- Rendering ---------------------------------------------------------------


def test_When_PlacedOnSolid_Expect_ImageAtTheRequestedRectangle():
    # 200x100 contains in 400x400 at 400x200; half of that is 200x100 centred at (100, 100).
    out = ImageResizer.fit_image(Image.new("RGB", (200, 100), GREEN), placed())
    assert out.size == (400, 400) and out.mode == "RGB"
    assert out.getpixel((2, 52)) == GREEN
    assert out.getpixel((197, 147)) == GREEN
    assert out.getpixel((2, 46)) == RED
    assert out.getpixel((203, 100)) == RED
    assert out.getpixel((300, 300)) == RED


def test_When_PlacementIsCentredAtFullScale_Expect_SameAsTheDefaultLayout():
    image = Image.new("RGB", (300, 120), GREEN)
    for mode in (FitMode.BLUR, FitMode.SOLID, FitMode.TRANSPARENT):
        default = ImageResizer.fit_image(image, FitToSize(400, 200, mode, FitAnchor.CENTER, "#123456"))
        centred = ImageResizer.fit_image(image, placed(mode, "#123456", 1.0, 0.5, 0.5, (400, 200)))
        assert default.mode == centred.mode
        difference = np.abs(np.asarray(default, dtype=int) - np.asarray(centred, dtype=int))
        assert difference.mean() < 1.5, mode


def test_When_PlacedOnTransparent_Expect_PartialAlphaKeptAndEmptyAreaClear():
    image = Image.new("RGBA", (200, 100), (0, 0, 255, 120))
    out = ImageResizer.fit_image(image, placed(FitMode.TRANSPARENT, "transparent"))
    assert out.mode == "RGBA"
    assert out.getpixel((100, 100)) == (0, 0, 255, 120)
    assert out.getpixel((300, 300))[3] == 0


def test_When_PlacedOnBlur_Expect_BlurredCopyAroundTheImage():
    image = Image.new("RGB", (200, 100), GREEN)
    out = ImageResizer.fit_image(image, placed(FitMode.BLUR))
    assert out.getpixel((100, 100)) == GREEN
    # Outside the placed image the darkened blurred copy shows.
    background = out.getpixel((300, 300))
    assert background != GREEN and background[1] > 100


def test_When_ImageIsMovedOffTheCanvas_Expect_OnlyBackground():
    out = ImageResizer.fit_image(Image.new("RGB", (200, 100), GREEN), placed(x=-0.9, y=-0.9))
    assert out.getcolors() == [(400 * 400, RED)]


def test_When_ScaleIsHuge_Expect_OnlyTheVisiblePartIsResampled(monkeypatch):
    sizes = []
    original = Image.Image.resize

    def recording(self, size, *args, **kwargs):
        sizes.append(size)
        return original(self, size, *args, **kwargs)

    monkeypatch.setattr(Image.Image, "resize", recording)
    image = Image.new("RGB", (400, 400), GREEN)
    image.paste(RED, (200, 200, 400, 400))
    out = ImageResizer.fit_image(image, placed(scale=20, x=0.5, y=0.5, size=(2000, 1000)))
    assert out.size == (2000, 1000)
    assert max(w * h for w, h in sizes) <= 2000 * 1000
    # Zoomed into the middle: top-left quarter green, bottom-right red.
    assert out.getpixel((700, 200)) == GREEN
    assert out.getpixel((1300, 800)) == RED


def test_When_PreviewIsScaledDown_Expect_SameLayoutAsTheFullExport():
    pixels = np.zeros((300, 500, 3), dtype=np.uint8)
    pixels[:, :250] = GREEN
    pixels[:, 250:] = (0, 0, 255)
    image = Image.fromarray(pixels)
    fit = placed(FitMode.SOLID, "#ff0000", 0.7, 0.3, 0.6, (4000, 2000))
    full = ImageResizer.fit_image(image, fit)
    small = ImageResizer.fit_image(image, fit, (2000, 1000))
    difference = np.abs(
        np.asarray(full.resize((2000, 1000), Image.Resampling.BOX), dtype=int)
        - np.asarray(small, dtype=int)
    )
    assert difference.mean() < 1.0


def test_When_SvgIsPlacedLarger_Expect_SharpVectorsAtTheRequestedPosition():
    svg = b"""<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">
      <rect width="10" height="10" fill="#00c800"/><rect x="4.9" width="0.2" height="10" fill="red"/>
    </svg>"""
    fit = FitToSize(100, 100, FitMode.SOLID, FitAnchor.CENTER, "#0000ff", FitPlacement(4, 0.5, 0.5))
    result = SvgRenderer().render("detail.svg", svg, fit=fit)
    assert result.is_successful, result.error
    with Image.open(BytesIO(result.value)) as out:
        out = out.convert("RGB")
        assert out.size == (100, 100)
        # A 0.2 unit line drawn 40x larger is 8 px wide, crisp in the middle.
        assert out.getpixel((50, 50)) == (255, 0, 0)
        assert out.getpixel((10, 50)) == (0, 200, 0)


# --- Web API and form --------------------------------------------------------


def test_When_PreviewHasPlacement_Expect_ItIsEchoedAndRendered():
    result = preview(
        Image.new("RGB", (200, 100), GREEN),
        fit_mode="solid",
        fit_color="#ff0000",
        fit_scale="0.5",
        fit_x="0.25",
        fit_y="0.5",
    )
    assert result.is_successful, result.error
    crop, png = result.value
    assert crop["fit"]["placement"] == {"scale": 0.5, "x": 0.25, "y": 0.5}
    with Image.open(BytesIO(png)) as out:
        assert out.convert("RGB").getpixel((100, 100)) == GREEN
        assert out.convert("RGB").getpixel((300, 100)) == RED


def test_When_PreviewHasNoPlacement_Expect_NoPlacementInTheResponse():
    result = preview(Image.new("RGB", (200, 100), GREEN), fit_mode="solid")
    assert result.is_successful
    assert "placement" not in result.value[0]["fit"]


def test_When_PlacementIsSentWithCrop_Expect_Rejected():
    assert not preview(Image.new("RGB", (200, 100)), fit_mode="crop", fit_scale="2").is_successful


def test_When_FitApiRendersSvgPlacement_Expect_ColourAndPositionUsed():
    from backend.image_converter.presentation.web.server import app

    svg = b'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="#00c800"/></svg>'
    response = app.test_client().post(
        "/api/crop/fit",
        data={
            "fit_width": "100",
            "fit_height": "100",
            "fit_mode": "solid",
            "fit_color": "#0000ff",
            "fit_scale": "0.5",
            "fit_x": "0.25",
            "fit_y": "0.25",
            "file": (BytesIO(svg), "wide.svg"),
        },
    )
    assert response.status_code == 200, response.json
    data = base64.b64decode(response.json["preview"].split(",", 1)[1])
    with Image.open(BytesIO(data)) as out:
        out = out.convert("RGB")
        assert out.getpixel((25, 25)) == (0, 200, 0)
        assert out.getpixel((75, 75)) == (0, 0, 255)


def test_When_CompressionFormHasPlacement_Expect_UseCaseReceivesIt(tmp_path):
    use_case = _CapturingUseCase()
    service = CompressionService(DummyLogger(), use_case=use_case, temp_folder_service=_TempFolders(tmp_path))
    service.compress(
        _form_data(
            ImageFormat.PNG,
            fit_width="1200",
            fit_height="630",
            fit_mode="transparent",
            fit_scale="0.8",
            fit_x="0.4",
            fit_y="0.6",
        )
    )
    assert use_case.request.fit.placement == FitPlacement(0.8, 0.4, 0.6)


# --- Several users at once ---------------------------------------------------


def test_When_UsersPreviewAtTheSameTime_Expect_EachGetsTheirOwnImage():
    colours = [(i * 30 % 256, 255 - i * 20, i * 11) for i in range(8)]
    results = [None] * len(colours)
    start = threading.Barrier(len(colours))

    def run(index):
        start.wait()
        scale = 0.3 + index / 20
        results[index] = preview(
            Image.new("RGB", (200, 100), colours[index]),
            fit_mode="solid",
            fit_color="#ffffff",
            fit_scale=str(scale),
            fit_x="0.5",
            fit_y="0.5",
        )

    threads = [threading.Thread(target=run, args=(i,)) for i in range(len(colours))]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    for index, result in enumerate(results):
        assert result.is_successful
        crop, png = result.value
        assert math.isclose(crop["fit"]["placement"]["scale"], 0.3 + index / 20)
        with Image.open(BytesIO(png)) as out:
            assert out.convert("RGB").getpixel((200, 100)) == colours[index]
