"""Editor layers, gradients and the per-session picture store.

Covers what the editor sends to /api/crop/fit beyond the base image: picture
and text layers in order, gradient fills and tints that match CSS, and the
session store that keeps each user's pictures apart.
"""

import json
import math
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO

import numpy as np
import pytest
from flask import Flask
from PIL import Image
from werkzeug.datastructures import FileStorage

from backend.image_converter.domain.fit_layers import (
    MAX_IMAGE_LAYERS,
    MAX_TEXT_LAYERS,
    ImageLayer,
    layers_json,
    parse_layers,
)
from backend.image_converter.domain.fit_to_size import FitToSize
from backend.image_converter.domain.gradient import linear_gradient
from backend.image_converter.domain.image_resizer import ImageResizer
from backend.image_converter.domain.text_overlay import TextSpec
from backend.image_converter.infrastructure import job_folder_lock
from backend.image_converter.infrastructure.cleanup_service import CleanupService
from backend.image_converter.infrastructure.editor_asset_store import (
    EXPIRED_ERROR,
    MAX_ASSETS_PER_SESSION,
    PROXY_MAX_SIDE,
    SESSION_FULL_ERROR,
    SESSION_PREFIX,
    EditorAssetStore,
)
from backend.image_converter.presentation.web.services.fit_preview_service import (
    FitPreviewService,
)
from backend.image_converter.presentation.web.services.temporary_folder_service import (
    TemporaryFolderService,
)

RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)


class _Logger:
    def log(self, *_args, **_kwargs):
        pass


def png_bytes(image) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def upload(image, name="layer.png"):
    return FileStorage(stream=BytesIO(png_bytes(image)), filename=name)


def store_picture(store, image, session=None):
    result = store.add(session, upload(image))
    assert result.is_successful, result.error
    return result.value


def preview(form, image=None, assets=None, full_size=True, background=None):
    base = image or Image.new("RGB", (100, 100), WHITE)
    result = FitPreviewService().build(
        upload(base, "photo.png"),
        {"fit_width": "200", "fit_height": "100", "fit_mode": "solid", "fit_color": "#ffffff",
         **form},
        full_size=full_size,
        background=background,
        assets=assets,
    )
    return result


def decoded(result):
    assert result.is_successful, result.error
    return Image.open(BytesIO(result.value[1])).convert("RGBA")


def layers(*items):
    return json.dumps(list(items))


def image_layer(asset, **fields):
    return {"type": "image", "asset": asset, **fields}


# --- gradients: same maths as CSS linear-gradient ---------------------------

def css_gradient_reference(width, height, start, end, angle):
    """Straight from the CSS spec, written independently of the renderer."""
    rad = math.radians(angle)
    length = abs(width * math.sin(rad)) + abs(height * math.cos(rad))
    out = np.zeros((height, width, 3))
    for y in range(height):
        for x in range(width):
            px, py = x + 0.5 - width / 2, y + 0.5 - height / 2
            t = (px * math.sin(rad) - py * math.cos(rad)) / length + 0.5
            t = min(1.0, max(0.0, t))
            out[y, x] = [s + (e - s) * t for s, e in zip(start, end)]
    return np.rint(out)


@pytest.mark.parametrize("angle", [0, 45, 90, 135, 180, 225, 270, 315, 30])
@pytest.mark.parametrize("size", [(12, 7), (5, 16)])
def test_When_GradientIsDrawn_Expect_CssPixels(angle, size):
    image = linear_gradient(size, RED, BLUE, angle)
    expected = css_gradient_reference(*size, RED, BLUE, angle)
    assert np.abs(np.asarray(image, dtype=float) - expected).max() <= 1


def test_When_GradientGoesDown_Expect_TopStartAndBottomEnd():
    image = linear_gradient((10, 200), RED, BLUE, 180)
    top, bottom = image.getpixel((5, 0)), image.getpixel((5, 199))
    assert top[0] > 250 and top[2] < 5
    assert bottom[2] > 250 and bottom[0] < 5


def test_When_GradientIsDiagonal_Expect_CornersAreThePureColours():
    image = linear_gradient((300, 100), BLACK, WHITE, 45)
    # 45deg points to the top right corner, so bottom left is the start.
    assert image.getpixel((0, 99))[0] <= 2
    assert image.getpixel((299, 0))[0] >= 253


