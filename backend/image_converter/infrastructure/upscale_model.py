"""The bundled AI upscaling model: where it lives and how it is checked.

The models are realesr-general-x4v3 and realesr-animevideov3 from Real-ESRGAN
(BSD-3-Clause, Xintao Wang), small SRVGGNetCompact networks suitable for CPU
inference. General is the default; the smaller anime model specializes in drawn
images and anime frames.

It is built during the Docker build, in a separate stage, by
scripts/build_upscale_model.py: the official .pth weights are downloaded from the
Real-ESRGAN GitHub release, their SHA-256 is checked before anything loads them,
they are loaded with torch.load(weights_only=True), and exported to ONNX. Only
the .onnx file (graph and weights, no code) and its checksum file reach the
runtime image; torch and the .pth stay in the build stage.

At runtime the app only reads the file from disk and never touches the network.
If the file is missing or does not match the checksum written next to it at
build time, upscaling is reported as unavailable.

Outside Docker (local development, the CLI on a bare host) run
``python scripts/build_upscale_model.py ~/.imgcompress/models`` once; it needs
torch and onnx, see the script.
"""

import hashlib
import os
from functools import lru_cache
from pathlib import Path

from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.domain.upscaling import UpscaleModel

MODEL_NAME = UpscaleModel.GENERAL.model_name
MODEL_FILENAME = UpscaleModel.GENERAL.filename
# Written by scripts/build_upscale_model.py in sha256sum format.
CHECKSUM_SUFFIX = ".sha256"

# Directory that holds the model files, set in the Dockerfile. Mirrors
# U2NET_HOME for rembg.
MODEL_HOME_ENV = "IMGCOMPRESS_MODEL_HOME"
_DEFAULT_MODEL_HOME = Path.home() / ".imgcompress" / "models"


def model_home() -> Path:
    configured = os.environ.get(MODEL_HOME_ENV, "").strip()
    return Path(configured) if configured else _DEFAULT_MODEL_HOME


def model_path(filename: str = MODEL_FILENAME) -> Path:
    return model_home() / filename


def locate_model(filename: str = MODEL_FILENAME) -> Result[Path]:
    """
    Returns the path of the model file if it is installed and intact. Never
    downloads anything.
    """
    path = model_path(filename)
    checksum_path = path.with_name(path.name + CHECKSUM_SUFFIX)
    if not path.is_file():
        return Result.failure(
            f"The AI upscaling model ({Path(filename).stem}) is not installed at {path}. "
            "It ships with the Docker image; outside Docker run "
            "'python scripts/build_upscale_model.py' once."
        )
    try:
        expected = checksum_path.read_text(encoding="utf-8").split()[0].strip().lower()
    except (OSError, IndexError):
        return Result.failure(
            f"The AI upscaling model at {path} has no checksum file ({checksum_path.name}). "
            "Build it with 'python scripts/build_upscale_model.py'."
        )
    stat = path.stat()
    if _sha256_of(str(path), stat.st_size, stat.st_mtime_ns) != expected:
        return Result.failure(
            f"The AI upscaling model at {path} does not match its checksum. "
            "Delete it and build it again."
        )
    return Result.success(path)


@lru_cache(maxsize=4)
def _sha256_of(path: str, size: int, mtime_ns: int) -> str:
    # size and mtime are part of the cache key so a replaced file is re-hashed.
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
