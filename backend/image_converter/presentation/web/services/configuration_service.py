from backend.image_converter.core.internals.utilities import supported_extensions


class ConfigurationService:
    def __init__(self, rembg_model_name: str):
        self._rembg_model_name = rembg_model_name

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
