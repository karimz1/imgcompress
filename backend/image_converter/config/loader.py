"""Builds `AppConfig` from `app.json` (with feature-flag env overrides).

The loader is the *only* module that knows the JSON key paths and the env-var
names. Everywhere else in the codebase reads typed attributes off `AppConfig`.
If a key is missing, the value has the wrong type, an int is out of range, or
an env override is unparseable, the loader collects every problem and raises
one `ConfigError` listing them all — so misconfigured servers never start.
"""

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional, Tuple, TypeVar

from backend.image_converter.config.app_config import (
    AppConfig,
    CropPreviewConfig,
    FeaturesConfig,
    FormatsConfig,
    LoggingConfig,
    RembgConfig,
    TemporaryStorageConfig,
    UploadsConfig,
    WebConfig,
)

from backend.image_converter.domain.web_workers import WebWorkerCount


class ConfigError(RuntimeError):
    pass


_ENV_TRUTHY = frozenset({"true", "1", "yes", "on"})
_ENV_FALSY = frozenset({"false", "0", "no", "off"})


@dataclass(frozen=True)
class _FeatureFlagOverride:
    json_path: Tuple[str, ...]
    env_var: str
    inverted: bool


_OVERRIDES = (
    _FeatureFlagOverride(
        json_path=("features", "is_storage_management_enabled"),
        env_var="DISABLE_STORAGE_MANAGEMENT",
        inverted=True,
    ),
    _FeatureFlagOverride(
        json_path=("features", "is_logo_enabled"),
        env_var="DISABLE_LOGO",
        inverted=True,
    ),
    _FeatureFlagOverride(
        json_path=("features", "is_dev_mode_enabled"),
        env_var="DEV_MODE",
        inverted=False,
    ),
)


def load_from_file(path: Path) -> AppConfig:
    raw = _read_json_object(path)
    errors: list[str] = []
    reader = _Reader(raw, errors)

    temp_storage = TemporaryStorageConfig(
        directory=reader.require_str(("temporary_storage", "directory")),
        max_age_seconds=reader.require_int(("temporary_storage", "max_age_seconds"), minimum=1),
    )
    uploads = UploadsConfig(
        max_file_size_mebibytes=reader.require_int(("uploads", "max_file_size_mebibytes"), minimum=1),
    )
    web = WebConfig(
        host=reader.require_str(("web", "host")),
        port=reader.require_int(("web", "port"), minimum=1, maximum=65535),
        workers=reader.require_web_workers(("web", "workers")),
    )
    logging_cfg = LoggingConfig(
        backend_log_file=reader.require_str(("logging", "backend_log_file")),
    )
    crop_preview = CropPreviewConfig(
        max_retry_attempts=reader.require_int(("crop_preview", "max_retry_attempts"), minimum=1),
        unsupported_input_extensions=reader.require_extension_list(
            ("crop_preview", "unsupported_input_extensions"),
        ),
    )
    formats = FormatsConfig(
        custom_pipeline_extensions=reader.require_extension_list(
            ("formats", "custom_pipeline_extensions"),
        ),
    )
    features = FeaturesConfig(
        is_storage_management_enabled=reader.require_feature_flag(
            ("features", "is_storage_management_enabled"),
        ),
        is_logo_enabled=reader.require_feature_flag(
            ("features", "is_logo_enabled"),
        ),
        is_dev_mode_enabled=reader.require_feature_flag(
            ("features", "is_dev_mode_enabled"),
        ),
    )
    rembg = RembgConfig(model_name=reader.require_str(("rembg", "model_name")))

    if errors:
        raise ConfigError("invalid backend config:\n  - " + "\n  - ".join(errors))

    return AppConfig(
        temporary_storage=temp_storage,
        uploads=uploads,
        web=web,
        logging=logging_cfg,
        crop_preview=crop_preview,
        formats=formats,
        features=features,
        rembg=rembg,
    )


