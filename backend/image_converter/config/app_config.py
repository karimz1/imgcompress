"""Strongly-typed backend configuration.

`AppConfig` is the materialized, validated view of `app.json` (with feature-flag
env overrides applied). Every section is a frozen value object; every leaf is
a typed primitive or a domain value object. Feature code receives an `AppConfig`
or one of its sections from the composition root — no string lookups, no
`Any`, no `dict[str, Any]`.
"""

from dataclasses import dataclass
from typing import Tuple

from backend.image_converter.domain.units import BYTES_PER_MEBIBYTE
from backend.image_converter.domain.web_workers import WebWorkerCount


@dataclass(frozen=True)
class TemporaryStorageConfig:
    directory: str
    max_age_seconds: int


@dataclass(frozen=True)
class UploadsConfig:
    max_file_size_mebibytes: int

    @property
    def max_file_size_bytes(self) -> int:
        return self.max_file_size_mebibytes * BYTES_PER_MEBIBYTE


@dataclass(frozen=True)
class WebConfig:
    host: str
    port: int
    workers: WebWorkerCount


@dataclass(frozen=True)
class LoggingConfig:
    backend_log_file: str


@dataclass(frozen=True)
class CropPreviewConfig:
    max_retry_attempts: int
    unsupported_input_extensions: Tuple[str, ...]


@dataclass(frozen=True)
class FeaturesConfig:
    is_storage_management_enabled: bool
    is_logo_enabled: bool
    is_dev_mode_enabled: bool


@dataclass(frozen=True)
class RembgConfig:
    model_name: str


@dataclass(frozen=True)
class AppConfig:
    temporary_storage: TemporaryStorageConfig
    uploads: UploadsConfig
    web: WebConfig
    logging: LoggingConfig
    crop_preview: CropPreviewConfig
    features: FeaturesConfig
    rembg: RembgConfig
