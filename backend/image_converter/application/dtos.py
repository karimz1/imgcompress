"""Application-layer DTOs (data carriers across service / route boundaries).
"""

from dataclasses import asdict, dataclass, field
from typing import List, Optional, Tuple

from werkzeug.datastructures import FileStorage

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
    use_rembg: bool = False
    pdf_preset: Optional[str] = None
    pdf_scale: str = "fit"
    pdf_margin_mm: Optional[float] = None
    pdf_paginate: bool = False


@dataclass
class CompressResult:
    processed_files: list[str]
    errors: list[str]

    def to_json_dict(self) -> dict:
        return {"processed_files": self.processed_files, "errors": self.errors}


@dataclass(frozen=True)
class ConversionDetails:
    source: str
    destination: str
    bytes_written: int


@dataclass
class PageProcessingResult:
    file: str
    source: str
    destination: str
    original_width: Optional[int]
    resized_width: Optional[int]
    is_successful: bool
    error: Optional[str] = None


@dataclass
class ConversionSummary:
    processed_pages: List[PageProcessingResult]
    errors_count: int


@dataclass
class FileProcessingSummary:
    total_files_count: int
    successful_files_count: int
    failed_files_count: int


@dataclass
class ConversionResultsDto:
    files: List[PageProcessingResult]
    file_processing_summary: FileProcessingSummary


@dataclass
class ConversionOutputDto:
    status: str
    conversion_results: ConversionResultsDto
    logs: Optional[List[dict]] = None


@dataclass(frozen=True)
class CompressionFormData:
    """Parsed and validated /compress request body."""

    uploaded_files: Tuple[FileStorage, ...]
    quality: int
    width: Optional[int]
    image_format: ImageFormat
    target_size_kb: Optional[int]
    use_rembg: bool
    pdf_preset: str
    pdf_scale: str
    pdf_margin_mm: float
    pdf_paginate: bool


@dataclass(frozen=True)
class CompressionResponse:
    """Successful /compress response payload (before HTTP status wrapping)."""

    converted_files: List[str]
    dest_folder: str
    process_summary: CompressResult

    def to_json_dict(self) -> dict:
        return {
            "converted_files": list(self.converted_files),
            "dest_folder": self.dest_folder,
            "process_summary": self.process_summary.to_json_dict(),
        }


@dataclass(frozen=True)
class ContainerFile:
    """A single file the storage-management UI can list and download."""

    folder: str
    folder_path: str
    filename: str
    size_mb: float

    def to_json_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class ContainerInventory:
    """All files currently managed under the temp root, with totals."""

    files: List[ContainerFile] = field(default_factory=list)
    total_size_mb: float = 0.0
    total_count: int = 0

    def to_json_dict(self) -> dict:
        return {
            "files": [f.to_json_dict() for f in self.files],
            "total_size_mb": self.total_size_mb,
            "total_count": self.total_count,
        }


@dataclass(frozen=True)
class CleanedItem:
    kind: str
    path: str

    def to_json_dict(self) -> dict:
        return {"type": self.kind, "path": self.path}


@dataclass(frozen=True)
class CleanupError:
    kind: str
    path: str
    error: str

    def to_json_dict(self) -> dict:
        return {"type": self.kind, "path": self.path, "error": self.error}


@dataclass
class CleanupSummary:
    deleted: List[CleanedItem] = field(default_factory=list)
    errors: List[CleanupError] = field(default_factory=list)

    def to_json_dict(self) -> dict:
        return {
            "deleted": [item.to_json_dict() for item in self.deleted],
            "errors": [err.to_json_dict() for err in self.errors],
        }
