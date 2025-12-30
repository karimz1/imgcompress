import sys
import os
import pytest
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.enums.image_format import ImageFormat
from unittest.mock import MagicMock

def test_rembg_is_lazy_loaded(monkeypatch):
    from backend.image_converter.core.factory.converter_factory import ImageConverterFactory
    from backend.image_converter.core.factory import rembg_png_converter
    
    assert not hasattr(rembg_png_converter, "new_session")
    monkeypatch.delitem(sys.modules, "rembg", raising=False)
    assert "rembg" not in sys.modules
    
    logger = Logger(debug=False)
    converter = ImageConverterFactory.create_converter(
        ImageFormat.PNG, 80, logger, use_rembg=True
    )
    
    assert "rembg" not in sys.modules
    monkeypatch.setitem(sys.modules, "rembg", MagicMock())
    
    converter._get_session()
    assert "rembg" in sys.modules
    
def test_pdfium_is_lazy_loaded(monkeypatch):
    from backend.image_converter.infrastructure.pdf_page_extractor import PdfPageExtractor
    import backend.image_converter.infrastructure.pdf_page_extractor as pdf_mod
    assert not hasattr(pdf_mod, "pdfium")
    
    monkeypatch.delitem(sys.modules, "pypdfium2", raising=False)
    
    extractor = PdfPageExtractor()
    assert "pypdfium2" not in sys.modules
    monkeypatch.setitem(sys.modules, "pypdfium2", MagicMock())
    extractor.rasterize_pages(b"data")
    
    assert "pypdfium2" in sys.modules

def test_psd_tools_is_lazy_loaded(monkeypatch):
    from backend.image_converter.infrastructure.psd_renderer import PsdRenderer
    import backend.image_converter.infrastructure.psd_renderer as psd_mod
    assert not hasattr(psd_mod, "PSDImage")
    
    monkeypatch.delitem(sys.modules, "psd_tools", raising=False)
    
    renderer = PsdRenderer(Logger(False))
    assert "psd_tools" not in sys.modules
    
    monkeypatch.setitem(sys.modules, "psd_tools", MagicMock())
    renderer.render("test.psd", b"data")
    
    assert "psd_tools" in sys.modules
