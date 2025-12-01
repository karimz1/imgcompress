from backend.image_converter.application.dtos import ConversionDetails
from backend.image_converter.core.internals.utls import Result


class IImageConverter:
    """Interface for all converters."""

    def convert(self, image_data: bytes, source_path: str, dest_path: str) -> Result[ConversionDetails]:
        raise NotImplementedError