def test_When_SolidHasGradient_Expect_FillIsTheGradient():
    fit = FitToSize.from_strings_result(
        "200", "100", "solid", "", "#ff0000", "0.01", "", "", color_to="#0000ff",
        gradient_angle="90",
    ).value
    out = ImageResizer.fit_image(Image.new("RGB", (10, 10), WHITE), fit).convert("RGB")
    assert np.abs(np.asarray(out, dtype=float)[:3, :] - css_gradient_reference(200, 100, RED, BLUE, 90)[:3, :]).max() <= 1


def test_When_TintHasGradient_Expect_BlendedOverTheBackground():
    fit = FitToSize.from_strings_result(
        "100", "100", "solid", "", "#000000", "0.01", "", "", tint="0.5", tint_color="#ff0000",
        tint_color_to="#0000ff", tint_angle="180",
    ).value
    out = ImageResizer.fit_image(Image.new("RGB", (10, 10), WHITE), fit).convert("RGB")
    top, bottom = out.getpixel((50, 0)), out.getpixel((50, 99))
    assert abs(top[0] - 128) <= 2 and top[2] <= 2
    assert abs(bottom[2] - 128) <= 2 and bottom[0] <= 2


def test_When_GradientIsInAnotherMode_Expect_Failure():
    result = FitToSize.from_strings_result("100", "100", "blur", "", "", "", "", "", color_to="#0000ff")
    assert not result.is_successful


@pytest.mark.parametrize("color_to", ["red", "#12345", "#ff000080"])
def test_When_GradientColourIsInvalid_Expect_Failure(color_to):
    result = FitToSize.from_strings_result("100", "100", "solid", "", "#ffffff", "", "", "", color_to=color_to)
    assert not result.is_successful


def test_When_GradientStartsTransparent_Expect_Failure():
    result = FitToSize.from_strings_result("100", "100", "solid", "", "#ffffff80", "", "", "", color_to="#000000")
    assert not result.is_successful


def test_When_GradientAngleIsOutOfRange_Expect_Folded():
    fit = FitToSize.from_strings_result(
        "100", "100", "solid", "", "#ffffff", "", "", "", color_to="#000000", gradient_angle="-90"
    ).value
    assert fit.background.gradient_angle == 270


def test_When_NoGradientIsGiven_Expect_DefaultsAndPlainBackground():
    fit = FitToSize.from_strings_result("100", "100", "solid", "", "#ffffff", "", "", "").value
    assert fit.background.color_to is None and fit.background.tint_color_to is None
    assert fit.background.is_plain


def test_When_PreviewHasGradients_Expect_EchoedForTheSavedFit():
    result = preview({"fit_color_to": "#000000", "fit_gradient_angle": "135", "fit_tint": "0.3",
                      "fit_tint_color": "#ff0000", "fit_tint_color_to": "#00ff00", "fit_tint_angle": "90"})
    background = result.value[0]["fit"]["background"]
    assert background["colorTo"] == "#000000" and background["gradientAngle"] == 135
    assert background["tint"] == {"color": "#ff0000", "opacity": 0.3, "colorTo": "#00ff00", "angle": 90}


# --- layer list --------------------------------------------------------------

ASSET = "A" * 22


def test_When_LayersAreGiven_Expect_ParsedInOrder():
    parsed = parse_layers(layers(
        {"type": "text", "text": "Title"},
        image_layer(ASSET, x=0.2, width=0.5, height=0.4, rotation=370, opacity=0.5),
        {"type": "text", "text": "Mark", "align": "right"},
    ))
    assert parsed.is_successful, parsed.error
    first, picture, last = parsed.value
    assert isinstance(first, TextSpec) and first.text == "Title"
    assert picture == ImageLayer(ASSET, x=0.2, y=0.5, width=0.5, height=0.4, rotation=10, opacity=0.5)
    assert last.align == "right"


def test_When_LayersAreInvisible_Expect_Dropped():
    parsed = parse_layers(layers({"type": "text", "text": "  "}, image_layer(ASSET, opacity=0)))
    assert parsed.value == ()


def test_When_LayerValuesAreExtreme_Expect_Clamped():
    picture = parse_layers(layers(image_layer(ASSET, x=-9, y=9, width=99, height=0))).value[0]
    assert (picture.x, picture.y, picture.width, picture.height) == (-1.0, 2.0, 10.0, 0.005)


