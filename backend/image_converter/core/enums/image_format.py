# backend/image_converter/core/enums/image_format.py
from enum import Enum

class ImageFormat(Enum):
    JPEG = "JPEG"
    PNG = "PNG"

    @classmethod
    def from_string(cls, value: str) -> "ImageFormat":
        """
        Converts a string like 'jpeg' or 'png' into an ImageFormat enum value.
        Raises ValueError if the string does not map to a known enum member.
        """
        try:
            return cls[value.upper()]
        except KeyError:
            raise ValueError(f"Unsupported image format: '{value}'")
