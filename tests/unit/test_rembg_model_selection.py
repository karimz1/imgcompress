"""Unit tests for rembg model allowlist resolution."""

from backend.image_converter.core.internals.rembg_config import resolve_rembg_model


# --- resolve_rembg_model (validates against the shipped app.json allowlist) ---


def test_resolve_returns_requested_when_in_allowlist():
    assert resolve_rembg_model("isnet-anime") == "isnet-anime"
    assert resolve_rembg_model("isnet-general-use") == "isnet-general-use"
    assert resolve_rembg_model("u2net_human_seg") == "u2net_human_seg"
    assert resolve_rembg_model("birefnet-general-lite") == "birefnet-general-lite"


def test_resolve_falls_back_to_default_for_unknown_model():
    assert resolve_rembg_model("does-not-exist") == "u2net"


def test_resolve_falls_back_to_default_for_empty_or_none():
    assert resolve_rembg_model(None) == "u2net"
    assert resolve_rembg_model("") == "u2net"
    assert resolve_rembg_model("   ") == "u2net"
