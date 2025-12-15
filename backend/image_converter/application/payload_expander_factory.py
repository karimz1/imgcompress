from backend.image_converter.application.file_payload_expander import FilePayloadExpander
from backend.image_converter.infrastructure.pdf_page_extractor import PdfPageExtractor
from backend.image_converter.infrastructure.psd_renderer import PsdRenderer
from backend.image_converter.infrastructure.logger import Logger


def create_payload_expander(logger: Logger) -> FilePayloadExpander:
    pdf_extractor = PdfPageExtractor(logger=logger)
    psd_renderer = PsdRenderer(logger=logger)
    return FilePayloadExpander(pdf_extractor, psd_renderer)
