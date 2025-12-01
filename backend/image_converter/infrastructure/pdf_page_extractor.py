from io import BytesIO
import traceback
from typing import List, Optional

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

    def extract_pages(self, data: bytes, source_hint: str = "") -> Result[List[bytes]]:
        """
        Convert the provided PDF bytes into a list of image-encoded page bytes.
        """
        doc = None
        try:
            doc = pdfium.PdfDocument(data)
            if len(doc) == 0:
                return Result.failure("PDF contains no renderable pages.")

            scale = self.dpi / 72.0
            rendered_pages: List[bytes] = []

            for page_index in range(len(doc)):
                page = doc[page_index]
                pil_image = page.render(scale=scale).to_pil()
                buffer = BytesIO()
                pil_image.save(buffer, format=self.image_format)
                rendered_pages.append(buffer.getvalue())
                buffer.close()
                page.close()

            return Result.success(rendered_pages)
        except Exception:
            tb = traceback.format_exc()
            if self.logger:
                hint = f" for '{source_hint}'" if source_hint else ""
                self.logger.log(f"PDF conversion failed{hint}: {tb}", "error")
            return Result.failure(tb)
        finally:
            if doc is not None:
                doc.close()
