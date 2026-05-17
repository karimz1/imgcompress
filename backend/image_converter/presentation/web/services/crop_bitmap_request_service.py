import os
import shutil
import tempfile
from dataclasses import dataclass
from io import BytesIO
from typing import Optional


@dataclass(frozen=True)
class CropBitmapResponse:
    value: Optional[BytesIO]
    error: Optional[str]
    status_code: int

    @property
    def is_successful(self) -> bool:
        return self.error is None


class CropBitmapRequestService:
    """Spools crop preview uploads to disk before invoking preview generation."""

    def __init__(self, preview_service, temp_dir: str):
        self.preview_service = preview_service
        self.temp_dir = temp_dir

    def build(self, files) -> CropBitmapResponse:
        upload = files.get("file")
        if upload is None:
            return self._failure("No file uploaded.", 400)

        filename = (upload.filename or "").strip()
        if not filename:
            return self._failure("Empty file upload.", 400)

        temp_path = self._save_upload(upload)
        try:
            if os.path.getsize(temp_path) == 0:
                return self._failure("Uploaded file was empty.", 400)
            result = self.preview_service.build_preview_from_file(filename, temp_path)
        finally:
            self._remove(temp_path)

        if not result.is_successful:
            return self._failure(result.error, 415)
        return CropBitmapResponse(result.value, None, 200)

    def _save_upload(self, upload) -> str:
        fd, path = tempfile.mkstemp(
            prefix="imgcompress-crop-",
            suffix=".upload",
            dir=self.temp_dir,
        )
        try:
            with os.fdopen(fd, "wb") as out:
                shutil.copyfileobj(upload.stream, out)
        except Exception:
            self._remove(path)
            raise
        return path

    def _remove(self, path: str):
        try:
            os.remove(path)
        except FileNotFoundError:
            pass

    def _failure(self, message: str, status_code: int) -> CropBitmapResponse:
        return CropBitmapResponse(None, message, status_code)