def _read_json_object(path: Path) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as f:
            parsed = json.load(f)
    except FileNotFoundError as exc:
        raise ConfigError(f"backend config file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ConfigError(f"backend config file is not valid JSON: {exc}") from exc
    if not isinstance(parsed, dict):
        raise ConfigError("backend config must be a JSON object at the top level")
    return parsed


_SENTINEL = object()
T = TypeVar("T")


class _Reader:
    """Internal helper that lifts JSON leaves into typed values, collecting errors."""

    def __init__(self, root: dict, errors: list[str]):
        self._root = root
        self._errors = errors

    def require_str(self, path: Tuple[str, ...]) -> str:
        return self._read(
            path,
            validator=lambda v: isinstance(v, str) and v.strip() != "",
            message="must be a non-empty string",
            fallback="",
        )

    def require_int(
        self,
        path: Tuple[str, ...],
        *,
        minimum: int,
        maximum: Optional[int] = None,
    ) -> int:
        def _validate(value: object) -> bool:
            if isinstance(value, bool) or not isinstance(value, int):
                self._errors.append(f"config key '{_render(path)}' must be an integer")
                return False
            if value < minimum:
                self._errors.append(f"config key '{_render(path)}' must be >= {minimum}")
                return False
            if maximum is not None and value > maximum:
                self._errors.append(f"config key '{_render(path)}' must be <= {maximum}")
                return False
            return True

        raw = self._lookup(path)
        if raw is _SENTINEL:
            return 0
        if not _validate(raw):
            return 0
        return raw  # type: ignore[return-value]

    def require_bool(self, path: Tuple[str, ...]) -> bool:
        return self._read(
            path,
            validator=lambda v: isinstance(v, bool),
            message="must be a boolean",
            fallback=False,
        )

    def require_web_workers(self, path: Tuple[str, ...]) -> WebWorkerCount:
        raw = self._lookup(path)
        if raw is _SENTINEL:
            return WebWorkerCount.auto()
        if isinstance(raw, str):
            if raw.strip().lower() != "auto":
                self._errors.append(
                    f"config key '{_render(path)}' must be an integer or \"auto\""
                )
                return WebWorkerCount.auto()
            return WebWorkerCount.auto()
        if isinstance(raw, bool) or not isinstance(raw, int):
            self._errors.append(
                f"config key '{_render(path)}' must be an integer or \"auto\""
            )
            return WebWorkerCount.auto()
        if raw < 1:
            self._errors.append(f"config key '{_render(path)}' must be >= 1")
            return WebWorkerCount.auto()
        return WebWorkerCount.fixed(raw)

    def require_extension_list(self, path: Tuple[str, ...]) -> Tuple[str, ...]:
        raw = self._lookup(path)
        if raw is _SENTINEL:
            return ()
        if not isinstance(raw, list):
            self._errors.append(f"config key '{_render(path)}' must be a list")
            return ()
        normalized: list[str] = []
        for entry in raw:
            if not isinstance(entry, str) or not entry.strip():
                self._errors.append(
                    f"config key '{_render(path)}' must contain only non-empty strings"
                )
                return ()
            cleaned = entry.strip().lower()
            if not cleaned.startswith("."):
                self._errors.append(
                    f"config key '{_render(path)}' extensions must start with '.'"
                )
                return ()
            normalized.append(cleaned)
        return tuple(normalized)

    def require_feature_flag(self, path: Tuple[str, ...]) -> bool:
        override = self._matching_override(path)
        if override is not None:
            env_value = _read_env_bool(override.env_var, self._errors)
            if env_value is not None:
                return (not env_value) if override.inverted else env_value
        return self.require_bool(path)

    @staticmethod
    def _matching_override(path: Tuple[str, ...]) -> Optional[_FeatureFlagOverride]:
        for override in _OVERRIDES:
            if override.json_path == path:
                return override
        return None

    def _lookup(self, path: Tuple[str, ...]) -> object:
        node: object = self._root
        for part in path:
            if not isinstance(node, dict) or part not in node:
                self._errors.append(f"missing required config key: {_render(path)}")
                return _SENTINEL
            node = node[part]
        return node

    def _read(
        self,
        path: Tuple[str, ...],
        *,
        validator: Callable[[object], bool],
        message: str,
        fallback: T,
    ) -> T:
        raw = self._lookup(path)
        if raw is _SENTINEL:
            return fallback
        if not validator(raw):
            self._errors.append(f"config key '{_render(path)}' {message}")
            return fallback
        return raw  # type: ignore[return-value]


def _render(path: Tuple[str, ...]) -> str:
    return ".".join(path)


def _read_env_bool(name: str, errors: list[str]) -> Optional[bool]:
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
    errors.append(
        f"environment variable '{name}' must be one of "
        f"true/false/1/0/yes/no/on/off, got '{raw}'"
    )
    return None
