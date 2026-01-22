from dataclasses import dataclass
from typing import Optional, List

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

    def to_summary(self):
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
