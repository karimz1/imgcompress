"""Live preview of one small region: limits, the busy rule, and the HTTP contract.

Uses a fake 4x model, so no model file or onnxruntime work is needed.
"""

from io import BytesIO

import numpy as np
import pytest
from flask import Flask
from PIL import Image

from backend.image_converter.domain.upscaling import UpscaleModel
from backend.image_converter.infrastructure import ai_upscaler
from backend.image_converter.infrastructure.ai_upscaler import (
    PREVIEW_MAX_SIDE,
    AiUpscaler,
    UpscalerBusy,
)
from tests.unit.dummy_logger import DummyLogger


def _nearest_4x(tile: np.ndarray) -> np.ndarray:
    return tile.repeat(4, axis=2).repeat(4, axis=3)


def _png(size, colour=(200, 40, 40), mode="RGB") -> bytes:
    buffer = BytesIO()
    Image.new(mode, size, colour).save(buffer, format="PNG")
    return buffer.getvalue()


def _upscaler(calls=None):
    def run(tile):
        if calls is not None:
            calls.append(tile.shape)
        return _nearest_4x(tile)

    return AiUpscaler(DummyLogger(), threads=1, run_model=run)


def test_When_PreviewingRegionWithBorder_Expect_OnlyInnerRegionAt4x():
    calls = []
    png = _upscaler(calls).preview(_png((96, 80)), UpscaleModel.GENERAL, inner=(16, 8, 64, 64))
    with Image.open(BytesIO(png)) as result:
        assert result.format == "PNG"
        assert result.size == (256, 256)
    # The whole tile, border included, goes through the model once.
    assert calls == [(1, 3, 80, 96)]


def test_When_PreviewingWithoutInnerBox_Expect_WholeTileAt4x():
    png = _upscaler().preview(_png((40, 30)), UpscaleModel.GENERAL)
    with Image.open(BytesIO(png)) as result:
        assert result.size == (160, 120)


def test_When_PreviewTileTooLarge_Expect_RejectedBeforeModelRuns():
    calls = []
    with pytest.raises(ValueError, match="at most"):
        _upscaler(calls).preview(_png((PREVIEW_MAX_SIDE + 1, 10)), UpscaleModel.GENERAL)
    assert calls == []


@pytest.mark.parametrize("inner", [(0, 0, 0, 10), (-1, 0, 10, 10), (5, 5, 40, 10)])
def test_When_InnerBoxOutsideTile_Expect_Rejected(inner):
    with pytest.raises(ValueError, match="region"):
        _upscaler().preview(_png((40, 30)), UpscaleModel.GENERAL, inner=inner)


def test_When_PreviewNotAnImage_Expect_Rejected():
    with pytest.raises(ValueError, match="image"):
        _upscaler().preview(b"not an image", UpscaleModel.GENERAL)


def test_When_PreviewHasAlpha_Expect_TransparencyKept():
    png = _upscaler().preview(_png((20, 20), (0, 0, 0, 0), mode="RGBA"), UpscaleModel.GENERAL)
    with Image.open(BytesIO(png)) as result:
        assert result.mode == "RGBA"
        assert result.getpixel((5, 5))[3] == 0


def test_When_UpscalerBusy_Expect_PreviewRefusedWithoutWaiting():
    calls = []
    upscaler = _upscaler(calls)
    with ai_upscaler._inference_lock:
        with pytest.raises(UpscalerBusy):
            upscaler.preview(_png((20, 20)), UpscaleModel.GENERAL)
    assert calls == []
    # Free again: the next preview runs.
    upscaler.preview(_png((20, 20)), UpscaleModel.GENERAL)
    assert len(calls) == 1


# --- HTTP contract -----------------------------------------------------------

@pytest.fixture
def client(monkeypatch):
    from backend.image_converter.presentation.web import routes

    monkeypatch.setattr(routes, "upscaler", _upscaler())
    app = Flask(__name__)
    app.register_blueprint(routes.api_blueprint, url_prefix="/api")
    return app.test_client()


def _post(client, data):
    return client.post("/api/upscale/preview", data=data, content_type="multipart/form-data")


def test_When_PostingPreview_Expect_PngNotCached(client):
    response = _post(client, {
        "file": (BytesIO(_png((48, 48))), "tile.png"),
        "upscale_model": "general-denoise-low",
        "inner": "8,8,32,32",
    })
    assert response.status_code == 200
    assert response.mimetype == "image/png"
    assert response.headers["Cache-Control"] == "no-store"
    with Image.open(BytesIO(response.data)) as result:
        assert result.size == (128, 128)


@pytest.mark.parametrize("data, message", [
    ({}, "No image"),
    ({"upscale_model": "nope"}, "Unsupported upscale model"),
    ({"inner": "1,2,3"}, "region"),
])
def test_When_PreviewRequestInvalid_Expect_400(client, data, message):
    if data:
        data = {"file": (BytesIO(_png((20, 20))), "tile.png"), **data}
    response = _post(client, data)
    assert response.status_code == 400
    assert message in response.get_json()["error"]


def test_When_PreviewWhileBusy_Expect_503WithRetryAfter(client):
    with ai_upscaler._inference_lock:
        response = _post(client, {"file": (BytesIO(_png((20, 20))), "tile.png")})
    assert response.status_code == 503
    assert response.headers["Retry-After"] == "2"
    assert "busy" in response.get_json()["error"]
