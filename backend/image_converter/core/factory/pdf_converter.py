from io import BytesIO
from tempfile import NamedTemporaryFile
import os
from PIL import Image, ImageOps
from fpdf import FPDF

from backend.image_converter.core.interfaces.base_converter import BaseImageConverter
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.domain.pdf_presets import PdfPreset


def _normalize_for_pdf(img: Image.Image) -> Image.Image:
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass

    if img.mode in ("RGBA", "LA"):
        background = Image.new("RGB", img.size, (255, 255, 255))
        alpha = img.getchannel("A")
        background.paste(img.convert("RGB"), mask=alpha)
        img = background
    elif img.mode != "RGB":
        img = img.convert("RGB")

    return img


class PdfConverter(BaseImageConverter):
    """Converts raw image bytes to a PDF with optional page presets."""

    def __init__(
        self,
        logger: Logger,
        pdf_preset: PdfPreset | None = None,
        pdf_scale: str = "fit",
        pdf_margin_mm: float | None = None,
        pdf_paginate: bool = False,
    ):
        super().__init__(logger)
        self.pdf_preset = pdf_preset
        self.pdf_scale = pdf_scale
        self.pdf_margin_mm = pdf_margin_mm
        self.pdf_paginate = pdf_paginate

    def encode_to_bytes(self, image_data: bytes) -> bytes:
        with Image.open(BytesIO(image_data)) as img:
            img = _normalize_for_pdf(img)
            if self.pdf_preset and self.pdf_preset.size:
                return self._encode_with_preset(img)
            return self._encode_original(img)

    def _encode_original(self, img: Image.Image) -> bytes:
        page_w, page_h = img.size
        pdf = FPDF(unit="pt", format=(page_w, page_h))
        pdf.add_page()
        return self._render_pdf(pdf, img, x=0, y=0, w=page_w, h=page_h)

    def _encode_with_preset(self, img: Image.Image) -> bytes:
        page_w, page_h = self.pdf_preset.size
        if self.pdf_preset.auto_rotate:
            img_is_landscape = img.width > img.height
            page_is_landscape = page_w > page_h
            if img_is_landscape != page_is_landscape:
                page_w, page_h = page_h, page_w

        margin_mm = self.pdf_margin_mm if self.pdf_margin_mm is not None else self.pdf_preset.margin_mm
        margin_pt = self._mm_to_pt(margin_mm)
        inner_w = page_w - (2 * margin_pt)
        inner_h = page_h - (2 * margin_pt)
        if inner_w <= 0 or inner_h <= 0:
            raise ValueError("PDF margin is too large for the page size.")

        if self.pdf_paginate:
            return self._encode_paginated(img, page_w, page_h, inner_w, inner_h, margin_pt)

        if self.pdf_scale == "fill":
            img = self._crop_to_aspect(img, inner_w / inner_h)
            target_w = inner_w
            target_h = inner_h
            offset_x = margin_pt
            offset_y = margin_pt
        else:
            scale = min(inner_w / img.width, inner_h / img.height)
            target_w = img.width * scale
            target_h = img.height * scale
            offset_x = margin_pt + (inner_w - target_w) / 2
            offset_y = margin_pt + (inner_h - target_h) / 2

        pdf = FPDF(unit="pt", format=(page_w, page_h))
        pdf.add_page()
        return self._render_pdf(pdf, img, x=offset_x, y=offset_y, w=target_w, h=target_h)

    def _encode_paginated(
        self,
        img: Image.Image,
        page_w: float,
        page_h: float,
        inner_w: float,
        inner_h: float,
        margin_pt: float,
    ) -> bytes:
        scale = inner_w / img.width
        if scale <= 0:
            raise ValueError("Invalid scale for PDF pagination.")
        slice_height_px = inner_h / scale
        if slice_height_px <= 0:
            raise ValueError("Invalid slice height for PDF pagination.")

        import math
        page_count = max(1, math.ceil(img.height / slice_height_px))
        pdf = FPDF(unit="pt", format=(page_w, page_h))

        for page_index in range(page_count):
            top_px = page_index * slice_height_px
            bottom_px = min((page_index + 1) * slice_height_px, img.height)
            top_i = int(round(top_px))
            bottom_i = int(round(bottom_px))
            if bottom_i <= top_i:
                continue
            slice_img = img.crop((0, top_i, img.width, bottom_i))
            target_h = (bottom_px - top_px) * scale

            pdf.add_page()
            self._render_pdf(
                pdf,
                slice_img,
                x=margin_pt,
                y=margin_pt,
                w=inner_w,
                h=target_h,
                return_bytes=False,
            )

        return self._output_pdf(pdf)

    def _render_pdf(
        self,
        pdf: FPDF,
        img: Image.Image,
        x: float,
        y: float,
        w: float,
        h: float,
        return_bytes: bool = True,
    ) -> bytes:
        tmp_path = None
        try:
            with NamedTemporaryFile(delete=False, suffix=".png") as tmp:
                tmp_path = tmp.name
                img.save(tmp, format="PNG")
            pdf.image(tmp_path, x=x, y=y, w=w, h=h)
            if return_bytes:
                return self._output_pdf(pdf)
            return b""
        finally:
            if tmp_path:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

    @staticmethod
    def _output_pdf(pdf: FPDF) -> bytes:
        output = pdf.output()
        if isinstance(output, (bytes, bytearray)):
            return bytes(output)
        return output.encode("latin-1")

    @staticmethod
    def _mm_to_pt(mm: float) -> float:
        return mm * 72.0 / 25.4

    @staticmethod
    def _crop_to_aspect(img: Image.Image, target_ratio: float) -> Image.Image:
        img_ratio = img.width / img.height
        if img_ratio > target_ratio:
            new_width = int(round(img.height * target_ratio))
            left = max(0, (img.width - new_width) // 2)
            return img.crop((left, 0, left + new_width, img.height))
        new_height = int(round(img.width / target_ratio))
        top = max(0, (img.height - new_height) // 2)
        return img.crop((0, top, img.width, top + new_height))
