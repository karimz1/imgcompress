from backend.image_converter.core.internals.utilities import supported_extensions
from backend.image_converter.core.internals.rembg_config import load_rembg_model_name

class ConfigurationService:
    @staticmethod
    def get_supported_formats():
        return supported_extensions

    @staticmethod
    def get_verified_formats():
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
            ".avif"
        ]

    @staticmethod
    def get_rembg_model_name():
        """
        Returns the configured rembg model name, falling back to the default when the
        config file or env var is missing or invalid.
        """
        return load_rembg_model_name()
