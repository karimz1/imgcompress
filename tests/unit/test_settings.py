"""Unit tests for the typed `AppConfig` loader.

The loader is the *only* module that knows the JSON key paths and env-var
names — every other module reads typed attributes off `AppConfig`. These
tests therefore drive the loader directly with synthetic JSON and assert:

* every leaf type is checked (string non-empty, int range, bool, list, etc.);
* every problem is collected so the operator sees them all at once;
* feature flags honor whitelisted env overrides with the documented semantics;
* the shipped `app.json` validates cleanly.

The thin `settings` facade is exercised via `settings.get()` plus
`settings.reset_cache()` and a monkeypatched `_CONFIG_PATH`.
"""

import json
from pathlib import Path

import pytest

from backend.image_converter.config import settings
from backend.image_converter.config.app_config import AppConfig
from backend.image_converter.config.loader import ConfigError, load_from_file
from backend.image_converter.domain.units import BYTES_PER_MEBIBYTE
from backend.image_converter.domain.web_workers import WebWorkerCount


VALID_CONFIG = {
    "temporary_storage": {"directory": "/tmp", "max_age_seconds": 3600},
    "uploads": {"max_file_size_mebibytes": 40960},
    "web": {"host": "0.0.0.0", "port": 5000, "workers": "auto"},
    "logging": {"backend_log_file": "/tmp/imgcompress-backend.log"},
    "crop_preview": {
        "max_retry_attempts": 3,
        "unsupported_input_extensions": [".pdf", ".svg", ".raw"],
    },
    "formats": {"custom_pipeline_extensions": [".pdf", ".psd"]},
    "features": {
        "is_storage_management_enabled": True,
        "is_logo_enabled": True,
        "is_dev_mode_enabled": False,
    },
    "rembg": {"model_name": "u2net"},
}

_FEATURE_ENV_VARS = ("DISABLE_LOGO", "DISABLE_STORAGE_MANAGEMENT", "DEV_MODE")


@pytest.fixture
def config_file(tmp_path, monkeypatch):
    for name in _FEATURE_ENV_VARS:
        monkeypatch.delenv(name, raising=False)

    def _write(data) -> Path:
        path = tmp_path / "app.json"
        path.write_text(json.dumps(data), encoding="utf-8")
        settings.reset_cache(config_path=path)
        return path

    yield _write
    settings.reset_cache()


def _copy_config() -> dict:
    return json.loads(json.dumps(VALID_CONFIG))


def test_valid_config_loads_into_typed_app_config(config_file):
    config_file(VALID_CONFIG)

    config = settings.get()

    assert isinstance(config, AppConfig)
    assert config.temporary_storage.directory == "/tmp"
    assert config.temporary_storage.max_age_seconds == 3600
    assert config.uploads.max_file_size_mebibytes == 40960
    assert config.uploads.max_file_size_bytes == 40960 * BYTES_PER_MEBIBYTE
    assert config.web.host == "0.0.0.0"
    assert config.web.port == 5000
    assert isinstance(config.web.workers, WebWorkerCount)
    assert config.web.workers.is_auto is True
    assert config.logging.backend_log_file == "/tmp/imgcompress-backend.log"
    assert config.crop_preview.max_retry_attempts == 3
    assert config.crop_preview.unsupported_input_extensions == (".pdf", ".svg", ".raw")
    assert config.features.is_storage_management_enabled is True
    assert config.features.is_logo_enabled is True
    assert config.features.is_dev_mode_enabled is False
    assert config.rembg.model_name == "u2net"


def test_app_config_is_immutable(config_file):
    config_file(VALID_CONFIG)
    config = settings.get()

    with pytest.raises(Exception):  # FrozenInstanceError
        config.web = config.web  # type: ignore[misc]


def test_web_workers_accepts_explicit_integer(config_file):
    cfg = _copy_config()
    cfg["web"]["workers"] = 8
    config_file(cfg)

    workers = settings.get().web.workers

    assert workers.is_auto is False
    assert workers.resolve(fallback_when_auto=999) == 8


def test_web_workers_auto_resolves_via_fallback(config_file):
    config_file(VALID_CONFIG)
    workers = settings.get().web.workers

    assert workers.resolve(fallback_when_auto=4) == 4


@pytest.mark.parametrize(
    ("remove_key", "expected_path"),
    [
        (("temporary_storage", "directory"), "temporary_storage.directory"),
        (("uploads", "max_file_size_mebibytes"), "uploads.max_file_size_mebibytes"),
        (("web", "port"), "web.port"),
        (
            ("crop_preview", "unsupported_input_extensions"),
            "crop_preview.unsupported_input_extensions",
        ),
        (("features", "is_dev_mode_enabled"), "features.is_dev_mode_enabled"),
        (("rembg", "model_name"), "rembg.model_name"),
    ],
)
def test_required_keys_must_exist(config_file, remove_key, expected_path):
    cfg = _copy_config()
    parent, child = remove_key
    del cfg[parent][child]
    config_file(cfg)

    with pytest.raises(ConfigError, match=f"missing required config key: {expected_path}"):
        settings.get()


