from abc import ABC, abstractmethod
from backend.image_converter.application.dtos import ConversionDetails
from backend.image_converter.core.internals.utilities import Result


class IImageConverter(ABC):
    """Interface for all image converters."""

    @abstractmethod
    def convert(self, image_data: bytes, source_path: str, dest_path: str) -> Result[ConversionDetails]:
        """Converts image data and saves it to the destination path."""
        pass

    @abstractmethod
    def encode_to_bytes(self, image_data: bytes) -> bytes:
        """Encodes image data to bytes in the target format."""
        pass