@pytest.mark.parametrize(
    "value",
    [
        "{}",
        "not json",
        layers({"type": "video"}),
        layers("text"),
        layers(image_layer("../../etc/passwd")),
        layers(image_layer("short")),
        layers(image_layer(ASSET, x="1")),
        layers(image_layer(ASSET, opacity=True)),
        layers({"type": "text", "text": "x" * 201}),
        layers({"type": "text", "text": "x", "align": "justify"}),
        layers(*[{"type": "text", "text": "t"}] * (MAX_TEXT_LAYERS + 1)),
        layers(*[image_layer(ASSET)] * (MAX_IMAGE_LAYERS + 1)),
        "[" + " " * 20000 + "]",
    ],
)
def test_When_LayersAreInvalid_Expect_Failure(value):
    assert not parse_layers(value).is_successful


def test_When_TheMaximumOfLayersIsUsed_Expect_Accepted():
    items = [{"type": "text", "text": "t"}] * MAX_TEXT_LAYERS + [image_layer(ASSET)] * MAX_IMAGE_LAYERS
    assert len(parse_layers(layers(*items)).value) == MAX_TEXT_LAYERS + MAX_IMAGE_LAYERS


# --- drawing layers ----------------------------------------------------------

def draw(fit_layers, size=(100, 100), base=None):
    fit = FitToSize(*size, FitToSize.from_strings_result("1", "1", "solid", "", "", "", "", "").value.mode,
                    color="#ffffff", layers=tuple(fit_layers))
    return ImageResizer.fit_image(base or Image.new("RGB", (4, 4), WHITE), fit).convert("RGBA")


def picture_layer(color, **fields):
    image = color if isinstance(color, Image.Image) else Image.new("RGB", (10, 10), color)
    return ImageLayer(ASSET, image=image, **fields)


def test_When_LayersOverlap_Expect_LaterOnTop():
    out = draw([picture_layer(RED, width=0.5, height=0.5), picture_layer(BLUE, width=0.2, height=0.2)])
    assert out.getpixel((50, 50))[:3] == BLUE
    assert out.getpixel((30, 50))[:3] == RED
    assert out.getpixel((5, 5))[:3] == WHITE


def test_When_LayerIsAboveTheBaseImage_Expect_BaseUnderneath():
    out = draw([picture_layer(RED, x=0.9, y=0.9, width=0.2, height=0.2)], base=Image.new("RGB", (10, 10), GREEN))
    assert out.getpixel((95, 95))[:3] == RED
    assert out.getpixel((50, 50))[:3] == GREEN


def test_When_TextIsAboveAPicture_Expect_TextOnTop():
    text = TextSpec(text="W", size=0.5, color="#000000", shadow=False)
    pixels = np.asarray(draw([picture_layer(RED, width=0.8, height=0.8), text]))[20:80, 20:80, :3]
    assert (pixels[..., 0] < 40).sum() > 100
    below = np.asarray(draw([text, picture_layer(RED, width=0.8, height=0.8)]))[20:80, 20:80, :3]
    assert (below[..., 0] < 40).sum() == 0


def test_When_PictureHasAlpha_Expect_TransparentPartsShowWhatIsBelow():
    picture = Image.new("RGBA", (10, 10), (0, 0, 0, 0))
    picture.paste((255, 0, 0, 255), (0, 0, 5, 10))
    out = draw([picture_layer(picture, width=1, height=1)])
    assert out.getpixel((20, 50))[:3] == RED
    assert out.getpixel((80, 50))[:3] == WHITE


def test_When_LayerIsHalfTransparent_Expect_Blended():
    out = draw([picture_layer(BLACK, width=1, height=1, opacity=0.5)])
    assert abs(out.getpixel((50, 50))[0] - 128) <= 1


def test_When_LayerIsStretched_Expect_FreeAspect():
    out = draw([picture_layer(RED, width=0.8, height=0.1)])
    assert out.getpixel((15, 50))[:3] == RED
    assert out.getpixel((50, 30))[:3] == WHITE


def test_When_LayerIsTurned_Expect_TurnedAroundItsCentre():
    out = draw([picture_layer(RED, width=0.8, height=0.1, rotation=90)])
    assert out.getpixel((50, 15))[:3] == RED
    assert out.getpixel((15, 50))[:3] == WHITE


