from dataclasses import dataclass
from typing import Iterable, List, Optional, Any

from backend.image_converter.core.internals.utls import Result
from backend.image_converter.infrastructure.pdf_page_extractor import PdfPageExtractor
from backend.image_converter.infrastructure.psd_renderer import PsdRenderer


@dataclass
class PagePayload:
    data: bytes
    page_index: Optional[int]
    label: str


class FilePayloadExpander:
    """
    Normalizes various upload types (images, PDFs) into a generator of raster payloads.
    """

    def __init__(self, pdf_extractor: PdfPageExtractor, psd_renderer: PsdRenderer):
        self.pdf_extractor = pdf_extractor
        self.psd_renderer = psd_renderer

    def expand(self, source_name: str, data: bytes) -> Result[Iterable[PagePayload]]:
        """
        Returns an iterable of PagePayload objects for the given source.
        """
        if self._is_pdf(source_name):
            return self._expand_pdf_payloads(source_name, data)
        if self._is_psd(source_name):
            return self._expand_psd_payload(source_name, data)
        return Result.success([self._build_single_payload(source_name, data)])

    @staticmethod
    def _is_pdf(source_name: str) -> bool:
        return source_name.lower().endswith(".pdf")

    @staticmethod
    def _is_psd(source_name: str) -> bool:
        return source_name.lower().endswith(".psd")

    def _expand_pdf_payloads(self, source_name: str, data: bytes) -> Result[Iterable[PagePayload]]:
        pdf_pages_res = self.pdf_extractor.rasterize_pages(data, source_name)
        if not pdf_pages_res.is_successful:
            return Result.failure(pdf_pages_res.error)

        def payload_generator():
            for index, page in enumerate(pdf_pages_res.value, start=1):
                yield PagePayload(
                    data=page,
                    page_index=index,
                    label=f"{source_name} (page {index})",
                )

        return Result.success(payload_generator())

    def _expand_psd_payload(self, source_name: str, data: bytes) -> Result[Iterable[PagePayload]]:
        rendered = self.psd_renderer.render(source_name, data)
        if not rendered.is_successful:
            return Result.failure(rendered.error)

        payload = PagePayload(
            data=rendered.value,
            page_index=None,
            label=source_name,
        )
        return Result.success([payload])

    @staticmethod
    def _build_single_payload(source_name: str, data: bytes) -> PagePayload:
        return PagePayload(data=data, page_index=None, label=source_name)
