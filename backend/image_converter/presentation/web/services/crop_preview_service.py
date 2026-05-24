import time
import uuid
from io import BytesIO
from pathlib import Path
from typing import Callable, Iterable, Optional

from PIL import Image, UnidentifiedImageError

from backend.image_converter.core.internals.utilities import Result


class CropPreviewService:
    _PERMANENT_ERROR_TYPES = (UnidentifiedImageError,)

    def __init__(
        self,
        logger,
        payload_expander,
        unsupported_extensions: Iterable[str],
        max_attempts: int,
    ):
        self.logger = logger
        self.payload_expander = payload_expander
        self.max_attempts = max_attempts
        self.unsupported_extensions = frozenset(
            extension.strip().lower()
            for extension in unsupported_extensions
        )

    def get_unsupported_extensions(self) -> list[str]:
        return sorted(self.unsupported_extensions)

    def build_preview(
        self,
        filename: str,
        raw_bytes: bytes,
        request_id: Optional[str] = None,
    ) -> Result[BytesIO]:
        return self._build(filename, lambda: raw_bytes, len(raw_bytes), request_id)

    def build_preview_from_file(
        self,
        filename: str,
        file_path: str,
        request_id: Optional[str] = None,
    ) -> Result[BytesIO]:
        path = Path(file_path).resolve(strict=True)
        return self._build(filename, path.read_bytes, path.stat().st_size, request_id)

    def _build(
        self,
        filename: str,
        load_bytes: Callable[[], bytes],
        byte_count: int,
        request_id: Optional[str],
    ) -> Result[BytesIO]:
        rid = request_id or uuid.uuid4().hex[:8]
        if self._is_unsupported(filename):
            self._log(rid, f"rejected unsupported extension for '{filename}'")
            return Result.failure("This format is not compatible with the crop editor.")

        for attempt in range(1, self.max_attempts + 1):
            try:
                self._log(
                    rid,
                    f"decoding '{filename}' ({byte_count} bytes), "
                    f"attempt {attempt}/{self.max_attempts}",
                )
                return Result.success(self._build_preview_png(filename, load_bytes()))
            except self._PERMANENT_ERROR_TYPES as exc:
                self._log(rid, f"permanent failure for '{filename}': {exc}", "error")
                return Result.failure("Could not decode this format for cropping.")
            except Exception as exc:
                self._log(
                    rid,
                    f"transient failure for '{filename}' "
                    f"(attempt {attempt}/{self.max_attempts}): {exc}",
                    "error",
                )
                if attempt < self.max_attempts:
                    time.sleep(0.25 * attempt)

        return Result.failure(
            "Could not decode this format for cropping "
            f"after {self.max_attempts} attempts."
        )

    def _build_preview_png(self, filename: str, raw_bytes: bytes) -> BytesIO:
        expanded = self.payload_expander.expand(filename, raw_bytes)
        if not expanded.is_successful:
            raise RuntimeError(expanded.error)

        first_payload = next(iter(expanded.value), None)
        if first_payload is None:
            raise RuntimeError("No content to render.")

        with Image.open(BytesIO(first_payload.data)) as img:
            img.load()
            normalized = self._normalize_image(img)
            buffer = BytesIO()
            normalized.save(buffer, format="PNG", optimize=False, compress_level=6)

        buffer.seek(0)
        return buffer

    def _normalize_image(self, img: Image.Image) -> Image.Image:
        """Detach the preview image from decoder state before writing PNG bytes."""
        if img.mode not in ("RGB", "RGBA", "L", "LA"):
            img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
        return Image.frombytes(img.mode, img.size, img.tobytes())

    def _is_unsupported(self, filename: str) -> bool:
        return Path(filename).suffix.lower() in self.unsupported_extensions

    def _log(self, request_id: str, message: str, level: str = "info"):
        self.logger.log(f"[crop-preview rid={request_id}] {message}", level)
