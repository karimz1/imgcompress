"""Local AI upscaling with the bundled Real-ESRGAN model on ONNX Runtime.

Everything runs inside the container: the model file comes from the image
(see upscale_model.py) and inference uses the onnxruntime package that rembg
already depends on. Nothing is sent anywhere.

CPU is the baseline. The official image ships the CPU build of onnxruntime and
that path always works; it is slower than a GPU but has bounded memory:

- The image is processed in tiles of _TILE x _TILE input pixels, each with a
  _PAD pixel border of real neighbouring pixels. The border is cropped away
  again, so tiles join without seams (32 px covers the network's receptive
  field; the result differs from a single full-image pass by at most one 8-bit
  level). Peak memory is a few hundred MB regardless of image size.
- Every tile is resized straight to its final position in the output, so the
  4x intermediate image is never held in full. Only the output itself (capped
  by max_output_megapixels) has to fit in memory.
- One image is upscaled at a time in the whole container (a thread lock plus
  a file lock shared by the Granian worker processes), so parallel requests
  queue instead of multiplying memory and CPU use.

If onnxruntime reports a GPU provider (a custom image with onnxruntime-gpu or
onnxruntime-directml), it is tried first; any failure to create a GPU session
or to run on it falls back to the CPU and stays there.
"""

import math
import os
import tempfile
import threading
from contextlib import contextmanager
from io import BytesIO
from pathlib import Path
from typing import Callable, Optional

import numpy as np
from PIL import Image, ImageOps

from backend.image_converter.domain.upscaling import MODEL_SCALE, UpscalePlan, UpscaleTarget, plan_upscale
from backend.image_converter.infrastructure.upscale_model import locate_model

_TILE = 256
_PAD = 32
# Optional GPU providers, in order of preference. CPU is always appended last.
_GPU_PROVIDERS = ("CUDAExecutionProvider", "DmlExecutionProvider")
_CPU_PROVIDER = "CPUExecutionProvider"
# Cap for automatic thread selection: beyond this the convolutions stop scaling
# well and the rest of the machine (other workers, the OS) starts to suffer.
_MAX_AUTO_THREADS = 8
# Log progress roughly this often (in tiles) for long jobs.
_PROGRESS_EVERY = 10

_inference_lock = threading.Lock()
_LOCK_FILE = Path(tempfile.gettempdir()) / "imgcompress-upscale.lock"


