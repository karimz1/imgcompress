from collections.abc import Iterable
from dataclasses import dataclass

from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.infrastructure.pdf_page_extractor import PdfPageExtractor
from backend.image_converter.infrastructure.psd_renderer import PsdRenderer
from backend.image_converter.infrastructure.svg_renderer import SvgRenderer


@dataclass
class PagePayload:
    data: bytes
    page_index: int | None
    label: str


class FilePayloadExpander:
    """
    Normalizes supported upload containers into raster payloads for conversion.
    """

    def __init__(
        self,
        pdf_extractor: PdfPageExtractor,
        psd_renderer: PsdRenderer,
        svg_renderer: SvgRenderer | None = None,
    ):
        self.pdf_extractor = pdf_extractor
        self.psd_renderer = psd_renderer
        self.svg_renderer = svg_renderer or SvgRenderer()

    def expand(self, source_name: str, data: bytes) -> Result[Iterable[PagePayload]]:
        if self._is_pdf(source_name):
            return self._expand_pdf_payloads(source_name, data)
        if self._is_psd(source_name):
            return self._expand_psd_payload(source_name, data)
        if source_name.lower().endswith(".svg"):
            rendered = self.svg_renderer.render(source_name, data)
            if not rendered.is_successful:
                return Result.failure(rendered.error)
            return Result.success(
                [self._build_single_payload(source_name, rendered.value)]
            )
        return Result.success([self._build_single_payload(source_name, data)])

    @staticmethod
    def _is_pdf(source_name: str) -> bool:
        return source_name.lower().endswith(".pdf")

    @staticmethod
    def _is_psd(source_name: str) -> bool:
        return source_name.lower().endswith(".psd")

    def _expand_pdf_payloads(
        self, source_name: str, data: bytes
    ) -> Result[Iterable[PagePayload]]:
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

    def _expand_psd_payload(
        self, source_name: str, data: bytes
    ) -> Result[Iterable[PagePayload]]:
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
