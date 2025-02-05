from typing import Dict

class IImageConverter:
    """Interface (or abstract base) for different format converters."""
    
    def convert(self, 
                image, 
                source_path: str, 
                dest_path: str) -> Dict:
        raise NotImplementedError
