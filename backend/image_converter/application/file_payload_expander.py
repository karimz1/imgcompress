from dataclasses import dataclass
from typing import List, Optional

from backend.image_converter.core.internals.utls import Result
from backend.image_converter.infrastructure.pdf_page_extractor import PdfPageExtractor


@dataclass
class PagePayload:
    data: bytes
    page_index: Optional[int]
    label: str


class FilePayloadExpander:
    """
    Normalizes various upload types (images, PDFs) into a list of raster payloads.
    """

    def __init__(self, pdf_extractor: PdfPageExtractor):
        self.pdf_extractor = pdf_extractor

    def expand(self, source_name: str, data: bytes) -> Result[List[PagePayload]]:
        """
        Returns a list of PagePayload objects for the given source.
        """
        if self._is_pdf(source_name):
            return self._expand_pdf_payloads(source_name, data)
        return Result.success([self._build_single_payload(source_name, data)])

    @staticmethod
    def _is_pdf(source_name: str) -> bool:
        return source_name.lower().endswith(".pdf")

    def _expand_pdf_payloads(self, source_name: str, data: bytes) -> Result[List[PagePayload]]:
        pdf_pages = self.pdf_extractor.rasterize_pages(data, source_name)
        if not pdf_pages.is_successful:
            return Result.failure(pdf_pages.error)

        payloads = [
            PagePayload(
                data=page,
                page_index=index,
                label=f"{source_name} (page {index})",
            )
            for index, page in enumerate(pdf_pages.value, start=1)
        ]
        return Result.success(payloads)

    @staticmethod
    def _build_single_payload(source_name: str, data: bytes) -> PagePayload:
        return PagePayload(data=data, page_index=None, label=source_name)
