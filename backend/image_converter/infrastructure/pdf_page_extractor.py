import math
import traceback
from io import BytesIO
from typing import Any, Optional

from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.infrastructure.logger import Logger


class PdfPageExtractor:
    """
    Renders PDF byte streams into individual rasterized pages so they can be
    processed by the existing image pipeline.
    """

    def __init__(
        self,
        logger: Optional[Logger] = None,
        dpi: int = 300,
        image_format: str = "PNG",
        max_render_pixels_per_page: int = 25_000_000,
    ):
        self.logger = logger
        self.dpi = dpi
        self.image_format = image_format
        self.max_render_pixels_per_page = max_render_pixels_per_page

    def rasterize_pages(self, pdf_bytes: bytes, source_hint: str = "") -> Result[Any]:
        """
        Convert the provided PDF bytes into a generator of image-encoded page bytes.
        """
        try:
            document = self._open_document(pdf_bytes)
            try:
                validation_error = self._validate_page_sizes(document)
            except Exception:
                document.close()
                raise
            if validation_error:
                document.close()
                return Result.failure(validation_error)

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
            self._log_failure(traceback.format_exc(), source_hint)
            return Result.failure("PDF could not be rendered.")

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

    def _validate_page_sizes(self, document: Any) -> Optional[str]:
        scale = self._dpi_to_scale()
        for page_index in range(len(document)):
            width, height = document.get_page_size(page_index)
            width_pixels = math.ceil(width * scale)
            height_pixels = math.ceil(height * scale)
            page_pixels = width_pixels * height_pixels
            if page_pixels > self.max_render_pixels_per_page:
                return (
                    f"PDF page {page_index + 1} exceeds the maximum allowed "
                    f"rendered pixel count ({self.max_render_pixels_per_page})."
                )

        return None

    def _log_failure(self, traceback_text: str, source_hint: str) -> None:
        if not self.logger:
            return
        hint = f" for '{source_hint}'" if source_hint else ""
        self.logger.log(f"PDF conversion failed{hint}: {traceback_text}", "error")
