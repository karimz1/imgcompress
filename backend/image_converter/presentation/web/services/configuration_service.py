from typing import Callable

from backend.image_converter.core.internals.utilities import Result, supported_extensions
from backend.image_converter.domain.upscaling import UpscaleModel
from backend.image_converter.infrastructure.upscale_model import locate_model


class ConfigurationService:
    def __init__(self, rembg_model_name: str, locate_upscale_model: Callable[[str], Result] = locate_model):
        self._rembg_model_name = rembg_model_name
        self._locate_upscale_model = locate_upscale_model

    @staticmethod
    def get_supported_formats() -> list[str]:
        return supported_extensions

    @staticmethod
    def get_verified_formats() -> list[str]:
        return [
            ".heic",
            ".heif",
            ".png",
            ".jpg",
            ".jpeg",
            ".ico",
            ".eps",
            ".psd",
            ".pdf",
            ".avif",
        ]

    def get_rembg_model_name(self) -> str:
        return self._rembg_model_name

    def get_upscale_model_status(self) -> dict:
        """Bundled upscaling models and whether each one is installed (checked on disk only)."""
        return {
            "models": [
                {
                    "id": model.value,
                    "model_name": model.model_name,
                    "available": self._locate_upscale_model(model.filename).is_successful,
                }
                for model in UpscaleModel
            ]
        }
