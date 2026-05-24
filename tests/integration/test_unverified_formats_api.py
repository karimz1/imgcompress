"""HTTP API reader test for the "Other possible formats" surface.

For every extension the UI lists under "Other possible formats" (the long
tail of decoders Pillow's registry advertises but that no test has ever
exercised), this file:

  1. Synthesizes an input file using Pillow as a sample-file factory.
  2. POSTs it to /api/compress on the running app container — the same
     endpoint the web UI hits when a user drags a file in.
  3. Downloads the converted PNG via /api/download.
  4. Asserts the PNG exists, is a real PNG, and is not blank.

If Pillow has no writer for a given extension we cannot fabricate an
input — that format is skipped with a clear reason. This is not a writer
test for those extensions (imgcompress doesn't write to them); it is
strictly a reader contract: "given a file in this format, the API converts
it to a PNG, end of story."

Requires the app container to be running and reachable at
$IMGCOMPRESS_API_BASE (defaults to http://localhost:5000). The CI job
`test-unverified-formats-api` brings the container up before invoking
pytest.
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
from typing import Dict, Optional

import pytest
from PIL import Image, ImageDraw, ImageStat

# Single source of truth — pull both lists from the real backend modules so
# this test stays in sync automatically when either list is extended.
from backend.image_converter.core.internals.utilities import supported_extensions
from backend.image_converter.presentation.web.services.configuration_service import (
    ConfigurationService,
)


API_BASE = os.environ.get("IMGCOMPRESS_API_BASE", "http://localhost:5000")
API_TIMEOUT_SECONDS = 120
HEALTH_TIMEOUT_SECONDS = 180


_UNVERIFIED = sorted(
    set(supported_extensions) - set(ConfigurationService.get_verified_formats())
)

_EXPECTED_PILLOW_UNWRITABLE_FORMATS = frozenset(
    {
        ".bufr",
        ".cur",
        ".dcx",
        ".emf",
        ".fit",
        ".fits",
        ".flc",
        ".fli",
        ".ftc",
        ".ftu",
        ".gbr",
        ".grib",
        ".h5",
        ".hdf",
        ".iim",
        ".mpeg",
        ".mpg",
        ".pcd",
        ".pxr",
        ".ras",
        ".wmf",
        ".xpm",
    }
)
_MIN_SYNTHESIZABLE_FORMATS = 38


def _make_distinctive_image() -> Image.Image:
    """Plain RGB 256x256 image with strong color variation. Used purely as
    a sample-file factory — we are not asserting anything about the
    contents of the input file, only that the API can read it."""
    img = Image.new("RGB", (256, 256))
    px = img.load()
    for x in range(256):
        for y in range(256):
            px[x, y] = (
                (x * 3) % 256,
                (y * 5) % 256,
                ((x + y) * 2) % 256,
            )
    draw = ImageDraw.Draw(img)
    draw.rectangle([20, 20, 100, 100], outline=(0, 0, 0), width=4)
    draw.rectangle([30, 30, 90, 90], fill=(255, 255, 255))
    return img


def _try_save_in_modes(base: Image.Image, target: Path) -> bool:
    """Walk through pixel modes different writers require until one
    produces a non-empty file. Returns True iff input was successfully
    fabricated. Failure means Pillow has no writer — the test will skip."""
    candidates = [
        base,
        base.convert("RGBA"),
        base.convert("L"),
        base.convert("P"),
        base.convert("1"),
    ]
    for img in candidates:
        try:
            if target.exists():
                target.unlink()
            img.save(target)
        except Exception:
            continue
        if target.exists() and target.stat().st_size > 0:
            return True
    if target.exists():
        target.unlink()
    return False


def _post_compress(file_path: Path, output_format: str = "png", quality: int = 80):
    """POST a single file to /api/compress as multipart/form-data with the
    same field shape the web UI uses. Returns (status_code, parsed_json)."""
    boundary = "----imgcompresstest" + secrets.token_hex(8)
    body = io.BytesIO()

    body.write(f"--{boundary}\r\n".encode())
    body.write(
        f'Content-Disposition: form-data; name="files[]"; filename="{file_path.name}"\r\n'.encode()
    )
    body.write(b"Content-Type: application/octet-stream\r\n\r\n")
    body.write(file_path.read_bytes())
    body.write(b"\r\n")

    for field_name, field_value in (("format", output_format), ("quality", str(quality))):
        body.write(f"--{boundary}\r\n".encode())
        body.write(
            f'Content-Disposition: form-data; name="{field_name}"\r\n\r\n'.encode()
        )
        body.write(str(field_value).encode())
        body.write(b"\r\n")

    body.write(f"--{boundary}--\r\n".encode())

    req = urllib.request.Request(
        f"{API_BASE}/api/compress",
        data=body.getvalue(),
        method="POST",
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
            with urllib.request.urlopen(
                f"{API_BASE}/api/health/backend", timeout=3
            ) as resp:
                if resp.status == 200:
                    return True
        except (urllib.error.URLError, urllib.error.HTTPError, ConnectionError, OSError):
            pass
        time.sleep(2)
    return False


@pytest.fixture(scope="module")
def app_is_ready() -> None:
    """Block until /api/health/backend returns 200. The CI job that runs
    this test brings up the app container before invoking pytest, but
    container start-up isn't instantaneous."""
    if not _wait_for_health(HEALTH_TIMEOUT_SECONDS):
        pytest.fail(
            f"App at {API_BASE} did not become healthy within "
            f"{HEALTH_TIMEOUT_SECONDS}s. Is the container running?"
        )


