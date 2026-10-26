import os
import shutil
import tempfile
import traceback
import zipfile
from typing import IO, Optional

from werkzeug.utils import secure_filename

from backend.image_converter.application.compress_images_usecase import CompressImagesUseCase
from backend.image_converter.application.dtos import (
    CompressionFormData,
    CompressionResponse,
    CompressRequest,
)
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.domain.fit_to_size import FitMode, FitToSize
from backend.image_converter.domain.pdf_presets import (
    normalize_pdf_preset,
    normalize_pdf_scale,
    resolve_pdf_preset,
    resolve_pdf_scale,
)
from backend.image_converter.domain.pdf_quality import PdfQuality
from backend.image_converter.domain.units import TargetSize, to_bytes
from backend.image_converter.domain.upscaling import UpscaleModel, UpscaleTarget


# ZIPs up to this size stay in memory; larger ones spill to an unnamed temp
# file that disappears when the download is closed.
_ZIP_SPOOL_MAX_BYTES = 32 * 1024 * 1024


class CompressionService:
    def __init__(self, logger, use_case: CompressImagesUseCase, temp_folder_service):
        self.logger = logger
        self.use_case = use_case
        self.temp_folder_service = temp_folder_service

    def create_all_files_zip(self, folder_param: str) -> Result[IO[bytes]]:
        """
        Builds the ZIP of one result folder per request. It never gets a name
        in the shared temp dir, so parallel users cannot overwrite or guess it.
        """
        folder_path = self.temp_folder_service.get_validated_path(folder_param)

        if not folder_path:
            return Result.failure("Invalid or unauthorized folder.")

        archive = tempfile.SpooledTemporaryFile(
            max_size=_ZIP_SPOOL_MAX_BYTES, dir=self.temp_folder_service.temp_dir
        )
        try:
            with self.temp_folder_service.use_folder(folder_path):
                with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zf:
                    for name in sorted(os.listdir(folder_path)):
                        path = os.path.join(folder_path, name)
                        if os.path.isfile(path):
                            zf.write(path, arcname=name)
            archive.seek(0)
            return Result.success(archive)
        except Exception:
            archive.close()
            self.logger.log(f"ZIP creation error: {traceback.format_exc()}", "error")
            return Result.failure("Failed to create archive.")

    def compress(self, form_data: CompressionFormData) -> Result[CompressionResponse]:
        fmt = form_data.image_format

        pdf_preset = normalize_pdf_preset(form_data.pdf_preset)
        pdf_scale = normalize_pdf_scale(form_data.pdf_scale)
        pdf_margin_mm = form_data.pdf_margin_mm
        pdf_paginate = form_data.pdf_paginate
        pdf_quality = PdfQuality.default()
        if fmt == ImageFormat.PDF:
            preset_res = resolve_pdf_preset(pdf_preset)
            if not preset_res.is_successful:
                return Result.failure(preset_res.error)
            scale_res = resolve_pdf_scale(pdf_scale)
            if not scale_res.is_successful:
                return Result.failure(scale_res.error)
            quality_res = PdfQuality.from_string_result(form_data.pdf_quality)
            if not quality_res.is_successful:
                return Result.failure(quality_res.error)
            pdf_quality = quality_res.value
            if preset_res.value.size is None:
                pdf_preset = None
                pdf_margin_mm = None
                pdf_paginate = False
        else:
            pdf_preset = None
            pdf_scale = "fit"
            pdf_margin_mm = None
            pdf_paginate = False

        webp_lossless = fmt == ImageFormat.WEBP and form_data.webp_lossless
        if webp_lossless and form_data.target_size_kb:
            return Result.failure(
                "Lossless WebP cannot be combined with a max file size. "
                "Turn off lossless or remove the size limit."
            )
        upscale_res = UpscaleTarget.from_string_result(form_data.upscale)
        if not upscale_res.is_successful:
            return Result.failure(upscale_res.error)
        upscale = upscale_res.value
        if upscale and fmt == ImageFormat.PDF:
            return Result.failure("AI upscaling is not available for PDF output.")
        model_res = UpscaleModel.from_string_result(form_data.upscale_model)
        if not model_res.is_successful:
            return Result.failure(model_res.error)
        fit_res = FitToSize.from_strings_result(
            form_data.fit_width,
            form_data.fit_height,
            form_data.fit_mode,
            form_data.fit_anchor,
            form_data.fit_color,
            form_data.fit_scale,
            form_data.fit_x,
            form_data.fit_y,
        )
        if not fit_res.is_successful:
            return Result.failure(fit_res.error)
        fit = fit_res.value
        if fit and fit.mode == FitMode.IMAGE:
            return Result.failure(
                "A background image can only be chosen in the editor. Use blur, solid or transparent here."
            )
        if fit and fmt == ImageFormat.PDF:
            return Result.failure(
                "Fit to size is not available for PDF output. Use a PDF page preset instead."
            )

        src = None
        dst = None
        dest_ready = False

        try:
            # Both folders stay locked until the job ends, so no cleanup can
            # delete them while it runs.
            src = self.temp_folder_service.create_job_dir(prefix="source_")
            dst = self.temp_folder_service.create_job_dir(prefix="converted_")

            save_res = self._save_uploaded_files(form_data.uploaded_files, src.path)
            if not save_res.is_successful:
                return Result.failure(save_res.error)

            target: Optional[TargetSize] = None
            if form_data.target_size_kb:
                target = TargetSize(
                    bytes=to_bytes(float(form_data.target_size_kb), unit="KB", system="IEC")
                )

            req = CompressRequest(
                source_folder=src.path,
                dest_folder=dst.path,
                image_format=fmt,
                quality=form_data.quality,
                # Upscaling and fitting decide the output size, so a resize width would undo it.
                width=None if (upscale or fit) else form_data.width,
                target_size=target,
                use_rembg=form_data.use_rembg,
                pdf_preset=pdf_preset,
                pdf_scale=pdf_scale,
                pdf_margin_mm=pdf_margin_mm,
                pdf_paginate=pdf_paginate,
                pdf_quality=pdf_quality,
                webp_lossless=webp_lossless,
                upscale=upscale,
                upscale_model=model_res.value,
                fit=fit,
            )

            result = self.use_case.execute(req)

            if not result.processed_files:
                return Result.failure(f"Image processing failed: {'; '.join(result.errors)}")

            converted = [f for f in os.listdir(dst.path) if os.path.isfile(os.path.join(dst.path, f))]
            if not converted:
                return Result.failure("No files were converted")

            dest_ready = True
            return Result.success(CompressionResponse(
                converted_files=converted,
                dest_folder=dst.path,
                process_summary=result,
            ))

        except Exception:
            self.logger.log(
                f"Unexpected compression failure: {traceback.format_exc()}",
                "error",
            )
            return Result.failure("Unexpected compression failure.")
        finally:
            if src:
                shutil.rmtree(src.path, ignore_errors=True)
                src.release()
            if dst:
                if not dest_ready:
                    shutil.rmtree(dst.path, ignore_errors=True)
                dst.release()

    def _save_uploaded_files(self, files, folder: str) -> Result[None]:
        try:
            os.makedirs(folder, exist_ok=True)
            for index, file in enumerate(files, start=1):
                path = self._create_unique_file(folder, self._upload_name(file.filename, index))
                with open(path, "wb") as f:
                    while True:
                        chunk = file.stream.read(8192)
                        if not chunk:
                            break
                        f.write(chunk)
                self.logger.log(f"Saved file: {path}", "info")
            return Result.success(None)
        except Exception:
            self.logger.log(f"Failed saving upload: {traceback.format_exc()}", "error")
            return Result.failure("Failed to save uploaded files.")

    @staticmethod
    def _upload_name(filename: Optional[str], index: int) -> str:
        """
        secure_filename() drops non-ASCII characters, so "фото.png" would become
        "png" and lose its extension. Such names fall back to upload_<n>.<ext>.
        """
        original = filename or ""
        name = secure_filename(original)
        stem, extension = os.path.splitext(name)
        original_extension = os.path.splitext(original)[1]
        if stem and (extension or not original_extension):
            return name
        safe_extension = secure_filename(original_extension.lstrip("."))
        return f"upload_{index}.{safe_extension}" if safe_extension else f"upload_{index}"

    @staticmethod
    def _create_unique_file(folder: str, name: str) -> str:
        """Reserves ``name`` in ``folder``, adding _1, _2, ... when a file of the batch already has it."""
        stem, extension = os.path.splitext(name)
        candidate, counter = name, 0
        while True:
            path = os.path.join(folder, candidate)
            try:
                os.close(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o666))
                return path
            except FileExistsError:
                counter += 1
                candidate = f"{stem}_{counter}{extension}"
