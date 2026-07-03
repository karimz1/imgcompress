"""Unit tests for rembg model allowlist resolution and onnxruntime provider selection."""

import sys
from types import SimpleNamespace

from backend.image_converter.core.internals.onnx_providers import get_execution_providers
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


# --- get_execution_providers ---


def _fake_ort(monkeypatch, providers):
    monkeypatch.setitem(
        sys.modules,
        "onnxruntime",
        SimpleNamespace(get_available_providers=lambda: list(providers)),
    )


def test_providers_cpu_only(monkeypatch):
    _fake_ort(monkeypatch, ["CPUExecutionProvider"])
    assert get_execution_providers() == ["CPUExecutionProvider"]


def test_providers_prefers_cuda_first(monkeypatch):
    _fake_ort(monkeypatch, ["CPUExecutionProvider", "CUDAExecutionProvider"])
    providers = get_execution_providers()
    assert providers[0] == "CUDAExecutionProvider"
    assert providers[-1] == "CPUExecutionProvider"


def test_providers_always_appends_cpu_fallback(monkeypatch):
    _fake_ort(monkeypatch, ["TensorrtExecutionProvider"])
    providers = get_execution_providers()
    assert providers[-1] == "CPUExecutionProvider"


def test_providers_survive_import_failure(monkeypatch):
    # Simulate onnxruntime being unavailable / raising on query.
    def _boom():
        raise RuntimeError("no onnxruntime")

    monkeypatch.setitem(
        sys.modules, "onnxruntime", SimpleNamespace(get_available_providers=_boom)
    )
    assert get_execution_providers() == ["CPUExecutionProvider"]
