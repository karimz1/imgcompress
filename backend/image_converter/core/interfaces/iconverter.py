from backend.image_converter.core.internals.utls import Result
from typing import Dict  # Add this import

class IImageConverter:
    """Interface (or abstract base) for different format converters."""
    
    def convert(self, image_data: bytes, source_path: str, dest_path: str) -> Result[Dict]:
        result_dict = {
            "source": source_path,
            "destination": dest_path,
            "is_successful": True,  # Use 'is_successful' for consistency.
            "error": None,
        }
