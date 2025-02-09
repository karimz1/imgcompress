from enum import Enum

class ImageFormat(Enum):
    JPEG = "JPEG"
    PNG = "PNG"

    @classmethod
    def from_string(cls, value: str) -> "ImageFormat":
        try:
            return cls[value.upper()]
        except KeyError:
            raise ValueError(f"Unsupported image format: '{value}'")

    def get_file_extension(self) -> str:
        return IMAGE_FORMAT_EXTENSIONS[self.name]

IMAGE_FORMAT_EXTENSIONS = {
    "JPEG": ".jpg",
    "PNG": ".png",
}
