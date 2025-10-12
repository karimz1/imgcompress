from dataclasses import dataclass
from typing import Optional
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.domain.units import TargetSize

@dataclass
class CompressRequest:
    source_folder: str
    dest_folder: str
    image_format: ImageFormat
    quality: int
    width: Optional[int]
    target_size: Optional[TargetSize]

@dataclass
class CompressResult:
    processed_files: list[str]
    errors: list[str]

    def to_summary(self):
        return {"processed_files": self.processed_files, "errors": self.errors}
