from backend.image_converter.core.internals.utilities import supported_extensions


class ConfigurationService:
    def __init__(self, rembg_model_name: str, rembg_available_models: list[str] | None = None):
        self._rembg_model_name = rembg_model_name
        self._rembg_available_models = list(rembg_available_models or [rembg_model_name])

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

    def get_rembg_available_models(self) -> list[str]:
        return list(self._rembg_available_models)
