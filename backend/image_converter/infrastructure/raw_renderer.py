import os
from io import BytesIO
from pathlib import Path

from PIL import Image

from backend.image_converter.core.internals.utilities import Result

# Camera RAW formats LibRaw decodes reliably. X3F (imported X3F-tools code with
# past CVEs) and the generic ".raw" extension are left out on purpose.
RAW_EXTENSIONS = frozenset(
    {
        ".3fr",
        ".arw",
        ".cr2",
        ".cr3",
        ".dng",
        ".erf",
        ".kdc",
        ".mrw",
        ".nef",
        ".nrw",
        ".orf",
        ".pef",
        ".raf",
        ".rw2",
        ".sr2",
        ".srf",
        ".srw",
    }
)


class RawImageTooLargeError(ValueError):
    """The RAW sensor image exceeds the configured megapixel limit."""


def is_raw_file(source_name: str) -> bool:
    return Path(source_name).suffix.lower() in RAW_EXTENSIONS


class RawRenderer:
    """Decode camera RAW uploads into 8-bit sRGB PNG payloads."""

    def __init__(self, logger=None):
        self.logger = logger

    def render(self, source_name: str, data: bytes) -> Result[bytes]:
        try:
            rawpy = self._import_rawpy()
        except ImportError:
            return Result.failure("rawpy is not installed; cannot process camera RAW files.")

        try:
            with rawpy.imread(BytesIO(data)) as raw:
                # Check the size before decoding: LibRaw allocates its working
                # buffers for the full sensor in postprocess().
                self._check_size(raw.sizes.width, raw.sizes.height)
                # LibRaw applies the camera orientation (sizes.flip) itself.
                rgb = raw.postprocess(
                    use_camera_wb=True,
                    output_color=rawpy.ColorSpace.sRGB,
                    output_bps=8,
                    demosaic_algorithm=rawpy.DemosaicAlgorithm.AHD,
                )
            # Built from pixels only, so no EXIF, XMP or ICC data is carried over.
            image = Image.fromarray(rgb)
            buffer = BytesIO()
            # An intermediate payload: fast compression keeps big sensors quick.
            image.save(buffer, format="PNG", compress_level=1)
            return Result.success(buffer.getvalue())
        except RawImageTooLargeError as exc:
            return Result.failure(str(exc))
        except Exception as exc:  # noqa: BLE001 - LibRaw errors cross a Result boundary.
            if self.logger:
                self.logger.log(f"Failed to decode RAW '{source_name}': {exc!r}", "error")
            return Result.failure("Camera RAW file could not be decoded.")

    @staticmethod
    def _import_rawpy():
        # LibRaw decodes with OpenMP. Its thread pool reads OMP_NUM_THREADS once,
        # when rawpy is first imported, so cap it like ONNX Runtime unless the
        # operator set it explicitly.
        if "OMP_NUM_THREADS" not in os.environ:
            from backend.image_converter.config import settings
            from backend.image_converter.infrastructure.ai_upscaler import (
                resolve_thread_count,
            )

            threads = resolve_thread_count(settings.get().upscaling.threads)
            os.environ["OMP_NUM_THREADS"] = str(threads)

        import rawpy

        return rawpy

    @staticmethod
    def _check_size(width: int, height: int) -> None:
        from backend.image_converter.config import settings

        limit_megapixels = settings.get().upscaling.max_output_megapixels
        if width * height > limit_megapixels * 1_000_000:
            raise RawImageTooLargeError(
                f"The RAW image is {width}x{height} and exceeds the "
                f"{limit_megapixels} MP limit."
            )
