"""Access to the loaded backend configuration."""

from pathlib import Path

from backend.image_converter.config.app_config import AppConfig
from backend.image_converter.config.loader import ConfigError, load_from_file

__all__ = ["AppConfig", "ConfigError", "get", "reset_cache"]

_DEFAULT_CONFIG_PATH = Path(__file__).with_name("app.json")

_cache: AppConfig | None = None
_cache_path: Path = _DEFAULT_CONFIG_PATH


def get() -> AppConfig:
    """Return the cached app config, loading it on first use."""
    global _cache

    if _cache is None:
        _cache = load_from_file(_cache_path)

    return _cache


def reset_cache(config_path: Path | None = None) -> None:
    """Clear the cached config.

    Tests may pass a custom config path before calling get().
    """
    global _cache, _cache_path

    _cache = None
    _cache_path = config_path or _DEFAULT_CONFIG_PATH