@pytest.mark.parametrize(
    ("path", "bad_value", "message"),
    [
        (("temporary_storage", "directory"), "   ", "non-empty string"),
        (("temporary_storage", "max_age_seconds"), "3600", "integer"),
        (("temporary_storage", "max_age_seconds"), True, "integer"),
        (("features", "is_dev_mode_enabled"), "false", "boolean"),
        (("web", "workers"), True, 'integer or "auto"'),
        (("web", "workers"), "many", 'integer or "auto"'),
        (("crop_preview", "unsupported_input_extensions"), ".pdf", "must be a list"),
    ],
)
def test_invalid_value_types_are_rejected(config_file, path, bad_value, message):
    cfg = _copy_config()
    parent, child = path
    cfg[parent][child] = bad_value
    config_file(cfg)

    with pytest.raises(ConfigError, match=message):
        settings.get()


@pytest.mark.parametrize(
    ("path", "bad_value", "message"),
    [
        (("uploads", "max_file_size_mebibytes"), 0, ">= 1"),
        (("web", "port"), 70000, "<= 65535"),
        (("crop_preview", "max_retry_attempts"), 0, ">= 1"),
    ],
)
def test_out_of_range_values_are_rejected(config_file, path, bad_value, message):
    cfg = _copy_config()
    parent, child = path
    cfg[parent][child] = bad_value
    config_file(cfg)

    with pytest.raises(ConfigError, match=message):
        settings.get()


def test_crop_preview_extensions_must_be_non_empty_dot_extensions(config_file):
    cfg = _copy_config()
    cfg["crop_preview"]["unsupported_input_extensions"] = [".pdf", True]
    config_file(cfg)
    with pytest.raises(ConfigError, match="non-empty strings"):
        settings.get()

    cfg = _copy_config()
    cfg["crop_preview"]["unsupported_input_extensions"] = ["pdf"]
    config_file(cfg)
    with pytest.raises(ConfigError, match="must start with"):
        settings.get()


def test_crop_preview_extensions_are_normalized(config_file):
    cfg = _copy_config()
    cfg["crop_preview"]["unsupported_input_extensions"] = [" .PDF ", ".Svg"]
    config_file(cfg)

    assert settings.get().crop_preview.unsupported_input_extensions == (".pdf", ".svg")


def test_loader_collects_every_error_at_once(config_file):
    cfg = _copy_config()
    del cfg["uploads"]["max_file_size_mebibytes"]
    cfg["web"]["host"] = ""
    cfg["web"]["port"] = 99999
    cfg["features"]["is_dev_mode_enabled"] = "nope"
    config_file(cfg)

    with pytest.raises(ConfigError) as exc:
        settings.get()

    message = str(exc.value)
    assert "missing required config key: uploads.max_file_size_mebibytes" in message
    assert "config key 'web.host' must be a non-empty string" in message
    assert "config key 'web.port' must be <= 65535" in message
    assert "config key 'features.is_dev_mode_enabled' must be a boolean" in message


def test_missing_malformed_or_non_object_config_file_raises(tmp_path):
    missing = tmp_path / "nope.json"
    settings.reset_cache(config_path=missing)
    with pytest.raises(ConfigError, match="not found"):
        settings.get()

    malformed = tmp_path / "malformed.json"
    malformed.write_text("{not json", encoding="utf-8")
    settings.reset_cache(config_path=malformed)
    with pytest.raises(ConfigError, match="not valid JSON"):
        settings.get()

    non_object = tmp_path / "non-object.json"
    non_object.write_text("[]", encoding="utf-8")
    settings.reset_cache(config_path=non_object)
    with pytest.raises(ConfigError, match="JSON object at the top level"):
        settings.get()
    settings.reset_cache()


@pytest.mark.parametrize(
    ("env_name", "feature_attr", "truthy_expected", "falsy_expected", "json_key"),
    [
        ("DISABLE_LOGO", "is_logo_enabled", False, True, "is_logo_enabled"),
        (
            "DISABLE_STORAGE_MANAGEMENT",
            "is_storage_management_enabled",
            False,
            True,
            "is_storage_management_enabled",
        ),
        ("DEV_MODE", "is_dev_mode_enabled", True, False, "is_dev_mode_enabled"),
    ],
)
def test_feature_flag_env_overrides(
    config_file,
    monkeypatch,
    env_name,
    feature_attr,
    truthy_expected,
    falsy_expected,
    json_key,
):
    path = config_file(VALID_CONFIG)

    monkeypatch.setenv(env_name, "true")
    settings.reset_cache(config_path=path)
    assert getattr(settings.get().features, feature_attr) is truthy_expected

    monkeypatch.setenv(env_name, "off")
    settings.reset_cache(config_path=path)
    assert getattr(settings.get().features, feature_attr) is falsy_expected

    monkeypatch.setenv(env_name, "maybe")
    settings.reset_cache(config_path=path)
    with pytest.raises(ConfigError, match=env_name):
        settings.get()

    cfg = _copy_config()
    cfg["features"][json_key] = not falsy_expected
    path = config_file(cfg)
    monkeypatch.setenv(env_name, "")
    settings.reset_cache(config_path=path)
    assert getattr(settings.get().features, feature_attr) is (not falsy_expected)


def test_shipped_app_json_loads_cleanly():
    settings.reset_cache()
    try:
        config = settings.get()
        assert isinstance(config, AppConfig)
    finally:
        settings.reset_cache()


def test_load_from_file_is_directly_usable(tmp_path):
    path = tmp_path / "app.json"
    path.write_text(json.dumps(VALID_CONFIG), encoding="utf-8")

    config = load_from_file(path)

    assert isinstance(config, AppConfig)
    assert config.rembg.model_name == "u2net"
