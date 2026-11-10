"""Stateless page previews and PDF assembly without persisted workspace files.

Each request owns its streams and documents; no shared upload folder or token
is needed. Every source page is rendered to pixels before a fresh PDF is made.
"""

import base64
from contextlib import ExitStack, closing
from dataclasses import replace
from io import BytesIO
from math import ceil, isfinite, sqrt

from backend.image_converter.core.factory.pdf_converter import PdfConverter
from backend.image_converter.domain.pdf_workspace import PdfWorkspaceSettings
from backend.image_converter.infrastructure.editor_asset_store import open_limited
from backend.image_converter.infrastructure.pdf_ocr import PdfOcr, PdfOcrError
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.infrastructure.pdfium_lock import PDFIUM_LOCK

MAX_PAGES = 500


class PdfWorkspaceError(ValueError):
    pass


class PdfWorkspaceService:
    def __init__(self):
        self.ocr = PdfOcr()

    def preview(self, upload, page_index=None, options=None, max_side=1600):
        import pypdfium2 as pdfium

        self._require_upload(upload)
        if type(max_side) is not int or not 128 <= max_side <= 8192:
            raise PdfWorkspaceError("Preview size must be between 128 and 8192 pixels.")
        if page_index is not None and (type(page_index) is not int or page_index < 0):
            raise PdfWorkspaceError("Invalid page number.")
        with PDFIUM_LOCK, ExitStack() as stack:
            source_map = []
            document = self._open_source(upload, stack, pdfium, options, preview=page_index is None,
                                         source_map=source_map, detail_page=page_index, detail_side=max_side)
            count = len(document)
            if page_index is not None and (type(page_index) is not int or not 0 <= page_index < count):
                raise PdfWorkspaceError("Invalid page number.")
            indices = range(count) if page_index is None else [page_index]
            previews = []
            for index in indices:
                with closing(document[index]) as page:
                    width, height = page.get_size()
                    if not all(isfinite(side) and side > 0 for side in (width, height)):
                        raise PdfWorkspaceError("This document has an invalid page size.")
                    side = 360 if page_index is None else max_side
                    # Leave room for PDFium rounding each bitmap dimension up.
                    scale = min(side / max(width, height), sqrt((40_000_000 - 2 * side - 1) / (width * height)))
                    with closing(page.render(scale=scale)) as bitmap:
                        with bitmap.to_pil() as image:
                            with BytesIO() as buffer:
                                image.convert("RGB").save(buffer, format="JPEG", quality=85 if page_index is None else 95)
                                preview = base64.b64encode(buffer.getvalue()).decode("ascii")
                    previews.append({
                        **source_map[index],
                        "page": index,
                        "width": width,
                        "height": height,
                        "preview": "data:image/jpeg;base64," + preview,
                    })
            return {"pages": previews, "count": count}

    def merge(self, uploads, pages, options=None, ocr=False, language=None):
        import pypdfium2 as pdfium

        if not isinstance(pages, list) or not 1 <= len(pages) <= MAX_PAGES:
            raise PdfWorkspaceError(f"Select between 1 and {MAX_PAGES} pages.")
        # Validate the complete plan before decoding any uploaded files.
        for item in pages:
            if not isinstance(item, dict):
                raise PdfWorkspaceError("Invalid page selection.")
            source, index, rotation = item.get("source"), item.get("page"), item.get("rotation", 0)
            if (type(source) is not int or not 0 <= source < len(uploads)
                    or type(index) is not int or index < 0
                    or type(rotation) is not int or rotation not in (0, 90, 180, 270)):
                raise PdfWorkspaceError("Invalid page selection.")

        if ocr:
            status = self.ocr.status()
            if not status["available"]:
                raise PdfWorkspaceError("OCR is not installed. Install Tesseract and its language data, then try again.")
            if language not in status["languages"]:
                raise PdfWorkspaceError("Choose an installed OCR language.")

        with PDFIUM_LOCK, ExitStack() as stack:
            output = stack.enter_context(pdfium.PdfDocument.new())
            sources = {}
            for item in pages:
                source = item["source"]
                if source not in sources:
                    self._require_upload(uploads[source])
                    sources[source] = self._open_source(uploads[source], stack, pdfium, options)
                document = sources[source]
                index = item["page"]
                if index >= len(document):
                    raise PdfWorkspaceError("A selected page does not exist in its source file.")
                if ocr:
                    self._append_ocr_page(document, index, output, language, pdfium)
                else:
                    output.import_pages(document, pages=[index])
                rotation = item.get("rotation", 0)
                if rotation:
                    with closing(output[len(output) - 1]) as page:
                        page.set_rotation((page.get_rotation() + rotation) % 360)
            buffer = BytesIO()
            output.save(buffer)
            buffer.seek(0)
            return buffer

    @staticmethod
    def _require_upload(upload):
        if upload is None or not upload.filename:
            raise PdfWorkspaceError("Choose a PDF or image file.")

    @staticmethod
    def _open_source(upload, stack, pdfium, options=None, preview=False, source_map=None, detail_page=None, detail_side=None):
        options = options or PdfWorkspaceSettings()
        converter = PdfConverter(
            Logger(), pdf_preset=options.preset, pdf_scale=options.scale,
            pdf_margin_mm=options.margin_mm, pdf_paginate=options.paginate,
            pdf_quality=options.quality,
        )
        prepared = stack.enter_context(pdfium.PdfDocument.new())

        def output_geometry(width, height):
            page_w, page_h = options.preset.size or (width, height)
            if options.preset.size and options.preset.auto_rotate and (width > height) != (page_w > page_h):
                page_w, page_h = page_h, page_w
            margin = options.margin_mm * 72 / 25.4 if options.preset.size else 0
            if min(page_w, page_h) <= 2 * margin:
                raise PdfWorkspaceError("PDF margin is too large for the page size.")
            return page_w, page_h, page_w - 2 * margin, page_h - 2 * margin

        if detail_page is not None:
            # Viewer resolution is independent of the export quality setting.
            # Never downsample a detailed source back to the 96/220 DPI preset.
            converter.quality = replace(converter.quality, dpi=10000, jpeg_quality=95, original_max_dimension=None)

        def append_image(image, original_size, source_page=0):
            # Reject excessive pagination before the converter allocates pages.
            if options.paginate and options.preset.size:
                width, height = options.preset.size
                if options.preset.auto_rotate and (image.width > image.height) != (width > height):
                    width, height = height, width
                margin = options.margin_mm * 72 / 25.4
                inner_w, inner_h = width - 2 * margin, height - 2 * margin
                if inner_w <= 0 or inner_h <= 0:
                    raise PdfWorkspaceError("PDF margin is too large for the page size.")
                count = ceil(image.height * inner_w / (image.width * inner_h))
                if len(prepared) + count > MAX_PAGES:
                    raise PdfWorkspaceError(f"The output contains more than {MAX_PAGES} pages. Use fewer files or disable pagination.")
            try:
                data = converter.encode_image(image, original_size=original_size)
            except ValueError as error:
                raise PdfWorkspaceError(str(error)) from error
            with pdfium.PdfDocument(data) as page_pdf:
                if len(prepared) + len(page_pdf) > MAX_PAGES:
                    raise PdfWorkspaceError(f"The output contains more than {MAX_PAGES} pages.")
                prepared.import_pages(page_pdf)
                if source_map is not None:
                    source_map.extend({"source_page": source_page, "part": part} for part in range(len(page_pdf)))

        upload.stream.seek(0)
        if upload.filename.lower().endswith(".pdf"):
            try:
                document = stack.enter_context(pdfium.PdfDocument(upload.stream))
            except pdfium.PdfiumError as error:
                raise PdfWorkspaceError("Could not open this PDF. It may be damaged or password protected.") from error
            if not 1 <= len(document) <= MAX_PAGES:
                raise PdfWorkspaceError(f"Each source must contain between 1 and {MAX_PAGES} pages.")
            for index in range(len(document)):
                with closing(document[index]) as page:
                    width, height = page.get_size()
                    if not all(isfinite(side) and side > 0 for side in (width, height)):
                        raise PdfWorkspaceError("This document has an invalid page size.")
                    # Pagination must use the exact same pixel boundaries in preview and export.
                    dpi = min(options.quality.preset.dpi, 96) if preview and not options.paginate else options.quality.preset.dpi
                    scale = min(dpi / 72, 16000 / max(width, height), sqrt(40_000_000 / (width * height)))
                    if detail_page is not None:
                        page_w, page_h, inner_w, inner_h = output_geometry(width, height)
                        base_w, base_h = ceil(width * scale), ceil(height * scale)
                        count = ceil(base_h * inner_w / (base_w * inner_h)) if options.paginate and options.preset.size else 1
                        if len(prepared) + count > MAX_PAGES:
                            raise PdfWorkspaceError(f"The output contains more than {MAX_PAGES} pages.")
                        if not len(prepared) <= detail_page < len(prepared) + count:
                            # Preserve output indices cheaply; only rasterize the requested source sheet.
                            for part in range(count):
                                prepared.new_page(page_w, page_h).close()
                                if source_map is not None:
                                    source_map.append({"source_page": index, "part": part})
                            continue
                        # Integer multiples preserve pagination's original pixel boundaries.
                        if options.preset.size:
                            ratios = (inner_w / base_w, inner_h / base_h)
                            placement = inner_w / base_w if options.paginate else (max(ratios) if options.scale == "fill" else min(ratios))
                        else:
                            placement = min(page_w / base_w, page_h / base_h)
                        factor = max(1, ceil(detail_side / max(page_w, page_h) * placement))
                        factor = min(factor, max(1, int(min(16000 / max(base_w, base_h), sqrt(40_000_000 / (base_w * base_h))))))
                        with closing(page.render(scale=scale * factor, may_draw_forms=True)) as bitmap, bitmap.to_pil() as image:
                            with image.resize((base_w * factor, base_h * factor)) as aligned:
                                append_image(aligned, (width, height), source_page=index)
                        continue
                    with closing(page.render(scale=scale, may_draw_forms=True)) as bitmap, bitmap.to_pil() as image:
                        append_image(image, (width, height), source_page=index)
        else:
            result = open_limited(upload, "image")
            if not result.is_successful:
                raise PdfWorkspaceError(result.error)
            with result.value as image:
                size = image.size if options.apply_layout else (image.width * 0.75, image.height * 0.75)
                append_image(image, size)
        if not 1 <= len(prepared) <= MAX_PAGES:
            raise PdfWorkspaceError(f"Each source must contain between 1 and {MAX_PAGES} pages.")
        return prepared

    def _append_ocr_page(self, document, index, output, language, pdfium):
        # Only newly rendered pixels enter OCR. No source objects or metadata are reused.
        with closing(document[index]) as page:
            width, height = page.get_size()
            scale = min(300 / 72, 16000 / max(width, height), sqrt(40_000_000 / (width * height)))
            with closing(page.render(scale=scale)) as bitmap, bitmap.to_pil() as image:
                try:
                    data = self.ocr.recognize(image, language, dpi=max(1, round(scale * 72)))
                except PdfOcrError as error:
                    raise PdfWorkspaceError(str(error)) from error
        with pdfium.PdfDocument(data) as recognized:
            if len(recognized) != 1:
                raise PdfWorkspaceError("OCR returned an unexpected page count.")
            ocr_width, ocr_height = recognized.get_page_size(0)
            with closing(recognized.page_as_xobject(0, output)) as xobject, closing(output.new_page(width, height)) as page:
                obj = xobject.as_pageobject()
                obj.set_matrix(pdfium.PdfMatrix(a=width / ocr_width, d=height / ocr_height))
                page.insert_obj(obj)
                page.gen_content()