def test_When_LayerIsOffCanvas_Expect_JustTheBackground():
    out = draw([picture_layer(RED, x=-1, y=-1, width=0.2, height=0.2)])
    assert np.all(np.asarray(out)[..., :3] == 255)


def test_When_OutputIsTransparent_Expect_LayerAlphaKept():
    fit = FitToSize.from_strings_result("50", "50", "transparent", "", "", "", "", "").value
    from dataclasses import replace

    fit = replace(fit, layers=(picture_layer(Image.new("RGBA", (10, 10), (255, 0, 0, 128)), width=1, height=1),))
    out = ImageResizer.fit_image(Image.new("RGBA", (4, 4), (0, 0, 0, 0)), fit)
    assert out.mode == "RGBA"
    assert out.getpixel((2, 2))[3] == 128


# --- session store -----------------------------------------------------------

@pytest.fixture
def store(tmp_path):
    return EditorAssetStore(str(tmp_path))


def test_When_PictureIsStored_Expect_SessionFolderWithOriginalAndProxy(store, tmp_path):
    session, asset = store_picture(store, Image.new("RGBA", (3000, 1000), (255, 0, 0, 128)))
    folder = tmp_path / f"{SESSION_PREFIX}{session}"
    assert sorted(path.name for path in folder.iterdir()) == sorted(
        [f"{asset.asset_id}.src", f"{asset.asset_id}.proxy.png"]
    )
    assert (asset.width, asset.height) == (3000, 1000)
    with Image.open(folder / f"{asset.asset_id}.proxy.png") as proxy:
        assert max(proxy.size) == PROXY_MAX_SIDE and proxy.mode == "RGBA"
    assert oct(folder.stat().st_mode & 0o777) == "0o700"


def test_When_SessionIsReused_Expect_SameFolder(store, tmp_path):
    session, first = store_picture(store, Image.new("RGB", (4, 4), RED))
    again, second = store_picture(store, Image.new("RGB", (4, 4), BLUE), session)
    assert again == session and first.asset_id != second.asset_id
    assert len(list(tmp_path.iterdir())) == 1


def test_When_TokensAreCreated_Expect_UnguessableAndDistinct(store):
    sessions = {store_picture(store, Image.new("RGB", (2, 2)))[0] for _ in range(20)}
    assert len(sessions) == 20
    assert all(len(token) == 32 for token in sessions)


@pytest.mark.parametrize(
    "session",
    ["", "../" * 5 + "etc", "a" * 31, "a" * 33, "a" * 31 + "/", "a" * 31 + ".", None, 42],
)
def test_When_SessionTokenIsInvalid_Expect_Expired(store, session):
    with store.open(session) as opened:
        assert not opened.is_successful and opened.error == EXPIRED_ERROR


def test_When_SessionDoesNotExist_Expect_ExpiredInsteadOfCreated(store, tmp_path):
    result = store.add("b" * 32, upload(Image.new("RGB", (2, 2))))
    assert not result.is_successful and result.error == EXPIRED_ERROR
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize("asset", ["../x", "a" * 21, "", None, "a" * 21 + "/"])
def test_When_AssetIdIsInvalid_Expect_Refused(store, asset):
    session, _ = store_picture(store, Image.new("RGB", (2, 2)))
    with store.open(session) as opened:
        assert not opened.value.load(asset, True).is_successful


def test_When_SessionFolderIsASymlink_Expect_Refused(store, tmp_path):
    session, _ = store_picture(store, Image.new("RGB", (2, 2)))
    link = "c" * 32
    os.symlink(tmp_path / f"{SESSION_PREFIX}{session}", tmp_path / f"{SESSION_PREFIX}{link}")
    with store.open(link) as opened:
        assert not opened.is_successful


def test_When_UploadIsNotAPicture_Expect_RejectedAndNothingStored(store, tmp_path):
    for data in (b"not an image", b"<svg xmlns='http://www.w3.org/2000/svg'/>", b"%PDF-1.4"):
        result = store.add(None, FileStorage(stream=BytesIO(data), filename="x.png"))
        assert not result.is_successful
    assert list(tmp_path.iterdir()) == []


def test_When_UploadIsTooLarge_Expect_Rejected(store, monkeypatch):
    from backend.image_converter.infrastructure import editor_asset_store

    monkeypatch.setattr(editor_asset_store, "max_upload_bytes", lambda: 100)
    result = store.add(None, upload(Image.effect_noise((64, 64), 50)))
    assert not result.is_successful and "too large" in result.error


