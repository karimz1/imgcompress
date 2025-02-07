from enum import Enum

class ImageFormat(Enum):
    JPEG = "JPEG"
    PNG = "PNG"

    # Define a class-level dictionary mapping enum member names to file extensions.
    _EXTENSIONS = {
        "JPEG": ".jpg",
        "PNG": ".png",
    }

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

    def get_file_extension(self) -> str:
        """
        Returns the file extension associated with this image format.
        """
        return self._EXTENSIONS[self.name]
