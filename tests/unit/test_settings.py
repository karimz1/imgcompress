import json

import pytest

from backend.image_converter.config import settings
from backend.image_converter.config.settings import ConfigError


VALID_CONFIG = {
    "temp_dir": "/tmp",
    "temp_expiration_seconds": 3600,
    "max_upload_bytes": 42949672960,
    "web": {"host": "0.0.0.0", "port": 5000, "workers": "auto"},
    "logging": {"backend_log_file": "/tmp/imgcompress-backend.log"},
    "crop_preview": {"max_attempts": 3},
    "features": {
        "storage_management_enabled": True,
        "show_logo": True,
        "dev_mode": False,
    },
    "rembg": {"model_name": "u2net"},
}


@pytest.fixture
def config_file(tmp_path, monkeypatch):
    def _write(data):
        path = tmp_path / "app.json"
        path.write_text(json.dumps(data), encoding="utf-8")
        monkeypatch.setattr(settings, "_CONFIG_PATH", path)
        settings.reset_cache()
        return path

    yield _write
    settings.reset_cache()


def test_validate_all_passes_for_valid_config(config_file):
    config_file(VALID_CONFIG)
    settings.validate_all()


def test_all_getters_return_typed_values(config_file):
    config_file(VALID_CONFIG)
    assert settings.temp_dir() == "/tmp"
    assert settings.temp_expiration_seconds() == 3600
    assert settings.max_upload_bytes() == 42949672960
    assert settings.web_host() == "0.0.0.0"
    assert settings.web_port() == 5000
    assert settings.web_workers() == "auto"
    assert settings.backend_log_file() == "/tmp/imgcompress-backend.log"
    assert settings.crop_preview_max_attempts() == 3
    assert settings.storage_management_enabled() is True
    assert settings.show_logo() is True
    assert settings.dev_mode() is False
    assert settings.rembg_model_name() == "u2net"


def test_web_workers_accepts_integer(config_file):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    cfg["web"]["workers"] = 4
    config_file(cfg)
    assert settings.web_workers() == 4


def test_missing_top_level_key_raises(config_file):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    del cfg["temp_dir"]
    config_file(cfg)
    with pytest.raises(ConfigError, match="missing required config key: temp_dir"):
        settings.temp_dir()


def test_missing_nested_key_raises(config_file):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    del cfg["web"]["port"]
    config_file(cfg)
    with pytest.raises(ConfigError, match="missing required config key: web.port"):
        settings.web_port()


def test_string_required_rejects_non_string(config_file):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    cfg["temp_dir"] = 123
    config_file(cfg)
    with pytest.raises(ConfigError, match="must be a non-empty string"):
        settings.temp_dir()


def test_string_required_rejects_blank(config_file):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    cfg["temp_dir"] = "   "
    config_file(cfg)
    with pytest.raises(ConfigError, match="must be a non-empty string"):
        settings.temp_dir()


def test_int_required_rejects_string(config_file):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    cfg["temp_expiration_seconds"] = "3600"
    config_file(cfg)
    with pytest.raises(ConfigError, match="must be an integer"):
        settings.temp_expiration_seconds()


def test_int_required_rejects_bool(config_file):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    cfg["temp_expiration_seconds"] = True
    config_file(cfg)
    with pytest.raises(ConfigError, match="must be an integer"):
        settings.temp_expiration_seconds()


def test_int_required_enforces_minimum(config_file):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    cfg["crop_preview"]["max_attempts"] = 0
    config_file(cfg)
    with pytest.raises(ConfigError, match=">= 1"):
        settings.crop_preview_max_attempts()


def test_web_port_enforces_upper_bound(config_file):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    cfg["web"]["port"] = 70000
    config_file(cfg)
    with pytest.raises(ConfigError, match="must be <= 65535"):
        settings.web_port()


def test_max_upload_bytes_enforces_floor(config_file):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    cfg["max_upload_bytes"] = 100
    config_file(cfg)
    with pytest.raises(ConfigError, match=">= 1024"):
        settings.max_upload_bytes()


def test_bool_required_rejects_string(config_file):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    cfg["features"]["dev_mode"] = "false"
    config_file(cfg)
    with pytest.raises(ConfigError, match="must be a boolean"):
        settings.dev_mode()


def test_int_or_auto_rejects_other_strings(config_file):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    cfg["web"]["workers"] = "many"
    config_file(cfg)
    with pytest.raises(ConfigError, match='must be an integer or "auto"'):
        settings.web_workers()


def test_int_or_auto_rejects_bool(config_file):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    cfg["web"]["workers"] = True
    config_file(cfg)
    with pytest.raises(ConfigError, match='must be an integer or "auto"'):
        settings.web_workers()


def test_validate_all_collects_every_error(config_file):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    del cfg["max_upload_bytes"]
    cfg["web"]["host"] = ""
    cfg["web"]["port"] = 99999
    cfg["features"]["dev_mode"] = "nope"
    config_file(cfg)
    with pytest.raises(ConfigError) as exc:
        settings.validate_all()
    message = str(exc.value)
    assert "missing required config key: max_upload_bytes" in message
    assert "config key 'web.host' must be a non-empty string" in message
    assert "config key 'web.port' must be <= 65535" in message
    assert "config key 'features.dev_mode' must be a boolean" in message


def test_missing_file_raises(tmp_path, monkeypatch):
    missing = tmp_path / "nope.json"
    monkeypatch.setattr(settings, "_CONFIG_PATH", missing)
    settings.reset_cache()
    with pytest.raises(ConfigError, match="not found"):
        settings.temp_dir()


def test_malformed_json_raises(tmp_path, monkeypatch):
    path = tmp_path / "app.json"
    path.write_text("{not json", encoding="utf-8")
    monkeypatch.setattr(settings, "_CONFIG_PATH", path)
    settings.reset_cache()
    with pytest.raises(ConfigError, match="not valid JSON"):
        settings.temp_dir()


def test_non_object_top_level_raises(tmp_path, monkeypatch):
    path = tmp_path / "app.json"
    path.write_text("[]", encoding="utf-8")
    monkeypatch.setattr(settings, "_CONFIG_PATH", path)
    settings.reset_cache()
    with pytest.raises(ConfigError, match="JSON object at the top level"):
        settings.temp_dir()


def test_shipped_app_json_is_valid():
    settings.reset_cache()
    try:
        settings.validate_all()
    finally:
        settings.reset_cache()