def test_When_SessionIsFull_Expect_Rejected(store):
    session, _ = store_picture(store, Image.new("RGB", (2, 2)))
    for _ in range(MAX_ASSETS_PER_SESSION - 1):
        store_picture(store, Image.new("RGB", (2, 2)), session)
    result = store.add(session, upload(Image.new("RGB", (2, 2))))
    assert result.error == SESSION_FULL_ERROR


# --- previews with session pictures -------------------------------------------

def test_When_PreviewUsesSessionPictures_Expect_LayerAndBackgroundDrawn(store):
    session, background = store_picture(store, Image.new("RGB", (40, 20), GREEN))
    _, layer = store_picture(store, Image.new("RGB", (10, 10), RED), session)
    result = preview(
        {
            "fit_mode": "image",
            "fit_scale": "0.01",
            "fit_session": session,
            "fit_background_asset": background.asset_id,
            "fit_layers": layers(image_layer(layer.asset_id, x=0.1, y=0.5, width=0.1, height=0.2)),
        },
        assets=store,
    )
    out = decoded(result)
    assert out.getpixel((20, 50))[:3] == RED
    assert out.getpixel((150, 50))[:3] == GREEN
    assert result.value[0]["fit"]["layers"][0]["asset"] == layer.asset_id


def test_When_PreviewIsScaled_Expect_ProxyAndExportOriginal(store, monkeypatch):
    big = Image.new("RGB", (4000, 100), RED)
    big.paste(BLUE, (3999, 0, 4000, 100))
    session, asset = store_picture(store, big)
    loads = []
    from backend.image_converter.infrastructure.editor_asset_store import EditorSession

    original = EditorSession.load
    monkeypatch.setattr(EditorSession, "load", lambda self, a, full: loads.append(full) or original(self, a, full))
    form = {"fit_width": "4096", "fit_height": "1024", "fit_session": session,
            "fit_layers": layers(image_layer(asset.asset_id))}
    assert preview(form, assets=store, full_size=False).is_successful
    assert preview(form, assets=store, full_size=True).is_successful
    assert loads == [False, True]


def test_When_PresetPreviewIsRendered_Expect_SameAsTheExport(store):
    session, asset = store_picture(store, Image.effect_noise((3000, 3000), 80).convert("RGB"))
    form = {"fit_session": session, "fit_layers": layers(image_layer(asset.asset_id, width=0.7, height=0.9, rotation=12))}
    shown = decoded(preview(form, assets=store, full_size=False))
    exported = decoded(preview(form, assets=store, full_size=True))
    assert np.array_equal(np.asarray(shown), np.asarray(exported))


def test_When_SessionIsGone_Expect_ExpiredSoTheEditorUploadsAgain(store):
    session, asset = store_picture(store, Image.new("RGB", (2, 2)))
    store.remove_session(session)
    result = preview({"fit_session": session, "fit_layers": layers(image_layer(asset.asset_id))}, assets=store)
    assert result.error == EXPIRED_ERROR


def test_When_AssetIsMissing_Expect_Expired(store):
    session, _ = store_picture(store, Image.new("RGB", (2, 2)))
    result = preview({"fit_session": session, "fit_layers": layers(image_layer("Z" * 22))}, assets=store)
    assert result.error == EXPIRED_ERROR


def test_When_AnotherUsersAssetIsUsed_Expect_Refused(store):
    session_a, asset_a = store_picture(store, Image.new("RGB", (2, 2), RED))
    session_b, _ = store_picture(store, Image.new("RGB", (2, 2), BLUE))
    result = preview({"fit_session": session_b, "fit_layers": layers(image_layer(asset_a.asset_id))}, assets=store)
    assert not result.is_successful
    background = preview({"fit_mode": "image", "fit_session": session_b,
                          "fit_background_asset": asset_a.asset_id}, assets=store)
    assert not background.is_successful


def test_When_LayersNeedASessionButNoneIsGiven_Expect_Failure(store):
    result = preview({"fit_layers": layers(image_layer(ASSET))}, assets=store)
    assert not result.is_successful


def test_When_LegacyBackgroundUploadIsUsed_Expect_StillWorks():
    result = preview({"fit_mode": "image", "fit_scale": "0.01"},
                     background=upload(Image.new("RGB", (8, 8), GREEN)))
    assert decoded(result).getpixel((150, 50))[:3] == GREEN


