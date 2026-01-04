import os
import shutil
import traceback
from typing import List, Optional
from werkzeug.utils import secure_filename

from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.application.compress_images_usecase import CompressImagesUseCase
from backend.image_converter.application.dtos import CompressRequest
from backend.image_converter.domain.units import TargetSize, to_bytes
from backend.image_converter.core.enums.image_format import ImageFormat

class CompressionService:
    def __init__(self, logger, use_case: CompressImagesUseCase, temp_folder_service):
        self.logger = logger
        self.use_case = use_case
        self.temp_folder_service = temp_folder_service

    def compress(self, form_data: dict) -> Result[dict]:
        files = form_data["uploaded_files"]
        fmt_res = ImageFormat.from_string_result(form_data["format"])
        if not fmt_res.is_successful:
            return Result.failure(fmt_res.error)
        fmt = fmt_res.value

        src: Optional[str] = None
        dst: Optional[str] = None
        dest_ready = False

        try:
            src = self.temp_folder_service.create_temp_dir(prefix="source_")
            dst = self.temp_folder_service.create_temp_dir(prefix="converted_")

            save_res = self._save_uploaded_files(files, src)
            if not save_res.is_successful:
                return Result.failure(f"Failed to save uploaded files: {save_res.error}")

            target: Optional[TargetSize] = None
            if form_data.get("target_size_kb"):
                target = TargetSize(bytes=to_bytes(float(form_data["target_size_kb"]), unit="KB", system="IEC"))

            req = CompressRequest(
                source_folder=src,
                dest_folder=dst,
                image_format=fmt,
                quality=form_data["quality"],
                width=form_data["width"],
                target_size=target,
                use_rembg=form_data.get("use_rembg", False),
            )

            result = self.use_case.execute(req)

            if not result.processed_files:
                return Result.failure(f"Image processing failed: {'; '.join(result.errors)}")

            converted = [f for f in os.listdir(dst) if os.path.isfile(os.path.join(dst, f))]
            if not converted:
                return Result.failure("No files were converted")

            dest_ready = True
            return Result.success({
                "converted_files": converted,
                "dest_folder": dst,
                "process_summary": result.to_summary(),
            })

        except Exception as exc:
            tb = traceback.format_exc()
            self.logger.log(f"Unexpected compression failure: {tb}", "error")
            return Result.failure(str(exc) or "Unexpected compression failure.")
        finally:
            if src:
                shutil.rmtree(src, ignore_errors=True)
            if dst and not dest_ready:
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
            tb = traceback.format_exc()
            self.logger.log(f"Failed saving upload: {tb}", "error")
            return Result.failure(tb)
