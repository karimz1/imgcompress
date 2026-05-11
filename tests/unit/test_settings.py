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
    "crop_preview": {
        "max_attempts": 3,
        "unsupported_extensions": [".pdf", ".svg", ".raw"],
    },
    "storage": {"bytes_per_megabyte": 1048576},
    "features": {
        "storage_management_enabled": True,
        "show_logo": True,
        "dev_mode": False,
    },
    "rembg": {"model_name": "u2net"},
}


_FEATURE_ENV_VARS = ("DISABLE_LOGO", "DISABLE_STORAGE_MANAGEMENT", "DEV_MODE")


@pytest.fixture
def config_file(tmp_path, monkeypatch):
    for var in _FEATURE_ENV_VARS:
        monkeypatch.delenv(var, raising=False)

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
    assert settings.crop_preview_unsupported_extensions() == [".pdf", ".svg", ".raw"]
    assert settings.bytes_per_megabyte() == 1048576
    assert settings.storage_management_enabled() is True
    assert settings.show_logo() is True
    assert settings.dev_mode() is False
    assert settings.rembg_model_name() == "u2net"


def test_bytes_per_megabyte_rejects_zero(config_file):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    cfg["storage"]["bytes_per_megabyte"] = 0
    config_file(cfg)
    with pytest.raises(ConfigError, match=">= 1"):
        settings.bytes_per_megabyte()


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


def test_crop_preview_unsupported_extensions_missing_key_raises(config_file):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    del cfg["crop_preview"]["unsupported_extensions"]
    config_file(cfg)
    with pytest.raises(
        ConfigError,
        match="missing required config key: crop_preview.unsupported_extensions",
    ):
        settings.crop_preview_unsupported_extensions()


def test_crop_preview_unsupported_extensions_rejects_non_list(config_file):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    cfg["crop_preview"]["unsupported_extensions"] = ".pdf"
    config_file(cfg)
    with pytest.raises(ConfigError, match="must be a list"):
        settings.crop_preview_unsupported_extensions()


def test_crop_preview_unsupported_extensions_rejects_non_string_item(config_file):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    cfg["crop_preview"]["unsupported_extensions"] = [".pdf", True]
    config_file(cfg)
    with pytest.raises(ConfigError, match="non-empty strings"):
        settings.crop_preview_unsupported_extensions()


def test_crop_preview_unsupported_extensions_rejects_missing_dot(config_file):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    cfg["crop_preview"]["unsupported_extensions"] = ["pdf"]
    config_file(cfg)
    with pytest.raises(ConfigError, match="must start with"):
        settings.crop_preview_unsupported_extensions()


def test_crop_preview_unsupported_extensions_normalizes_values(config_file):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    cfg["crop_preview"]["unsupported_extensions"] = [" .PDF ", ".Svg"]
    config_file(cfg)
    assert settings.crop_preview_unsupported_extensions() == [".pdf", ".svg"]


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


@pytest.mark.parametrize("truthy", ["true", "TRUE", "1", "yes", "on"])
def test_disable_logo_env_overrides_json(config_file, monkeypatch, truthy):
    config_file(VALID_CONFIG)
    monkeypatch.setenv("DISABLE_LOGO", truthy)
    assert settings.show_logo() is False


@pytest.mark.parametrize("falsy", ["false", "FALSE", "0", "no", "off"])
def test_disable_logo_env_falsy_keeps_logo(config_file, monkeypatch, falsy):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    cfg["features"]["show_logo"] = False
    config_file(cfg)
    monkeypatch.setenv("DISABLE_LOGO", falsy)
    assert settings.show_logo() is True


def test_disable_storage_management_env_disables_feature(config_file, monkeypatch):
    config_file(VALID_CONFIG)
    monkeypatch.setenv("DISABLE_STORAGE_MANAGEMENT", "true")
    assert settings.storage_management_enabled() is False


def test_disable_storage_management_env_falsy_enables_feature(config_file, monkeypatch):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    cfg["features"]["storage_management_enabled"] = False
    config_file(cfg)
    monkeypatch.setenv("DISABLE_STORAGE_MANAGEMENT", "false")
    assert settings.storage_management_enabled() is True


def test_dev_mode_env_enables_dev_panel(config_file, monkeypatch):
    config_file(VALID_CONFIG)
    monkeypatch.setenv("DEV_MODE", "true")
    assert settings.dev_mode() is True


def test_dev_mode_env_falsy_disables_dev_panel(config_file, monkeypatch):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    cfg["features"]["dev_mode"] = True
    config_file(cfg)
    monkeypatch.setenv("DEV_MODE", "off")
    assert settings.dev_mode() is False


def test_env_override_falls_back_to_json_when_unset(config_file, monkeypatch):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    cfg["features"]["show_logo"] = False
    cfg["features"]["dev_mode"] = True
    cfg["features"]["storage_management_enabled"] = False
    config_file(cfg)
    monkeypatch.delenv("DISABLE_LOGO", raising=False)
    monkeypatch.delenv("DEV_MODE", raising=False)
    monkeypatch.delenv("DISABLE_STORAGE_MANAGEMENT", raising=False)
    assert settings.show_logo() is False
    assert settings.dev_mode() is True
    assert settings.storage_management_enabled() is False


@pytest.mark.parametrize(
    ("env_name", "getter"),
    [
        ("DISABLE_LOGO", settings.show_logo),
        ("DISABLE_STORAGE_MANAGEMENT", settings.storage_management_enabled),
        ("DEV_MODE", settings.dev_mode),
    ],
)
def test_env_override_rejects_garbage_value(config_file, monkeypatch, env_name, getter):
    config_file(VALID_CONFIG)
    monkeypatch.setenv(env_name, "maybe")
    with pytest.raises(ConfigError, match=env_name):
        getter()


@pytest.mark.parametrize(
    ("env_name", "getter", "expected"),
    [
        ("DISABLE_LOGO", settings.show_logo, True),
        ("DISABLE_STORAGE_MANAGEMENT", settings.storage_management_enabled, True),
        ("DEV_MODE", settings.dev_mode, False),
    ],
)
def test_env_override_empty_string_falls_back_to_json(
    config_file,
    monkeypatch,
    env_name,
    getter,
    expected,
):
    cfg = json.loads(json.dumps(VALID_CONFIG))
    config_file(cfg)
    monkeypatch.setenv(env_name, "")
    assert getter() is expected


def test_shipped_app_json_is_valid():
    settings.reset_cache()
    try:
        settings.validate_all()
    finally:
        settings.reset_cache()