@pytest.fixture(scope="module")
def synthesized_inputs(tmp_path_factory) -> Dict[str, Optional[Path]]:
    """Fabricate one input file per unverified extension. Returns a mapping
    of `.ext -> Path` for synthesizable formats, or `None` for read-only
    formats Pillow cannot write (only known gaps may skip)."""
    scratch = tmp_path_factory.mktemp("unverified-api-inputs")
    base = _make_distinctive_image()

    out: Dict[str, Optional[Path]] = {ext: None for ext in _UNVERIFIED}
    for ext in _UNVERIFIED:
        target = scratch / f"unverified_{ext.lstrip('.')}{ext}"
        if _try_save_in_modes(base, target):
            out[ext] = target

    unwritable = {ext for ext, path in out.items() if path is None}
    unexpected_unwritable = unwritable - _EXPECTED_PILLOW_UNWRITABLE_FORMATS
    assert not unexpected_unwritable, (
        "Only known Pillow-unwritable formats may skip. "
        f"Unexpected unwritable formats: {sorted(unexpected_unwritable)}"
    )

    synthesized_count = len(out) - len(unwritable)
    assert synthesized_count >= _MIN_SYNTHESIZABLE_FORMATS, (
        f"Expected at least {_MIN_SYNTHESIZABLE_FORMATS} unverified formats "
        f"to be API-tested, got {synthesized_count}. "
        f"Skipped formats: {sorted(unwritable)}"
    )
    return out


@pytest.mark.parametrize("ext", _UNVERIFIED)
def test_api_compress_accepts_unverified_format_and_returns_visible_png(
    app_is_ready, synthesized_inputs, ext
):
    """For each unverified input extension, the running container must
    accept the file at /api/compress and return a non-blank PNG."""
    file_path = synthesized_inputs[ext]
    if file_path is None:
        pytest.skip(
            f"Pillow has no writer for {ext} - cannot fabricate an input "
            "without a real fixture file."
        )

    status, payload = _post_compress(file_path, output_format="png", quality=80)
    if status != 200:
        pytest.fail(
            f"{ext} -> /api/compress returned HTTP {status}: "
            f"{payload!r}"
        )

    assert isinstance(payload, dict), f"{ext} -> non-JSON response: {payload!r}"
    assert payload.get("converted_files"), (
        f"{ext} -> response had no converted_files: {payload!r}"
    )
    assert payload.get("dest_folder"), (
        f"{ext} -> response had no dest_folder: {payload!r}"
    )

    converted_file = payload["converted_files"][0]
    dest_folder = payload["dest_folder"]

    try:
        png_bytes = _download_converted_file(dest_folder, converted_file)
    except urllib.error.HTTPError as e:
        pytest.fail(
            f"{ext} -> /api/download returned HTTP {e.code}: "
            f"{e.read().decode('utf-8', errors='replace')}"
        )

    assert png_bytes, f"{ext} -> downloaded PNG was empty"

    with Image.open(io.BytesIO(png_bytes)) as out_img:
        assert out_img.format and out_img.format.upper() == "PNG", (
            f"{ext} -> expected PNG, got format={out_img.format!r}"
        )
        assert out_img.width >= 8 and out_img.height >= 8, (
            f"{ext} -> implausibly small output: {out_img.width}x{out_img.height}"
        )

        stat = ImageStat.Stat(out_img.convert("RGB"))
        max_std = max(stat.stddev)
        assert max_std > 5.0, (
            f"{ext} -> output PNG looks blank/uniform "
            f"(per-channel stddev={stat.stddev})"
        )
