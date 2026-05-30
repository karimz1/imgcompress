"""Tests for the bootstraper entry point — runtime-mode dispatch and config wiring."""

import pytest

from backend.image_converter import bootstraper
from backend.image_converter.config import settings
from backend.image_converter.core.enums.runtime_mode import RuntimeMode
from tests.unit.dummy_logger import DummyLogger


@pytest.fixture
def noop_heif_registration(monkeypatch):
    monkeypatch.setattr(bootstraper.pillow_heif, "register_heif_opener", lambda: None)


@pytest.fixture
def dummy_logger(monkeypatch):
    monkeypatch.setattr(bootstraper, "Logger", DummyLogger)


@pytest.fixture
def loaded_config(monkeypatch):
    """`bootstraper.main` calls `settings.get()` early — keep that side-effect-free."""
    fake_config = settings.get()
    monkeypatch.setattr(bootstraper, "enable_error_capture_in_docker_env", lambda: None)
    return fake_config


@pytest.fixture
def common_patches(noop_heif_registration, dummy_logger, loaded_config):
    return loaded_config


def _set_mode(monkeypatch, mode_arg, remaining=None):
    if remaining is None:
        remaining = []
    monkeypatch.setattr(
        bootstraper,
        "parse_arguments",
        lambda: (RuntimeMode.from_arg(mode_arg), remaining),
    )


def test_main_defaults_to_web_when_mode_missing(monkeypatch, common_patches):
    calls = {"web": 0, "cli": 0}

    def fake_launch_web_prod(_web_config):
        calls["web"] += 1

    def fake_cli_main(_remaining):
        calls["cli"] += 1

    monkeypatch.setattr(bootstraper, "launch_web_prod", fake_launch_web_prod)
    monkeypatch.setattr(bootstraper, "cli_main", fake_cli_main)
    _set_mode(monkeypatch, mode_arg=None)

    bootstraper.main()

    assert calls["web"] == 1
    assert calls["cli"] == 0


def test_main_uses_web_mode_when_explicit(monkeypatch, common_patches):
    received_web_config = {"value": None}

    def fake_launch_web_prod(web_config):
        received_web_config["value"] = web_config

    monkeypatch.setattr(bootstraper, "launch_web_prod", fake_launch_web_prod)
    _set_mode(monkeypatch, mode_arg="web")

    bootstraper.main()

    assert received_web_config["value"] is common_patches.web


def test_main_uses_cli_mode_when_explicit(monkeypatch, common_patches):
    calls = {"cli": 0, "remaining": None}

    def fake_cli_main(remaining):
        calls["cli"] += 1
        calls["remaining"] = remaining

    monkeypatch.setattr(bootstraper, "cli_main", fake_cli_main)
    _set_mode(monkeypatch, mode_arg="cli", remaining=["--help"])

    bootstraper.main()

    assert calls["cli"] == 1
    assert calls["remaining"] == ["--help"]


def test_runtime_mode_from_arg_rejects_unknown_value():
    with pytest.raises(ValueError, match="unknown runtime mode"):
        RuntimeMode.from_arg("unknown")
