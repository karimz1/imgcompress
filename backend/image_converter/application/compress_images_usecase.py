from typing import Optional

from .dtos import CompressRequest, CompressResult
from backend.image_converter.domain.size_targeting import find_best_quality_under_target
from backend.image_converter.domain.units import TargetSize
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.application.file_payload_expander import FilePayloadExpander
from backend.image_converter.domain.pdf_presets import resolve_pdf_preset, resolve_pdf_scale, PdfPreset

class CompressImagesUseCase:
    def __init__(
        self,
        logger,
        resizer,
        converter_factory,
        storage,
        payload_expander: FilePayloadExpander,
    ):
        self.logger = logger
        self.resizer = resizer
        self.converter_factory = converter_factory
        self.storage = storage
        self.payload_expander = payload_expander

    def execute(self, req: CompressRequest) -> CompressResult:
        processed, errors = [], []
        new_ext = req.image_format.get_file_extension()
        pdf_preset: Optional[PdfPreset] = None
        pdf_scale = "fit"
        pdf_margin_mm = None
        pdf_paginate = False
        if req.image_format == ImageFormat.PDF and req.pdf_preset:
            preset_res = resolve_pdf_preset(req.pdf_preset)
            if not preset_res.is_successful:
                return CompressResult(processed_files=[], errors=[preset_res.error])
            if preset_res.value.size is not None:
                pdf_preset = preset_res.value
                pdf_margin_mm = req.pdf_margin_mm
                pdf_paginate = req.pdf_paginate

            scale_res = resolve_pdf_scale(req.pdf_scale)
            if not scale_res.is_successful:
                return CompressResult(processed_files=[], errors=[scale_res.error])
            pdf_scale = scale_res.value

        for item in self.storage.iter_files(req.source_folder):
            try:
                read_result = self.storage.read_bytes(item.path)
                if not read_result.is_successful:
                    raise ValueError(read_result.error)
                original = read_result.value

                expand_result = self.payload_expander.expand(item.name, original)
                if not expand_result.is_successful:
                    raise ValueError(expand_result.error)
                page_payloads = expand_result.value
            except Exception as e:
                errors.append(f"{item.name}: {e}")
                continue

            # page_payloads is now an iterable (generator for PDFs) to save memory
            for payload in page_payloads:
                dest_name = self._build_dest_name(item.stem, new_ext, payload.page_index)
                dest_path = self.storage.build_dest_path(req.dest_folder, dest_name)
                page_label = payload.label
                try:
                    if pdf_preset and req.image_format == ImageFormat.PDF:
                        data = payload.data
                    else:
                        data = self._resize_if_needed(payload.data, req.width)

                    if req.target_size and req.image_format in [ImageFormat.JPEG, ImageFormat.AVIF]:
                        target = TargetSize(req.target_size.bytes)
                        target_bytes = target.soft_limit

                        def encoder(q: int, d: bytes) -> bytes:
                            converter = self.converter_factory.create_converter(req.image_format, q, self.logger)
                            return converter.encode_to_bytes(d)

                        q, out, size = find_best_quality_under_target(encoder, data, target_bytes)

                        if not target.within_tolerance(len(out)):
                            self.logger.log(
                                f"{page_label}: best={q} still {len(out)} bytes over tolerance for {target.bytes}.",
                                "warn"
                            )

                        write_result = self.storage.write_bytes(dest_path, out)
                        if not write_result.is_successful:
                            errors.append(f"{page_label}: {write_result.error}")
                        else:
                            processed.append(dest_name)
                    else:
                        converter = self.converter_factory.create_converter(
                            req.image_format,
                            req.quality,
                            self.logger,
                            req.use_rembg,
                            pdf_preset=pdf_preset,
                            pdf_scale=pdf_scale,
                            pdf_margin_mm=pdf_margin_mm,
                            pdf_paginate=pdf_paginate,
                        )
                        result = converter.convert(
                            image_data=data,
                            source_path=item.path,
                            dest_path=dest_path
                        )
                        if not result.is_successful:
                            errors.append(f"{page_label}: {result.error}")
                        else:
                            processed.append(dest_name)
                except Exception as e:
                    errors.append(f"{page_label}: {e}")

        return CompressResult(processed_files=processed, errors=errors)

    def _resize_if_needed(self, data: bytes, width: Optional[int]) -> bytes:
        if width and width > 0:
            return self.resizer.resize_image(data, width)
        return data


    @staticmethod
    def _build_dest_name(stem: str, extension: str, page_index: Optional[int]) -> str:
        if page_index is None:
            return stem + extension
        return f"{stem}_page-{page_index}{extension}"
