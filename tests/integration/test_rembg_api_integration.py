import io
import json
import os
import shutil

import pytest
from PIL import Image

from backend.image_converter.presentation.web.server import app
import backend.image_converter.core.factory.rembg_png_converter as rembg_module


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_rembg_model_endpoint_uses_config_value(client, monkeypatch, tmp_path):
    cfg_path = tmp_path / "rembg.json"
    cfg_path.write_text(json.dumps({"model_name": "custom-net"}), encoding="utf-8")
    monkeypatch.setenv("REMBG_CONFIG_PATH", str(cfg_path))

    response = client.get("/api/rembg_model")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["model_name"] == "custom-net"


def test_rembg_api_returns_png_with_transparency(client, monkeypatch):
    sample_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "..",
        "sample-images",
        "pexels-pealdesign-28594392.jpg",
    )
    with open(sample_path, "rb") as f:
        image_data = f.read()

    def fake_new_session(model_name: str):
        return {"model": model_name}

    def fake_remove(data, session, post_process_mask, alpha_matting):
        assert data == image_data
        assert post_process_mask is True
        assert alpha_matting is False
        buffer = io.BytesIO()
        img = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
        img.putpixel((5, 5), (255, 0, 0, 255))
        img.save(buffer, format="PNG")
        return buffer.getvalue()

    import sys
    from unittest.mock import MagicMock
    mock_rembg = MagicMock()
    mock_rembg.new_session = fake_new_session
    mock_rembg.remove = fake_remove
    monkeypatch.setitem(sys.modules, "rembg", mock_rembg)

    data = {
        "files[]": (io.BytesIO(image_data), "input.jpg"),
        "format": "png",
        "use_rembg": "true",
    }

    response = client.post("/api/compress", data=data, content_type="multipart/form-data")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["status"] == "ok"
    assert len(payload["converted_files"]) == 1

    dest_folder = payload["dest_folder"]
    out_path = os.path.join(dest_folder, payload["converted_files"][0])
    try:
        assert os.path.exists(out_path)
        with Image.open(out_path) as out_img:
            assert out_img.format.upper() == "PNG"
            assert "A" in out_img.mode
            assert out_img.getpixel((0, 0))[3] == 0
    finally:
        shutil.rmtree(dest_folder, ignore_errors=True)
