"""Public access to the loaded `AppConfig`.

Backend code never reaches into JSON, `os.environ`, or string-based keys. The
composition root calls `settings.get()` once at startup, and from then on the
typed `AppConfig` is the single source of truth. Feature code should accept
the value it needs as a constructor argument; reach for `settings.get()` only
at the composition root or in tests.
"""

from pathlib import Path
from typing import Optional

from backend.image_converter.config.app_config import AppConfig
from backend.image_converter.config.loader import ConfigError, load_from_file

__all__ = ["AppConfig", "ConfigError", "get", "reset_cache"]

_CONFIG_PATH = Path(__file__).with_name("app.json")
_cache: Optional[AppConfig] = None


def get() -> AppConfig:
    global _cache
    if _cache is None:
        _cache = load_from_file(_CONFIG_PATH)
    return _cache


def reset_cache() -> None:
    global _cache
    _cache = None
