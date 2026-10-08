"""The bundled AI upscaling model: where it comes from and where it lives.

Same approach as the rembg background-removal model: the file is downloaded
once while the Docker image is built, checked against a pinned SHA-256, and
copied into the image. At runtime the app only reads it from disk and never
touches the network; if the file is missing or does not match, upscaling is
reported as unavailable instead of being fetched.

Model: realesr-general-x4v3 from Real-ESRGAN (BSD-3-Clause, Xintao Wang).
It is the small SRVGGNetCompact network (about 1.2 M parameters, 4.9 MB) that
upstream recommends for general images, which keeps it practical on a CPU.
The ONNX file is an export of the official v0.2.5.0 weights
(realesr-general-x4v3.pth, sha256 8dc7edb9...6292), pinned to an exact Hugging
Face commit. scripts/verify_upscale_model.py re-checks that it matches the
official weights.

Run ``python -m backend.image_converter.infrastructure.upscale_model`` to
download it outside Docker (local development, the CLI on a bare host).
"""

import hashlib
import os
import sys
import tempfile
import urllib.request
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from backend.image_converter.core.internals.utilities import Result

# Directory that holds the model files, set in the Dockerfile. Mirrors
# U2NET_HOME for rembg.
MODEL_HOME_ENV = "IMGCOMPRESS_MODEL_HOME"
_DEFAULT_MODEL_HOME = Path.home() / ".imgcompress" / "models"


@dataclass(frozen=True)
class ModelSpec:
    name: str
    filename: str
    url: str
    sha256: str
    license: str


REALESR_GENERAL_X4V3 = ModelSpec(
    name="realesr-general-x4v3",
    filename="realesr-general-x4v3.onnx",
    url=(
        "https://huggingface.co/CoderViking/realesr-general-x4v3-onnx/resolve/"
        "c6a971706797c7502945a2b4c4274fce4900d4ab/realesr-general-x4v3.onnx"
    ),
    sha256="1940a93ee08283a0a7286183186357b1688fe9fa8ede74604b424586aaddf112",
    license="BSD-3-Clause (Real-ESRGAN, Xintao Wang)",
)

UPSCALE_MODEL = REALESR_GENERAL_X4V3


def model_home() -> Path:
    configured = os.environ.get(MODEL_HOME_ENV, "").strip()
    return Path(configured) if configured else _DEFAULT_MODEL_HOME


def model_path(spec: ModelSpec = UPSCALE_MODEL) -> Path:
    return model_home() / spec.filename


def locate_model(spec: ModelSpec = UPSCALE_MODEL) -> Result[Path]:
    """
    Returns the path of the verified model file. Never downloads anything.
    """
    path = model_path(spec)
    if not path.is_file():
        return Result.failure(
            f"The AI upscaling model ({spec.name}) is not installed at {path}. "
            "It ships with the Docker image; outside Docker run "
            "'python -m backend.image_converter.infrastructure.upscale_model' once."
        )
    stat = path.stat()
    if _sha256_of(str(path), stat.st_size, stat.st_mtime_ns) != spec.sha256:
        return Result.failure(
            f"The AI upscaling model at {path} does not match the expected checksum. "
            "Delete it and install it again."
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


def download_model(spec: ModelSpec = UPSCALE_MODEL, target_dir: Path | None = None) -> Path:
    """
    Build-time only: downloads the model, verifies the SHA-256, and moves it
    into place atomically. Raises on any mismatch so a bad file never lands.
    """
    target_dir = target_dir or model_home()
    target_dir.mkdir(parents=True, exist_ok=True)
    destination = target_dir / spec.filename

    if destination.is_file() and _sha256_file(destination) == spec.sha256:
        return destination

    fd, temp_name = tempfile.mkstemp(dir=target_dir, prefix=f".{spec.filename}.")
    try:
        digest = hashlib.sha256()
        with os.fdopen(fd, "wb") as out, urllib.request.urlopen(spec.url, timeout=60) as response:
            for chunk in iter(lambda: response.read(1024 * 1024), b""):
                digest.update(chunk)
                out.write(chunk)
        if digest.hexdigest() != spec.sha256:
            raise RuntimeError(
                f"Checksum mismatch for {spec.name}: expected {spec.sha256}, got {digest.hexdigest()}"
            )
        os.chmod(temp_name, 0o644)
        os.replace(temp_name, destination)
    finally:
        if os.path.exists(temp_name):
            os.remove(temp_name)
    return destination


def _sha256_file(path: Path) -> str:
    stat = path.stat()
    return _sha256_of(str(path), stat.st_size, stat.st_mtime_ns)


if __name__ == "__main__":
    downloaded = download_model(target_dir=Path(sys.argv[1]) if len(sys.argv) > 1 else None)
    print(f"upscaling model ready: {UPSCALE_MODEL.name} -> {downloaded}")
