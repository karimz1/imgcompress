"""docker-compose smoke test.

Validates that the literal docker-compose.yml shipped in the repo (the file
users copy-paste from the README) brings up a working stack: the port mapping
works, the environment variables propagate, /api/health/backend responds, and
/config/runtime.json reflects the env block.

Only the image reference is rewritten at test time so we exercise the locally
built `karimz1/imgcompress:local-test` instead of pulling :latest from Docker
Hub. The test port is also rewritten to avoid colliding with any service the
developer may already have on 3001.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

import pytest


PROJECT_ROOT = Path(__file__).resolve().parents[2]
COMPOSE_FILE = PROJECT_ROOT / "docker-compose.yml"
LOCAL_IMAGE = "karimz1/imgcompress:local-test"
TEST_HOST_PORT = int(os.environ.get("COMPOSE_SMOKE_HOST_PORT", "13001"))
HEALTH_TIMEOUT_SECONDS = 180
PROJECT_NAME = "imgcompress-compose-smoke"


def _docker_available() -> bool:
    return shutil.which("docker") is not None


def _image_exists(tag: str) -> bool:
    return (
        subprocess.run(
            ["docker", "image", "inspect", tag],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        ).returncode
        == 0
    )


def _http_get(url: str, timeout: float = 5.0) -> tuple[int, str]:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace") if e.fp else ""


def _wait_for_health(base_url: str, deadline_s: int) -> bool:
    end = time.monotonic() + deadline_s
    while time.monotonic() < end:
        try:
            with urllib.request.urlopen(f"{base_url}/api/health/backend", timeout=3) as resp:
                if resp.status == 200:
                    return True
        except (urllib.error.URLError, urllib.error.HTTPError, ConnectionError, OSError):
            pass
        time.sleep(2)
    return False


@pytest.mark.skipif(not _docker_available(), reason="docker is not available")
class TestDockerComposeSmoke:
    @pytest.fixture
    def patched_compose(self, tmp_path):
        """Rewrite docker-compose.yml so it points at the local-test image and a
        non-conflicting host port; write to a temp file, hand the path to the
        test."""
        if not _image_exists(LOCAL_IMAGE):
            pytest.skip(
                f"{LOCAL_IMAGE} not present locally. "
                "Run the docker-image integration tests first or build the image."
            )

        src = COMPOSE_FILE.read_text()
        patched = re.sub(
            r"karimz1/imgcompress:[A-Za-z0-9_.\-]+",
            LOCAL_IMAGE,
            src,
        )
        patched = re.sub(
            r'"3001:5000"',
            f'"{TEST_HOST_PORT}:5000"',
            patched,
        )
        # Also rename the container so we don't clobber a real `imgcompress`
        # container the developer may have running.
        patched = re.sub(
            r"container_name:\s*imgcompress\b",
            "container_name: imgcompress_compose_smoke",
            patched,
        )

        target = tmp_path / "docker-compose.test.yml"
        target.write_text(patched)
        return target

    def _compose(self, compose_file: Path, *args: str) -> subprocess.CompletedProcess:
        cmd = ["docker", "compose", "-p", PROJECT_NAME, "-f", str(compose_file), *args]
        print("compose cmd:", " ".join(cmd))
        return subprocess.run(cmd, check=False, capture_output=True, text=True)

    def test_compose_up_serves_health_and_runtime_config(self, patched_compose):
        """Up the stack, hit health + runtime.json, validate that the env block
        in docker-compose.yml routes through to the frontend's runtime config."""
        try:
            up = self._compose(patched_compose, "up", "-d")
            assert up.returncode == 0, (
                f"docker compose up failed: stdout={up.stdout!r} stderr={up.stderr!r}"
            )

            base_url = f"http://localhost:{TEST_HOST_PORT}"
            healthy = _wait_for_health(base_url, HEALTH_TIMEOUT_SECONDS)
            if not healthy:
                logs = self._compose(patched_compose, "logs", "--tail", "200")
                pytest.fail(
                    f"Backend never became healthy on {base_url} "
                    f"within {HEALTH_TIMEOUT_SECONDS}s.\n"
                    f"compose logs:\n{logs.stdout}\n{logs.stderr}"
                )

            status, runtime_body = _http_get(f"{base_url}/config/runtime.json")
            assert status == 200, f"/config/runtime.json returned {status}: {runtime_body!r}"
            runtime = json.loads(runtime_body)
            # docker-compose.yml ships both flags as "false" by default — the
            # values a fresh user copying the file would get.
            assert runtime.get("DISABLE_LOGO") == "false", runtime
            assert runtime.get("DISABLE_STORAGE_MANAGEMENT") == "false", runtime
        finally:
            down = self._compose(patched_compose, "down", "-v", "--remove-orphans")
            print("compose down stdout:", down.stdout)
            print("compose down stderr:", down.stderr)
