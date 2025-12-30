from io import BytesIO
import traceback
from typing import Any, List, Optional

# import pypdfium2 as pdfium (Lazy loaded in _open_document)

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

    def rasterize_pages(self, pdf_bytes: bytes, source_hint: str = "") -> Result[Any]:
        """
        Convert the provided PDF bytes into a generator of image-encoded page bytes.
        """
        try:
            document = self._open_document(pdf_bytes)
            
            def page_generator():
                try:
                    scale = self._dpi_to_scale()
                    for page_index in range(len(document)):
                        page = document[page_index]
                        yield self._render_single_page(page, scale)
                finally:
                    document.close()
            
            return Result.success(page_generator())
        except Exception:
            tb = traceback.format_exc()
            self._log_failure(tb, source_hint)
            return Result.failure(tb)

    def _open_document(self, pdf_bytes: bytes) -> Any:
        import pypdfium2 as pdfium
        document = pdfium.PdfDocument(pdf_bytes)
        if len(document) == 0:
            raise ValueError("PDF contains no renderable pages.")
        return document

    def _render_single_page(self, page: Any, scale: float) -> bytes:
        try:
            pil_image = page.render(scale=scale).to_pil()
            with BytesIO() as buffer:
                pil_image.save(buffer, format=self.image_format)
                return buffer.getvalue()
        finally:
            page.close()

    def _dpi_to_scale(self) -> float:
        return self.dpi / 72.0

    def _log_failure(self, traceback_text: str, source_hint: str) -> None:
        if not self.logger:
            return
        hint = f" for '{source_hint}'" if source_hint else ""
        self.logger.log(f"PDF conversion failed{hint}: {traceback_text}", "error")
