import json
import os
from pathlib import Path
from typing import Any, Optional, Union

_CONFIG_PATH = Path(__file__).with_name("app.json")
_cache: Optional[dict] = None
_ENV_TRUTHY = {"true", "1", "yes", "on"}
_ENV_FALSY = {"false", "0", "no", "off"}


class ConfigError(RuntimeError):
    pass


def _env_bool(name: str) -> Optional[bool]:
    raw = os.environ.get(name)
    if raw is None:
        return None
    normalized = raw.strip().lower()
    if normalized == "":
        return None
    if normalized in _ENV_TRUTHY:
        return True
    if normalized in _ENV_FALSY:
        return False
    raise ConfigError(
        f"environment variable '{name}' must be one of "
        f"true/false/1/0/yes/no/on/off, got '{raw}'"
    )


def _load() -> dict:
    global _cache
    if _cache is None:
        try:
            with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
                parsed = json.load(f)
        except FileNotFoundError as exc:
            raise ConfigError(f"backend config file not found: {_CONFIG_PATH}") from exc
        except json.JSONDecodeError as exc:
            raise ConfigError(f"backend config file is not valid JSON: {exc}") from exc
        if not isinstance(parsed, dict):
            raise ConfigError("backend config must be a JSON object at the top level")
        _cache = parsed
    return _cache


def reset_cache() -> None:
    global _cache
    _cache = None


def _lookup(path: str) -> Any:
    node: Any = _load()
    for part in path.split("."):
        if not isinstance(node, dict) or part not in node:
            raise ConfigError(f"missing required config key: {path}")
        node = node[part]
    return node


def _require_str(path: str) -> str:
    value = _lookup(path)
    if not isinstance(value, str) or not value.strip():
        raise ConfigError(f"config key '{path}' must be a non-empty string")
    return value


def _require_int(path: str, *, minimum: int, maximum: Optional[int] = None) -> int:
    value = _lookup(path)
    if isinstance(value, bool) or not isinstance(value, int):
        raise ConfigError(f"config key '{path}' must be an integer")
    if value < minimum:
        raise ConfigError(f"config key '{path}' must be >= {minimum}")
    if maximum is not None and value > maximum:
        raise ConfigError(f"config key '{path}' must be <= {maximum}")
    return value


def _require_bool(path: str) -> bool:
    value = _lookup(path)
    if not isinstance(value, bool):
        raise ConfigError(f"config key '{path}' must be a boolean")
    return value


def _require_str_list(path: str) -> list[str]:
    value = _lookup(path)
    if not isinstance(value, list):
        raise ConfigError(f"config key '{path}' must be a list")
    normalized = []
    for item in value:
        if not isinstance(item, str) or not item.strip():
            raise ConfigError(f"config key '{path}' must contain only non-empty strings")
        extension = item.strip().lower()
        if not extension.startswith("."):
            raise ConfigError(f"config key '{path}' extensions must start with '.'")
        normalized.append(extension)
    return normalized


def _require_int_or_auto(path: str, *, minimum: int) -> Union[int, str]:
    value = _lookup(path)
    if isinstance(value, str):
        if value.strip().lower() != "auto":
            raise ConfigError(f"config key '{path}' must be an integer or \"auto\"")
        return "auto"
    if isinstance(value, bool) or not isinstance(value, int):
        raise ConfigError(f"config key '{path}' must be an integer or \"auto\"")
    if value < minimum:
        raise ConfigError(f"config key '{path}' must be >= {minimum}")
    return value


def temp_dir() -> str:
    return _require_str("temp_dir")


def temp_expiration_seconds() -> int:
    return _require_int("temp_expiration_seconds", minimum=1)


def max_upload_bytes() -> int:
    return _require_int("max_upload_bytes", minimum=1024)


def web_host() -> str:
    return _require_str("web.host")


def web_port() -> int:
    return _require_int("web.port", minimum=1, maximum=65535)


def web_workers() -> Union[int, str]:
    return _require_int_or_auto("web.workers", minimum=1)


def backend_log_file() -> str:
    return _require_str("logging.backend_log_file")


def crop_preview_max_attempts() -> int:
    return _require_int("crop_preview.max_attempts", minimum=1)


def crop_preview_unsupported_extensions() -> list[str]:
    return _require_str_list("crop_preview.unsupported_extensions")


def bytes_per_megabyte() -> int:
    return _require_int("storage.bytes_per_megabyte", minimum=1)


def dev_mode() -> bool:
    override = _env_bool("DEV_MODE")
    if override is not None:
        return override
    return _require_bool("features.dev_mode")


def rembg_model_name() -> str:
    return _require_str("rembg.model_name")


_REQUIRED_GETTERS = (
    temp_dir,
    temp_expiration_seconds,
    max_upload_bytes,
    web_host,
    web_port,
    web_workers,
    backend_log_file,
    crop_preview_max_attempts,
    crop_preview_unsupported_extensions,
    bytes_per_megabyte,
    storage_management_enabled,
    show_logo,
    dev_mode,
    rembg_model_name,
)


def validate_all() -> None:
    errors = []
    for getter in _REQUIRED_GETTERS:
        try:
            getter()
        except ConfigError as exc:
            errors.append(str(exc))
    if errors:
        raise ConfigError("invalid backend config:\n  - " + "\n  - ".join(errors))
