import os
import shutil
import time
import traceback
from typing import Optional

from werkzeug.utils import secure_filename

from backend.image_converter.application.compress_images_usecase import CompressImagesUseCase
from backend.image_converter.application.dtos import (
    CompressionFormData,
    CompressionResponse,
    CompressResult,
    CompressRequest,
)
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.domain.pdf_presets import (
    normalize_pdf_preset,
    normalize_pdf_scale,
    resolve_pdf_preset,
    resolve_pdf_scale,
)
from backend.image_converter.domain.units import TargetSize, to_bytes


class CompressionService:
    def __init__(
        self,
        logger,
        use_case: CompressImagesUseCase,
        temp_folder_service,
        rembg_available_models: list[str] | None = None,
    ):
        self.logger = logger
        self.use_case = use_case
        self.temp_folder_service = temp_folder_service
        self.rembg_available_models = list(rembg_available_models or [])

    def create_all_files_zip(self, folder_param: str) -> Result[str]:
        folder_path = self.temp_folder_service.get_validated_path(folder_param)

        if not folder_path:
            return Result.failure("Invalid or unauthorized folder.")

        try:
            zip_name = f"converted_{int(time.time())}.zip"
            zip_path = os.path.join(self.temp_folder_service.temp_dir, zip_name)
            shutil.make_archive(zip_path[:-4], "zip", root_dir=folder_path)
            return Result.success(zip_name)
        except Exception:
            self.logger.log(f"ZIP creation error: {traceback.format_exc()}", "error")
            return Result.failure("Failed to create archive.")

    def compress(self, form_data: CompressionFormData) -> Result[CompressionResponse]:
        fmt = form_data.image_format

        pdf_preset = normalize_pdf_preset(form_data.pdf_preset)
        pdf_scale = normalize_pdf_scale(form_data.pdf_scale)
        pdf_margin_mm = form_data.pdf_margin_mm
        pdf_paginate = form_data.pdf_paginate
        if fmt == ImageFormat.PDF:
            preset_res = resolve_pdf_preset(pdf_preset)
            if not preset_res.is_successful:
                return Result.failure(preset_res.error)
            scale_res = resolve_pdf_scale(pdf_scale)
            if not scale_res.is_successful:
                return Result.failure(scale_res.error)
            if preset_res.value.size is None:
                pdf_preset = None
                pdf_margin_mm = None
                pdf_paginate = False
        else:
            pdf_preset = None
            pdf_scale = "fit"
            pdf_margin_mm = None
            pdf_paginate = False

        src: Optional[str] = None
        dst: Optional[str] = None
        dest_ready = False

        try:
            src = self.temp_folder_service.create_temp_dir(prefix="source_")
            dst = self.temp_folder_service.create_temp_dir(prefix="converted_")

            save_res = self._save_uploaded_files(form_data.uploaded_files, src)
            if not save_res.is_successful:
                return Result.failure(save_res.error)

            target: Optional[TargetSize] = None
            if form_data.target_size_kb:
                target = TargetSize(
                    bytes=to_bytes(float(form_data.target_size_kb), unit="KB", system="IEC")
                )

            req = CompressRequest(
                source_folder=src,
                dest_folder=dst,
                image_format=fmt,
                quality=form_data.quality,
                width=form_data.width,
                target_size=target,
                use_rembg=form_data.use_rembg,
                rembg_model=form_data.rembg_model,
                rembg_model_by_file=self._normalize_model_map(form_data.rembg_model_by_file),
                pdf_preset=pdf_preset,
                pdf_scale=pdf_scale,
                pdf_margin_mm=pdf_margin_mm,
                pdf_paginate=pdf_paginate,
            )

            result = self.use_case.execute(req)

            if not result.processed_files:
                return Result.failure(f"Image processing failed: {'; '.join(result.errors)}")

            converted = [f for f in os.listdir(dst) if os.path.isfile(os.path.join(dst, f))]
            if not converted:
                return Result.failure("No files were converted")

            dest_ready = True
            return Result.success(CompressionResponse(
                converted_files=converted,
                dest_folder=dst,
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
                shutil.rmtree(src, ignore_errors=True)
            if dst and not dest_ready:
                shutil.rmtree(dst, ignore_errors=True)

    def compare_rembg_models(
        self,
        form_data: CompressionFormData,
        requested_models: list[str] | None = None,
        dest_folder: str | None = None,
    ) -> Result[dict]:
        if form_data.image_format not in {ImageFormat.PNG, ImageFormat.AVIF}:
            return Result.failure("AI comparison only supports PNG or AVIF output.")
        if not self.rembg_available_models:
            return Result.failure("No AI background-removal models are configured.")

        model_names = requested_models or self.rembg_available_models
        unknown_models = [
            model_name
            for model_name in model_names
            if model_name not in self.rembg_available_models
        ]
        if unknown_models:
            return Result.failure(f"Unsupported AI model: {', '.join(unknown_models)}")

        src: Optional[str] = None
        dst: Optional[str] = None
        dest_ready = False
        created_dest = False

        try:
            src = self.temp_folder_service.create_temp_dir(prefix="source_")
            if dest_folder:
                dst = self.temp_folder_service.get_validated_path(dest_folder)
                if not dst:
                    return Result.failure("Invalid or expired AI comparison folder.")
                dest_ready = True
            else:
                dst = self.temp_folder_service.create_temp_dir(prefix="converted_")
                created_dest = True

            save_res = self._save_uploaded_files(form_data.uploaded_files, src)
            if not save_res.is_successful:
                return Result.failure(save_res.error)

            results: list[dict[str, str]] = []
            processed_files: list[str] = []
            errors: list[str] = []
            for model_name in model_names:
                req = CompressRequest(
                    source_folder=src,
                    dest_folder=dst,
                    image_format=form_data.image_format,
                    quality=form_data.quality,
                    width=form_data.width,
                    target_size=None,
                    use_rembg=True,
                    rembg_model=model_name,
                    output_name_suffix=model_name,
                )
                result = self.use_case.execute(req)
                processed_files.extend(result.processed_files)
                errors.extend(f"{model_name}: {err}" for err in result.errors)
                for file_name in result.processed_files:
                    results.append({"model": model_name, "file": file_name})

            if not results:
                return Result.failure(f"AI comparison failed: {'; '.join(errors)}")

            dest_ready = True
            return Result.success(
                {
                    "dest_folder": dst,
                    "results": results,
                    "process_summary": CompressResult(
                        processed_files=processed_files,
                        errors=errors,
                    ).to_json_dict(),
                }
            )

        except Exception:
            self.logger.log(
                f"Unexpected AI comparison failure: {traceback.format_exc()}",
                "error",
            )
            return Result.failure("Unexpected AI comparison failure.")
        finally:
            if src:
                shutil.rmtree(src, ignore_errors=True)
            if dst and created_dest and not dest_ready:
                shutil.rmtree(dst, ignore_errors=True)

    def _save_uploaded_files(self, files, folder: str) -> Result[None]:
        try:
            os.makedirs(folder, exist_ok=True)
            for file in files:
                name = secure_filename(file.filename or "upload")
                if not name:
                    continue
                path = os.path.join(folder, name)
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

    def _normalize_model_map(self, model_by_file: dict[str, str]) -> dict[str, str]:
        normalized: dict[str, str] = {}
        for file_name, model_name in model_by_file.items():
            safe_name = secure_filename(file_name or "")
            if not safe_name:
                continue
            normalized[safe_name] = model_name
        return normalized
