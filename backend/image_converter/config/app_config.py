"""Typed backend configuration models."""

from dataclasses import dataclass

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
    unsupported_input_extensions: tuple[str, ...]


@dataclass(frozen=True)
class FormatsConfig:
    custom_pipeline_extensions: tuple[str, ...]


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
    formats: FormatsConfig
    features: FeaturesConfig
    rembg: RembgConfig