@contextmanager
def _exclusive_inference():
    """Serialises inference across threads and across worker processes."""
    with _inference_lock:
        try:
            import fcntl

            lock_file = open(_LOCK_FILE, "a")
        except (ImportError, OSError):
            # Not POSIX or no writable temp dir: the thread lock is all we have.
            yield
            return
        with lock_file:
            fcntl.flock(lock_file, fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(lock_file, fcntl.LOCK_UN)


def available_cpu_count() -> int:
    """
    CPUs this process may actually use: the scheduler affinity mask (cpusets)
    and, on cgroup v2, the container's CPU quota (docker --cpus). os.cpu_count()
    alone reports the host's CPUs and would oversubscribe a limited container.
    """
    try:
        count = len(os.sched_getaffinity(0))
    except (AttributeError, OSError):
        count = os.cpu_count() or 1
    try:
        limit = cgroup_cpu_limit(Path("/sys/fs/cgroup/cpu.max").read_text())
    except OSError:
        limit = None
    if limit is not None:
        count = min(count, limit)
    return max(1, count)


def cgroup_cpu_limit(cpu_max: str) -> Optional[int]:
    """Whole CPUs allowed by a cgroup v2 ``cpu.max`` line ("200000 100000" -> 2), or None."""
    try:
        quota, period = cpu_max.split()[:2]
        if quota == "max":
            return None
        return max(1, math.floor(int(quota) / int(period)))
    except ValueError:
        return None


def resolve_thread_count(configured: Optional[int]) -> int:
    if configured is not None and configured > 0:
        return configured
    return min(available_cpu_count(), _MAX_AUTO_THREADS)


class _OrtSession:
    """Process-wide ONNX Runtime session with GPU-to-CPU fallback."""

    _instance: Optional["_OrtSession"] = None
    _instance_lock = threading.Lock()

    def __init__(self, model_path: Path, threads: int, logger):
        import onnxruntime as ort

        self._ort = ort
        self._model_path = str(model_path)
        self._threads = threads
        self._logger = logger
        self._session = None
        self.providers: list[str] = []

        available = set(ort.get_available_providers())
        gpu = [name for name in _GPU_PROVIDERS if name in available]
        if gpu:
            try:
                self._session = self._create(gpu + [_CPU_PROVIDER])
            except Exception as exc:
                logger.log(f"AI upscaling: GPU provider unavailable ({exc}); using CPU.", "warning")
        if self._session is None:
            self._session = self._create([_CPU_PROVIDER])
        self.providers = list(self._session.get_providers())
        self.input_name = self._session.get_inputs()[0].name
        logger.log(
            f"AI upscaling: loaded {model_path.name} on {', '.join(self.providers)} with {threads} thread(s).",
            "info",
        )

    @classmethod
    def get(cls, model_path: Path, threads: int, logger) -> "_OrtSession":
        with cls._instance_lock:
            if cls._instance is None or cls._instance._model_path != str(model_path):
                cls._instance = cls(model_path, threads, logger)
            return cls._instance

    def _create(self, providers: list[str]):
        options = self._ort.SessionOptions()
        options.intra_op_num_threads = self._threads
        options.inter_op_num_threads = 1
        options.execution_mode = self._ort.ExecutionMode.ORT_SEQUENTIAL
        # Give memory back after each request instead of keeping a growing arena
        # per worker; the cost is negligible next to the convolutions.
        options.enable_cpu_mem_arena = False
        return self._ort.InferenceSession(self._model_path, options, providers=providers)

    def run(self, tile: np.ndarray) -> np.ndarray:
        try:
            return self._session.run(None, {self.input_name: tile})[0]
        except Exception as exc:
            if self.providers == [_CPU_PROVIDER]:
                raise
            self._logger.log(f"AI upscaling: GPU run failed ({exc}); switching to CPU.", "warning")
            self._session = self._create([_CPU_PROVIDER])
            self.providers = [_CPU_PROVIDER]
            return self._session.run(None, {self.input_name: tile})[0]


class AiUpscaler:
    """
    Upscales encoded image bytes and returns TIFF bytes, like ImageResizer, so
    the result can go through the normal converters.

    ``run_model`` is injectable for tests; it takes a float32 NCHW tile in
    [0, 1] and returns the 4x tile.
    """

    def __init__(
        self,
        logger,
        threads: Optional[int] = None,
        max_output_megapixels: int = 36,
        run_model: Optional[Callable[[np.ndarray], np.ndarray]] = None,
    ):
        self.logger = logger
        self.threads = resolve_thread_count(threads)
        self.max_output_pixels = max_output_megapixels * 1_000_000
        self._run_model = run_model

    def upscale(self, image_data: bytes, target: UpscaleTarget) -> Optional[bytes]:
        """
        Returns the upscaled image as TIFF bytes, or None when the image already
        meets the target (a frame target never shrinks an image). Raises
        ValueError with a user-facing message if the output would be too large
        or the model is not installed.
        """
        with Image.open(BytesIO(image_data)) as img:
            try:
                img = ImageOps.exif_transpose(img)
            except Exception:
                pass
            icc_profile = img.info.get("icc_profile")

            plan_res = plan_upscale(img.width, img.height, target, self.max_output_pixels)
            if not plan_res.is_successful:
                raise ValueError(plan_res.error)
            plan = plan_res.value
            if plan.is_noop:
                self.logger.log(
                    f"AI upscaling: {img.width}x{img.height} already meets {target.value}, left unchanged.",
                    "info",
                )
                return None
            result = self.upscale_image(img, plan)

            buffer = BytesIO()
            result.save(buffer, format="TIFF", icc_profile=icc_profile, compression="tiff_deflate")
            return buffer.getvalue()

    def upscale_image(self, img: Image.Image, plan: UpscalePlan) -> Image.Image:
        img = _to_8bit(img)
        has_alpha = img.mode in ("RGBA", "LA", "PA") or (img.mode == "P" and "transparency" in img.info)
        rgba = img.convert("RGBA") if has_alpha else None
        source = rgba if rgba is not None else img
        rgb = np.asarray(source.convert("RGB"), dtype=np.uint8)

        run_model = self._run_model or self._load_model()
        with _exclusive_inference():
            output = self._upscale_rgb(rgb, plan.output_size, run_model)
        result = Image.fromarray(output, "RGB")

        if rgba is not None:
            # The model only knows colour; alpha edges are smooth enough for Lanczos.
            alpha = rgba.getchannel("A").resize(plan.output_size, Image.Resampling.LANCZOS)
            result.putalpha(alpha)
        return result

    def _load_model(self) -> Callable[[np.ndarray], np.ndarray]:
        model_res = locate_model()
        if not model_res.is_successful:
            raise ValueError(model_res.error)
        return _OrtSession.get(model_res.value, self.threads, self.logger).run

    def _upscale_rgb(
        self,
        rgb: np.ndarray,
        output_size: tuple[int, int],
        run_model: Callable[[np.ndarray], np.ndarray],
    ) -> np.ndarray:
        height, width = rgb.shape[:2]
        out_width, out_height = output_size
        output = np.empty((out_height, out_width, 3), dtype=np.uint8)
        exact = (out_width, out_height) == (width * MODEL_SCALE, height * MODEL_SCALE)

        rows = list(_tile_starts(height))
        cols = list(_tile_starts(width))
        total = len(rows) * len(cols)
        done = 0
        for y0 in rows:
            y1 = min(y0 + _TILE, height)
            py0, py1 = max(0, y0 - _PAD), min(height, y1 + _PAD)
            for x0 in cols:
                x1 = min(x0 + _TILE, width)
                px0, px1 = max(0, x0 - _PAD), min(width, x1 + _PAD)

                tile = rgb[py0:py1, px0:px1].astype(np.float32).transpose(2, 0, 1)[None] / 255.0
                upscaled = run_model(np.ascontiguousarray(tile))[0]
                upscaled = (np.clip(upscaled, 0.0, 1.0) * 255.0 + 0.5).astype(np.uint8).transpose(1, 2, 0)

                if exact:
                    output[MODEL_SCALE * y0 : MODEL_SCALE * y1, MODEL_SCALE * x0 : MODEL_SCALE * x1] = upscaled[
                        MODEL_SCALE * (y0 - py0) : MODEL_SCALE * (y1 - py0),
                        MODEL_SCALE * (x0 - px0) : MODEL_SCALE * (x1 - px0),
                    ]
                else:
                    self._place_resized(output, upscaled, (x0, y0, x1, y1), (px0, py0), (width, height))

                done += 1
                if total > _PROGRESS_EVERY and (done % _PROGRESS_EVERY == 0 or done == total):
                    self.logger.log(f"AI upscaling: {done}/{total} tiles", "info")
        return output

    @staticmethod
    def _place_resized(
        output: np.ndarray,
        upscaled: np.ndarray,
        tile_box: tuple[int, int, int, int],
        padded_origin: tuple[int, int],
        source_size: tuple[int, int],
    ) -> None:
        """
        Resizes one 4x tile straight into its slot of the final output. Output
        pixel edges are computed from the whole image, so neighbouring tiles
        meet exactly, and the padding gives Lanczos the real neighbours it needs.
        """
        out_height, out_width = output.shape[:2]
        width, height = source_size
        x0, y0, x1, y1 = tile_box
        px0, py0 = padded_origin

        ox0, ox1 = round(x0 * out_width / width), round(x1 * out_width / width)
        oy0, oy1 = round(y0 * out_height / height), round(y1 * out_height / height)
        if ox1 <= ox0 or oy1 <= oy0:
            return

        # Output pixel edges in the coordinates of the padded 4x tile.
        step_x = MODEL_SCALE * width / out_width
        step_y = MODEL_SCALE * height / out_height
        box = (
            ox0 * step_x - MODEL_SCALE * px0,
            oy0 * step_y - MODEL_SCALE * py0,
            ox1 * step_x - MODEL_SCALE * px0,
            oy1 * step_y - MODEL_SCALE * py0,
        )
        piece = Image.fromarray(upscaled, "RGB").resize((ox1 - ox0, oy1 - oy0), Image.Resampling.LANCZOS, box=box)
        output[oy0:oy1, ox0:ox1] = np.asarray(piece)


def _tile_starts(length: int):
    return range(0, length, _TILE)


def _to_8bit(img: Image.Image) -> Image.Image:
    """Pillow clips 16-bit greyscale to white when converting to RGB."""
    if img.mode in ("I;16", "I;16L", "I;16B", "I"):
        return img.convert("I").point(lambda value: value * (1 / 256)).convert("L")
    return img
