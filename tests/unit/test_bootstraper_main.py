from types import SimpleNamespace

import pytest

from backend.image_converter import bootstraper
from tests.unit.dummy_logger import DummyLogger


@pytest.fixture
def noop_heif_registration(monkeypatch):
    monkeypatch.setattr(bootstraper.pillow_heif, "register_heif_opener", lambda: None)


@pytest.fixture
def dummy_logger(monkeypatch):
    monkeypatch.setattr(bootstraper, "Logger", DummyLogger)


@pytest.fixture
def common_patches(noop_heif_registration, dummy_logger):
    return None


def _set_args(monkeypatch, mode, remaining=None):
    if remaining is None:
        remaining = []
    monkeypatch.setattr(
        bootstraper,
        "parse_arguments",
        lambda: (SimpleNamespace(mode=mode), remaining),
    )


def test_main_defaults_to_web_when_mode_missing(monkeypatch, common_patches):

    calls = {"web": 0, "cli": 0}

    def fake_launch_web_prod():
        calls["web"] += 1

    def fake_cli_main(_remaining):
        calls["cli"] += 1

    monkeypatch.setattr(bootstraper, "launch_web_prod", fake_launch_web_prod)
    monkeypatch.setattr(bootstraper, "cli_main", fake_cli_main)
    _set_args(monkeypatch, mode=None)

    bootstraper.main()

    assert calls["web"] == 1
    assert calls["cli"] == 0


def test_main_uses_web_mode_when_explicit(monkeypatch, common_patches):

    calls = {"web": 0}

    def fake_launch_web_prod():
        calls["web"] += 1

    monkeypatch.setattr(bootstraper, "launch_web_prod", fake_launch_web_prod)
    _set_args(monkeypatch, mode="web")

    bootstraper.main()

    assert calls["web"] == 1


def test_main_uses_cli_mode_when_explicit(monkeypatch, common_patches):

    calls = {"cli": 0, "remaining": None}

    def fake_cli_main(remaining):
        calls["cli"] += 1
        calls["remaining"] = remaining

    monkeypatch.setattr(bootstraper, "cli_main", fake_cli_main)
    _set_args(monkeypatch, mode="cli", remaining=["--help"])

    bootstraper.main()

    assert calls["cli"] == 1
    assert calls["remaining"] == ["--help"]


def test_main_raises_for_unknown_mode(monkeypatch, common_patches):
    _set_args(monkeypatch, mode="unknown")

    with pytest.raises(ValueError, match="no argument that match was found"):
        bootstraper.main()
