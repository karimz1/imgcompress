from io import BytesIO
import traceback
from typing import Any, List, Optional

import pypdfium2 as pdfium

from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.internals.utls import Result


class PdfPageExtractor:
    """
    Renders PDF byte streams into individual rasterized pages so they can be
    processed by the existing image pipeline.
    """

    def __init__(self, logger: Optional[Logger] = None, dpi: int = 300, image_format: str = "PNG"):
        self.logger = logger
        self.dpi = dpi
        self.image_format = image_format

    def rasterize_pages(self, pdf_bytes: bytes, source_hint: str = "") -> Result[List[bytes]]:
        """
        Convert the provided PDF bytes into a list of image-encoded page bytes.
        """
        document = None
        try:
            document = self._open_document(pdf_bytes)
            pages = self._render_document(document)
            return Result.success(pages)
        except Exception:
            tb = traceback.format_exc()
            self._log_failure(tb, source_hint)
            return Result.failure(tb)
        finally:
            if document is not None:
                document.close()

    def _open_document(self, pdf_bytes: bytes) -> pdfium.PdfDocument:
        document = pdfium.PdfDocument(pdf_bytes)
        if len(document) == 0:
            raise ValueError("PDF contains no renderable pages.")
        return document

    def _render_document(self, document: pdfium.PdfDocument) -> List[bytes]:
        scale = self._dpi_to_scale()
        rendered_pages: List[bytes] = []

        for page_index in range(len(document)):
            page = document[page_index]
            rendered_pages.append(self._render_single_page(page, scale))

        return rendered_pages

    def _render_single_page(self, page: Any, scale: float) -> bytes:
        buffer = BytesIO()
        try:
            pil_image = page.render(scale=scale).to_pil()
            pil_image.save(buffer, format=self.image_format)
            return buffer.getvalue()
        finally:
            buffer.close()
            page.close()

    def _dpi_to_scale(self) -> float:
        return self.dpi / 72.0

    def _log_failure(self, traceback_text: str, source_hint: str) -> None:
        if not self.logger:
            return
        hint = f" for '{source_hint}'" if source_hint else ""
        self.logger.log(f"PDF conversion failed{hint}: {traceback_text}", "error")
