"""The upload limit: one setting (app.json or MAX_UPLOAD_SIZE_MB) for every upload.

The editor pictures (background, picture layers) use the same limit as the
normal uploads, so a big PSD or photo that converts also works in the editor.
"""

from io import BytesIO

import pytest
from flask import Flask, request
from PIL import Image
from werkzeug.datastructures import FileStorage

from backend.image_converter.config import settings
from backend.image_converter.domain.units import BYTES_PER_MEBIBYTE
from backend.image_converter.infrastructure.editor_asset_store import (
    EditorAssetStore,
    max_upload_bytes,
)
from backend.image_converter.presentation.web.services.fit_preview_service import (
    FitPreviewService,
)

DEFAULT_MEBIBYTES = 40960


@pytest.fixture(autouse=True)
def fresh_settings(monkeypatch):
    monkeypatch.delenv("MAX_UPLOAD_SIZE_MB", raising=False)
    settings.reset_cache()
    yield
    settings.reset_cache()


def use_limit(monkeypatch, value: str):
    monkeypatch.setenv("MAX_UPLOAD_SIZE_MB", value)
    settings.reset_cache()


def bmp(width: int, height: int) -> bytes:
    """An uncompressed picture, so its file size is known: about width * height * 3 bytes."""
    buffer = BytesIO()
    Image.new("RGB", (width, height), (30, 120, 200)).save(buffer, format="BMP")
    return buffer.getvalue()


def test_When_NothingIsSet_Expect_TheShippedDefaultOf40GiB():
    assert settings.get().uploads.max_file_size_mebibytes == DEFAULT_MEBIBYTES
    assert max_upload_bytes() == DEFAULT_MEBIBYTES * BYTES_PER_MEBIBYTE


def test_When_EnvIsSet_Expect_ItWinsOverAppJson(monkeypatch):
    use_limit(monkeypatch, " 512 ")
    assert settings.get().uploads.max_file_size_mebibytes == 512
    assert max_upload_bytes() == 512 * BYTES_PER_MEBIBYTE


def test_When_EnvIsEmpty_Expect_AppJsonValue(monkeypatch):
    use_limit(monkeypatch, "")
    assert settings.get().uploads.max_file_size_mebibytes == DEFAULT_MEBIBYTES


@pytest.mark.parametrize("value", ["abc", "0", "-5", "1.5", "10GB"])
def test_When_EnvIsInvalid_Expect_ServerRefusesToStart(monkeypatch, value):
    use_limit(monkeypatch, value)
    with pytest.raises(settings.ConfigError, match="MAX_UPLOAD_SIZE_MB"):
        settings.get()


def test_When_PictureIsLargerThanTheOld25MBCap_Expect_Stored(tmp_path):
    data = bmp(3200, 3000)  # about 28.8 MB
    assert len(data) > 25 * BYTES_PER_MEBIBYTE
    result = EditorAssetStore(str(tmp_path)).add(None, FileStorage(stream=BytesIO(data), filename="big.bmp"))
    assert result.is_successful, result.error
    session, asset = result.value
    assert (asset.width, asset.height) == (3200, 3000)
    folder = tmp_path / f"source_editor_{session}"
    assert (folder / f"{asset.asset_id}.src").read_bytes() == data
    # Previews use the small proxy, never the big original.
    with Image.open(folder / f"{asset.asset_id}.proxy.png") as proxy:
        assert max(proxy.size) <= 2048


def test_When_PictureIsAboveTheConfiguredLimit_Expect_RejectedWithTheLimit(monkeypatch, tmp_path):
    use_limit(monkeypatch, "1")
    store = EditorAssetStore(str(tmp_path))
    result = store.add(None, FileStorage(stream=BytesIO(bmp(700, 600)), filename="big.bmp"))
    assert not result.is_successful
    assert "too large" in result.error and "1 MB" in result.error
    # Nothing is left behind, not even a partial file or an empty session.
    assert list(tmp_path.iterdir()) == []
    # Just under the limit is fine.
    assert store.add(None, FileStorage(stream=BytesIO(bmp(500, 600)), filename="ok.bmp")).is_successful


