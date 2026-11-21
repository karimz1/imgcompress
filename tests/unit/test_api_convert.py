"""POST /api/v1/convert: the synchronous call, e.g. a blog plugin posting one image."""

import io
import os
import zipfile

import pytest
from PIL import Image

from backend.image_converter.presentation.web import routes
from backend.image_converter.presentation.web.server import app


def _png(size=(64, 48)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, (220, 30, 30)).save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture
def client():
    return app.test_client()


def _post(client, files, **fields):
    data = {"files[]": [(io.BytesIO(raw), name) for name, raw in files], **fields}
    return client.post("/api/v1/convert", data=data, content_type="multipart/form-data")


def _converted_folders():
    return {e for e in os.listdir(routes.TEMP_DIR) if e.startswith(("converted_", "source_"))}


def test_When_OneImageIsSent_Expect_TheFileItselfAndNothingLeftBehind(client):
    before = _converted_folders()
    response = _post(client, [("photo.png", _png())], format="webp", quality="70", width="32")
    assert response.status_code == 200
    assert response.mimetype == "image/webp"
    assert "photo.webp" in response.headers["Content-Disposition"]
    assert response.headers["X-Converted-Count"] == "1"
    assert response.headers["X-Failed-Count"] == "0"
    with Image.open(io.BytesIO(response.data)) as img:
        assert img.format == "WEBP" and img.width == 32
    response.close()
    assert _converted_folders() == before


def test_When_FileFieldIsUsed_Expect_SameAsFilesArray(client):
    response = client.post("/api/v1/convert", data={"file": (io.BytesIO(_png()), "a.png"), "format": "jpeg"},
                           content_type="multipart/form-data")
    assert response.status_code == 200 and response.mimetype == "image/jpeg"


def test_When_SeveralImagesAreSent_Expect_OneZip(client):
    response = _post(client, [("a.png", _png()), ("b.png", _png())], format="png")
    assert response.status_code == 200 and response.mimetype == "application/zip"
    assert sorted(zipfile.ZipFile(io.BytesIO(response.data)).namelist()) == ["a.png", "b.png"]
    assert response.headers["X-Converted-Count"] == "2"


def test_When_OutputIsZip_Expect_ZipEvenForOneImage(client):
    response = _post(client, [("a.png", _png())], format="png", output="zip")
    assert zipfile.ZipFile(io.BytesIO(response.data)).namelist() == ["a.png"]


def test_When_OneOfTwoFails_Expect_TheGoodOneAndTheCount(client):
    response = _post(client, [("good.png", _png()), ("bad.png", b"not a picture")], format="png", output="zip")
    assert response.status_code == 200
    assert response.headers["X-Failed-Count"] == "1"
    assert zipfile.ZipFile(io.BytesIO(response.data)).namelist() == ["good.png"]


@pytest.mark.parametrize("fields, status, needle", [
    ({"quality": "0"}, 400, "'quality'"),
    ({"format": "gif"}, 400, "'format'"),
    ({"format": "pdf", "upscale": "2x"}, 400, "not available for PDF"),
    ({"webp_lossless": "true", "format": "webp", "target_size_kb": "10"}, 400, "Lossless WebP"),
    ({"upscale": "3x"}, 400, "upscale"),
])
def test_When_OptionsAreInvalid_Expect_400WithTheReason(client, fields, status, needle):
    before = _converted_folders()
    response = _post(client, [("a.png", _png())], **fields)
    assert response.status_code == status
    assert needle.lower() in response.get_json()["message"].lower()
    assert _converted_folders() == before


def test_When_NoFileOrUnsupportedFile_Expect_400And415(client):
    assert client.post("/api/v1/convert", data={"format": "png"}, content_type="multipart/form-data").status_code == 400
    response = _post(client, [("notes.txt", b"hello")])
    assert response.status_code == 415
    assert "notes.txt" in response.get_json()["message"]