def test_When_ManyUsersRenderTheirOwnLayersAtOnce_Expect_NoMixing(store):
    colours = [(index * 20, 255 - index * 20, (index * 57) % 256) for index in range(10)]
    sessions = [store_picture(store, Image.new("RGB", (8, 8), colour)) for colour in colours]

    def render(index):
        session, asset = sessions[index]
        form = {"fit_session": session,
                "fit_layers": layers(image_layer(asset.asset_id, width=1, height=1))}
        return decoded(preview(form, assets=store)).getpixel((100, 50))[:3]

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(render, [index % 10 for index in range(40)]))
    assert results == [colours[index % 10] for index in range(40)]


def test_When_ManyUsersUploadAtOnce_Expect_SeparateSessions(store, tmp_path):
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: store_picture(store, Image.new("RGB", (4, 4))), range(16)))
    assert len({session for session, _ in results}) == 16
    assert len(list(tmp_path.iterdir())) == 16


# --- cleanup and privacy -----------------------------------------------------

def age(path, seconds):
    past = time.time() - seconds
    for item in [path, *path.iterdir()]:
        os.utime(item, (past, past))


@pytest.mark.skipif(job_folder_lock.fcntl is None, reason="needs POSIX flock")
def test_When_SessionIsInUse_Expect_CleanupKeepsIt(store, tmp_path):
    session, asset = store_picture(store, Image.new("RGB", (2, 2)))
    folder = tmp_path / f"{SESSION_PREFIX}{session}"
    cleanup = CleanupService(str(tmp_path), expiration_time=60, logger=_Logger())
    with store.open(session) as opened:
        age(folder, 3600)
        cleanup.cleanup_temp_folders()
        cleanup.cleanup_temp_folders(force=True)
        assert folder.is_dir()
        assert opened.value.load(asset.asset_id, True).is_successful


def test_When_SessionIsUsed_Expect_ExpiryStartsAgain(store, tmp_path):
    session, _ = store_picture(store, Image.new("RGB", (2, 2)))
    folder = tmp_path / f"{SESSION_PREFIX}{session}"
    age(folder, 3600)
    with store.open(session):
        pass
    CleanupService(str(tmp_path), expiration_time=60, logger=_Logger()).cleanup_temp_folders()
    assert folder.is_dir()


def test_When_SessionIsIdle_Expect_RemovedByTheUsualCleanup(store, tmp_path):
    session, _ = store_picture(store, Image.new("RGB", (2, 2)))
    folder = tmp_path / f"{SESSION_PREFIX}{session}"
    age(folder, 3600)
    CleanupService(str(tmp_path), expiration_time=60, logger=_Logger()).cleanup_temp_folders()
    assert not folder.exists()


@pytest.mark.skipif(job_folder_lock.fcntl is None, reason="needs POSIX flock")
def test_When_CleanupRunsDuringRenders_Expect_NoActiveSessionLost(store, tmp_path):
    sessions = [store_picture(store, Image.new("RGB", (8, 8), RED)) for _ in range(4)]
    cleanup = CleanupService(str(tmp_path), expiration_time=0, logger=_Logger())
    stop = threading.Event()

    def sweep():
        while not stop.is_set():
            cleanup.cleanup_temp_folders()

    sweeper = threading.Thread(target=sweep)
    sweeper.start()
    try:
        for _ in range(5):
            for session, asset in sessions:
                with store.open(session) as opened:
                    if not opened.is_successful:
                        continue  # removed between two uses: the editor uploads again
                    assert opened.value.load(asset.asset_id, True).is_successful
    finally:
        stop.set()
        sweeper.join()


def test_When_StorageIsListedOrDownloaded_Expect_SessionsInvisible(store, tmp_path):
    session, asset = store_picture(store, Image.new("RGB", (2, 2)))
    folders = TemporaryFolderService(str(tmp_path), 3600, _Logger())
    assert folders.get_container_files().files == []
    name = f"{SESSION_PREFIX}{session}"
    assert folders.resolve_download_target(name, f"{asset.asset_id}.src") is None
    assert folders.resolve_download_target(str(tmp_path / name), f"{asset.asset_id}.proxy.png") is None
    assert folders.get_validated_path(name) is None


