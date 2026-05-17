import io
from pathlib import Path

import pytest
from PIL import Image

from backend.image_converter.presentation.web.server import app


FIXTURE_DIR = (
    Path(__file__).resolve().parents[2]
    / "frontend"
    / "tests"
    / "e2e"
    / "fixtures"
    / "sample-images"
)


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


@pytest.mark.parametrize(
    ("filename", "expected_min_width", "expected_min_height"),
    [
        ("37443511_8499861.psd", 1000, 700),
        ("vecteezy_new-update-logo-template-illustration_5412356-0.eps", 1000, 700),
    ],
)
def test_crop_bitmap_endpoint_renders_backend_formats_as_png(
    client,
    filename,
    expected_min_width,
    expected_min_height,
):
    fixture_path = FIXTURE_DIR / filename

    with fixture_path.open("rb") as f:
        response = client.post(
            "/api/crop/bitmap",
            data={"file": (f, filename)},
            content_type="multipart/form-data",
        )

    assert response.status_code == 200
    assert response.content_type == "image/png"
    with Image.open(io.BytesIO(response.data)) as preview:
        assert preview.format == "PNG"
        assert preview.width >= expected_min_width
        assert preview.height >= expected_min_height


def test_crop_bitmap_endpoint_rejects_pdf_until_page_selection_exists(client):
    fixture_path = FIXTURE_DIR / "imgcompress_multipage_test.pdf"

    with fixture_path.open("rb") as f:
        response = client.post(
            "/api/crop/bitmap",
            data={"file": (f, fixture_path.name)},
            content_type="multipart/form-data",
        )

    assert response.status_code == 415
    payload = response.get_json()
    assert "not compatible" in payload["error"]


def test_crop_unsupported_formats_endpoint_includes_pdf(client):
    response = client.get("/api/crop_unsupported_formats")

    assert response.status_code == 200
    payload = response.get_json()
    assert ".pdf" in payload["unsupported_formats"]
