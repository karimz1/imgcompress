from backend.image_converter.core.internals.utilities import supported_extensions

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
            ".pdf"
        ]
