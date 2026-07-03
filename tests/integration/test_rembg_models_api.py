"""HTTP API e2e test: every selectable rembg model removes the background.

For each model in the configured allowlist this test:

  1. POSTs the sample photo to /api/compress on the running app container
     with `use_rembg=true` and `rembg_model=<model>` (the same fields the web
     UI sends).
  2. Downloads the converted PNG via /api/download.
  3. Asserts the output is a real transparent PNG cutout (a mix of transparent
     and opaque pixels, not a uniform mask).

Because it runs against the shipped `latest` image every model is already baked
into the container (`/container/.u2net`), so it runs fully offline with no
weight downloads. It requires the app container to be running and reachable at
$IMGCOMPRESS_API_BASE (defaults to http://localhost:5000). The CI job
`test-unverified-formats-api` brings the container up before invoking pytest, so
this file is excluded from the plain integration run (see
scripts/runIntegrationTests.sh).
"""

from __future__ import annotations

import io
import json
import os
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import pytest
from PIL import Image

from backend.image_converter.core.internals.rembg_config import load_rembg_available_models


API_BASE = os.environ.get("IMGCOMPRESS_API_BASE", "http://localhost:5000")
API_TIMEOUT_SECONDS = 180
HEALTH_TIMEOUT_SECONDS = 180

# Defense-in-depth: this test only makes sense against a running app container.
# The container e2e CI job (and scripts/runRembgModelMatrix.sh) explicitly set
# IMGCOMPRESS_API_BASE; when it is absent we skip rather than fail, so a stray
# `pytest tests/integration` never breaks on a missing container.
pytestmark = pytest.mark.skipif(
    os.environ.get("IMGCOMPRESS_API_BASE") is None,
    reason="container e2e: set IMGCOMPRESS_API_BASE to run against a running app container",
)

_SAMPLE_IMAGE = (
    Path(__file__).resolve().parent / ".." / "sample-images" / "pexels-pealdesign-28594392.jpg"
)


def _post_compress(file_path: Path, fields: dict) -> tuple[int, object]:
    """POST a single file plus form fields to /api/compress as multipart."""
    boundary = "----imgcompresstest" + secrets.token_hex(8)
    body = io.BytesIO()

    body.write(f"--{boundary}\r\n".encode())
    body.write(
        f'Content-Disposition: form-data; name="files[]"; filename="{file_path.name}"\r\n'.encode()
    )
    body.write(b"Content-Type: application/octet-stream\r\n\r\n")
    body.write(file_path.read_bytes())
    body.write(b"\r\n")

    for name, value in fields.items():
        body.write(f"--{boundary}\r\n".encode())
        body.write(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        body.write(str(value).encode())
        body.write(b"\r\n")

    body.write(f"--{boundary}--\r\n".encode())

    req = urllib.request.Request(
        f"{API_BASE}/api/compress", data=body.getvalue(), method="POST"
    )
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    try:
        with urllib.request.urlopen(req, timeout=API_TIMEOUT_SECONDS) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")


def _download_converted_file(dest_folder: str, file_name: str) -> bytes:
    url = (
        f"{API_BASE}/api/download?"
        f"folder={urllib.parse.quote(dest_folder)}&file={urllib.parse.quote(file_name)}"
    )
    with urllib.request.urlopen(url, timeout=API_TIMEOUT_SECONDS) as resp:
        return resp.read()


def _wait_for_health(deadline_s: int) -> bool:
    end = time.monotonic() + deadline_s
    while time.monotonic() < end:
        try:
            with urllib.request.urlopen(f"{API_BASE}/api/health/backend", timeout=3) as resp:
                if resp.status == 200:
                    return True
        except (urllib.error.URLError, urllib.error.HTTPError, ConnectionError, OSError):
            pass
        time.sleep(2)
    return False


@pytest.fixture(scope="module")
def app_is_ready() -> None:
    if not _wait_for_health(HEALTH_TIMEOUT_SECONDS):
        pytest.fail(
            f"App at {API_BASE} did not become healthy within "
            f"{HEALTH_TIMEOUT_SECONDS}s. Is the container running?"
        )


@pytest.mark.parametrize("model", load_rembg_available_models())
def test_model_removes_background_via_api(app_is_ready, model):
    status, payload = _post_compress(
        _SAMPLE_IMAGE,
        {"format": "png", "quality": "80", "use_rembg": "true", "rembg_model": model},
    )
    if status != 200:
        pytest.fail(f"{model} -> /api/compress returned HTTP {status}: {payload!r}")

    assert isinstance(payload, dict), f"{model} -> non-JSON response: {payload!r}"
    converted = payload.get("converted_files") or []
    assert converted, f"{model} -> no converted_files: {payload!r}"
    # Background-removed outputs are tagged so downloads are identifiable.
    assert converted[0].endswith("_ai-bg-removed.png"), (
        f"{model} -> expected an _ai-bg-removed.png output, got {converted[0]!r}"
    )

    png_bytes = _download_converted_file(payload["dest_folder"], converted[0])
    assert png_bytes, f"{model} -> downloaded PNG was empty"

    with Image.open(io.BytesIO(png_bytes)) as out_img:
        assert out_img.format == "PNG", f"{model} -> expected PNG, got {out_img.format!r}"
        assert out_img.mode == "RGBA", f"{model} -> expected an alpha channel"
        alpha = list(out_img.getchannel("A").getdata())
        # A real cutout leaves some pixels transparent and some opaque.
        assert min(alpha) < 255, f"{model} -> nothing was made transparent"
        assert max(alpha) > 0, f"{model} -> everything was made transparent"
