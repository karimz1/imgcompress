import pytest
from flask import Flask

from backend.image_converter.config import settings
from backend.image_converter.presentation.web.static_routes import static_blueprint


def _client(tmp_path):
    static_folder = tmp_path / "static_site"
    static_folder.mkdir()
    (static_folder / "index.html").write_text("<html>spa</html>")
    (static_folder / "favicon.ico").write_bytes(b"icon")
    (tmp_path / "secret.txt").write_text("do not serve me")

    app = Flask(__name__, static_folder=str(static_folder), static_url_path="/static")
    app.register_blueprint(static_blueprint, url_prefix="/")
    return app.test_client()


def test_serves_existing_file_from_static_folder(tmp_path):
    response = _client(tmp_path).get("/favicon.ico")

    assert response.status_code == 200
    assert response.data == b"icon"


def test_unknown_path_falls_back_to_index(tmp_path):
    response = _client(tmp_path).get("/settings")

    assert response.status_code == 200
    assert b"spa" in response.data


def test_encoded_traversal_does_not_escape_static_folder(tmp_path):
    response = _client(tmp_path).get("/%2e%2e/secret.txt")

    assert response.status_code == 200
    assert b"do not serve me" not in response.data
    assert b"spa" in response.data


def test_absolute_path_does_not_escape_static_folder(tmp_path):
    response = _client(tmp_path).get(f"/{tmp_path}/secret.txt")

    assert response.status_code == 200
    assert b"do not serve me" not in response.data
    assert b"spa" in response.data


def test_api_paths_are_never_served_from_the_static_folder(tmp_path):
    static_folder = tmp_path / "static_site"
    client = _client(tmp_path)
    (static_folder / "api").mkdir()
    (static_folder / "api" / "leak.txt").write_text("api namespace belongs to the api blueprint")

    response = client.get("/api/leak.txt")

    assert b"api namespace belongs to the api blueprint" not in response.data


@pytest.mark.parametrize(("env_value", "expected"), [(None, "false"), ("true", "true"), ("off", "false")])
def test_runtime_config_reports_whether_the_update_check_is_disabled(
    tmp_path, monkeypatch, env_value, expected
):
    if env_value is None:
        monkeypatch.delenv("DISABLE_UPDATE_CHECK", raising=False)
    else:
        monkeypatch.setenv("DISABLE_UPDATE_CHECK", env_value)
    settings.reset_cache()
    try:
        body = _client(tmp_path).get("/config/runtime.json").get_json()
    finally:
        settings.reset_cache()

    assert body["DISABLE_UPDATE_CHECK"] == expected
