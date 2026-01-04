from enum import Enum
from backend.image_converter.core.internals.utilities import Result

class ImageFormat(Enum):
    JPEG = "JPEG"
    PNG = "PNG"
    ICO = "ICO"
    AVIF = "AVIF"

    @classmethod
    def from_string(cls, value: str) -> "ImageFormat":
        """
        Converts a string to an ImageFormat enum member.
        Raises a ValueError if the format is not supported.
        """
        try:
            return cls[value.upper()]
        except KeyError:
            raise ValueError(f"Unsupported image format: '{value}'")

    @classmethod
    def from_string_result(cls, value: str) -> Result["ImageFormat"]:
        """
        Converts a string to an ImageFormat enum member using the result pattern.
        Returns a Result object that is successful if the conversion succeeded,
        or contains an error message if the format is not supported.
        """
        try:
            return Result.success(cls[value.upper()])
        except KeyError:
            return Result.failure(f"Unsupported image format: '{value}'")

    def get_file_extension(self) -> str:
        """
        Returns the file extension associated with the image format.
        """
        return IMAGE_FORMAT_EXTENSIONS[self.name]

                                                 
IMAGE_FORMAT_EXTENSIONS = {
    "JPEG": ".jpg",
    "PNG": ".png",
    "ICO": ".ico",
    "AVIF": ".avif",
}