# --- the upload route ----------------------------------------------------------

@pytest.fixture
def client(store, monkeypatch):
    from backend.image_converter.presentation.web import routes

    monkeypatch.setattr(routes, "editor_assets", store)
    monkeypatch.setattr(routes.temp_folder_service, "cleanup", lambda force=False: None)
    app = Flask(__name__)
    app.register_blueprint(routes.api_blueprint, url_prefix="/api")
    return app.test_client()


def test_When_PictureIsPosted_Expect_SessionAndIdBack(client):
    response = client.post("/api/editor/assets", data={"file": (BytesIO(png_bytes(Image.new("RGB", (7, 5)))), "a.png")})
    assert response.status_code == 200
    body = response.get_json()
    assert len(body["session"]) == 32 and len(body["asset"]) == 22
    assert (body["width"], body["height"]) == (7, 5)
    assert response.headers["Cache-Control"] == "no-store"


def test_When_PostingToAnUnknownSession_Expect_Gone(client):
    response = client.post("/api/editor/assets", data={
        "session": "d" * 32, "file": (BytesIO(png_bytes(Image.new("RGB", (2, 2)))), "a.png")})
    assert response.status_code == 410


def test_When_SessionIsFull_Expect_ConflictSoTheEditorStartsANewOne(client, monkeypatch):
    from backend.image_converter.infrastructure import editor_asset_store

    first = client.post("/api/editor/assets", data={"file": (BytesIO(png_bytes(Image.new("RGB", (2, 2)))), "a.png")})
    monkeypatch.setattr(editor_asset_store, "MAX_ASSETS_PER_SESSION", 1)
    response = client.post("/api/editor/assets", data={
        "session": first.get_json()["session"], "file": (BytesIO(png_bytes(Image.new("RGB", (2, 2)))), "a.png")})
    assert response.status_code == 409


def test_When_PostingNoPicture_Expect_BadRequest(client):
    assert client.post("/api/editor/assets", data={}).status_code == 400


def test_When_FitUsesAnExpiredSession_Expect_Gone(client):
    response = client.post("/api/crop/fit", data={
        "file": (BytesIO(png_bytes(Image.new("RGB", (4, 4)))), "p.png"),
        "fit_width": "10", "fit_height": "10", "fit_mode": "solid", "fit_color": "#ffffff",
        "fit_session": "e" * 32, "fit_layers": layers(image_layer(ASSET)),
    })
    assert response.status_code == 410


def test_When_LayerIsTiltedClockwise_Expect_SameAsTurnedWithPilAndSmoothEdges():
    # A wide red bar turned 20° clockwise about its centre: the right end goes down.
    out = draw([picture_layer(RED, width=0.6, height=0.1, rotation=20)], size=(200, 200))
    reference = Image.new("RGBA", (200, 200), WHITE + (255,))
    reference.paste(RED, (40, 90, 160, 110))
    reference = reference.rotate(-20, resample=Image.Resampling.BICUBIC, center=(100, 100), fillcolor=WHITE)
    assert np.abs(np.asarray(out, dtype=int) - np.asarray(reference, dtype=int))[..., :3].mean() < 2
    assert out.getpixel((150, 118))[:3] == RED and out.getpixel((50, 82))[:3] == RED
    assert out.getpixel((50, 118))[:3] == WHITE
    greens = {out.getpixel((x, y))[1] for x in range(40, 160) for y in range(70, 130)}
    assert len(greens) > 20  # blended edge pixels


def test_When_TextLayerIsTilted_Expect_ItIsDrawnTurned():
    straight = draw([TextSpec(text="HHHH", size=0.2, color="#000000")], size=(200, 200))
    tilted = draw([TextSpec(text="HHHH", size=0.2, color="#000000", rotation=-10)], size=(200, 200))
    assert np.abs(np.asarray(straight, dtype=int) - np.asarray(tilted, dtype=int)).mean() > 1


def test_When_LayersAreSent_Expect_TextRotationParsedAndEchoed():
    parsed = parse_layers(json.dumps([{"type": "text", "text": "Hi", "rotation": 20}])).value
    assert parsed[0].rotation == 20
    assert layers_json(parsed)[0]["rotation"] == 20
    straight = parse_layers(json.dumps([{"type": "text", "text": "Hi"}])).value
    assert "rotation" not in layers_json(straight)[0]
