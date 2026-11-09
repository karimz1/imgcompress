from backend.image_converter.application.file_payload_expander import (
    FilePayloadExpander,
)
from backend.image_converter.config import settings
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.infrastructure.pdf_page_extractor import PdfPageExtractor
from backend.image_converter.infrastructure.psd_renderer import PsdRenderer


def create_payload_expander(logger: Logger) -> FilePayloadExpander:
    pdf_config = settings.get().pdf
    pdf_extractor = PdfPageExtractor(
        logger=logger,
        max_render_pixels_per_page=pdf_config.max_render_pixels_per_page,
    )
    psd_renderer = PsdRenderer(logger=logger)
    return FilePayloadExpander(pdf_extractor, psd_renderer)