def test_When_InlineBackgroundIsAboveTheLimit_Expect_Rejected(monkeypatch):
    use_limit(monkeypatch, "1")
    bitmap = BytesIO()
    Image.new("RGB", (40, 20)).save(bitmap, format="PNG")
    bitmap.seek(0)
    result = FitPreviewService().build(
        FileStorage(stream=bitmap, filename="photo.png"),
        {"fit_width": "40", "fit_height": "20", "fit_mode": "image"},
        background=FileStorage(stream=BytesIO(bmp(700, 600)), filename="bg.bmp"),
    )
    assert not result.is_successful and "1 MB" in result.error


def test_When_SessionHoldsMoreThanTheOld200MBTotal_Expect_NoTotalCapBelowTheLimit(monkeypatch, tmp_path):
    """A session is limited by its picture count only, never by a total below the upload limit."""
    from backend.image_converter.infrastructure import editor_asset_store

    assert not hasattr(editor_asset_store, "MAX_SESSION_BYTES")
    assert not hasattr(editor_asset_store, "MAX_ASSET_BYTES")


def test_RuntimeConfig_Expect_TheLimitForTheEditorMessages(monkeypatch):
    from backend.image_converter.presentation.web.static_routes import static_blueprint

    use_limit(monkeypatch, "300")
    app = Flask(__name__)
    app.register_blueprint(static_blueprint)
    body = app.test_client().get("/config/runtime.json").get_json()
    assert body["MAX_UPLOAD_SIZE_MB"] == "300"


def test_When_RequestIsAboveTheLimit_Expect_413WithTheLimitInTheAnswer(monkeypatch):
    use_limit(monkeypatch, "1")
    from backend.image_converter.presentation.web.error_handlers import handle_request_entity_too_large

    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = settings.get().uploads.max_file_size_bytes
    app.register_error_handler(413, handle_request_entity_too_large)

    @app.route("/upload", methods=["POST"])
    def upload():
        return {"files": len(request.files)}

    big = BytesIO(b"\0" * (2 * BYTES_PER_MEBIBYTE))
    response = app.test_client().post("/upload", data={"files[]": (big, "big.png")})

    assert response.status_code == 413
    body = response.get_json()
    assert body["error"] == "Payload Too Large"
    assert body["max_upload_size_mb"] == 1
    assert "1 MB" in body["message"]


class _CountingStream(BytesIO):
    """The request body as the server reads it; counts what was read."""

    def __init__(self, data: bytes):
        super().__init__(data)
        self.read_bytes = 0

    def read(self, size=-1):
        chunk = super().read(size)
        self.read_bytes += len(chunk)
        return chunk


def _refusing_app(monkeypatch, limit: str) -> Flask:
    use_limit(monkeypatch, limit)
    from backend.image_converter.presentation.web.error_handlers import handle_request_entity_too_large

    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = settings.get().uploads.max_file_size_bytes
    app.register_error_handler(413, handle_request_entity_too_large)

    @app.route("/upload", methods=["POST"])
    def upload():
        return {"files": len(request.files)}

    return app


def test_When_RequestIsAboveTheLimit_Expect_BodyReadBeforeTheAnswer(monkeypatch):
    # A server that answers and closes while the client is still sending makes
    # the client's system reset the connection: the client gets "EPIPE" or
    # "connection reset" instead of the 413. So the refused body is read first.
    app = _refusing_app(monkeypatch, "1")
    body = _CountingStream(b"\0" * (3 * BYTES_PER_MEBIBYTE))

    response = app.test_client().post(
        "/upload", input_stream=body, content_length=len(body.getvalue()),
        content_type="multipart/form-data; boundary=x",
    )

    assert response.status_code == 413
    assert body.read_bytes == len(body.getvalue())


def test_When_RefusedBodyIsHuge_Expect_AnsweredWithoutReadingIt(monkeypatch):
    from backend.image_converter.presentation.web import error_handlers

    monkeypatch.setattr(error_handlers, "REFUSED_BODY_READ_MAX_BYTES", 2 * BYTES_PER_MEBIBYTE)
    app = _refusing_app(monkeypatch, "1")
    body = _CountingStream(b"\0" * (3 * BYTES_PER_MEBIBYTE))

    response = app.test_client().post(
        "/upload", input_stream=body, content_length=len(body.getvalue()),
        content_type="multipart/form-data; boundary=x",
    )

    assert response.status_code == 413
    assert body.read_bytes == 0
