"""Memory-conscious runtime wrapper for rembg model execution."""

from __future__ import annotations

import gc
import os
import re
import subprocess
import sys
import tempfile
from threading import Lock

from backend.image_converter.core.exceptions import ConversionError

_REMBG_RUNTIME_LOCK = Lock()
_MIB = 1024 * 1024
_CHILD_MEMORY_RESERVE_BYTES = 512 * _MIB
_ANSI_ESCAPE_RE = re.compile(r"\x1b\[[0-9;]*m")


def remove_background(
    image_data: bytes,
    model_name: str,
    *,
    post_process_mask: bool = True,
    alpha_matting: bool = False,
) -> bytes:
    """Run one rembg inference while keeping heavyweight model sessions bounded.

    rembg/onnxruntime sessions can hold a large amount of native memory. The AI
    editor compares several models, so keeping sessions cached across model runs
    is hostile to low-memory machines. A process-wide lock also prevents two web
    requests from loading separate models at the same time.
    """

    with _REMBG_RUNTIME_LOCK:
        return _remove_background_in_child(
            image_data,
            model_name,
            post_process_mask=post_process_mask,
            alpha_matting=alpha_matting,
        )


def remove_background_in_process(
    image_data: bytes,
    model_name: str,
    *,
    post_process_mask: bool = True,
    alpha_matting: bool = False,
) -> bytes:
    """Run rembg in the current process.

    This is used only by the short-lived worker process spawned by
    ``remove_background``. Keeping it separate also makes the worker easy to
    test without recursive subprocess spawning.
    """
    from rembg import new_session, remove

    session = None
    try:
        session = new_session(model_name)
        return remove(
            image_data,
            session=session,
            post_process_mask=post_process_mask,
            alpha_matting=alpha_matting,
        )
    finally:
        session = None
        gc.collect()


def _remove_background_in_child(
    image_data: bytes,
    model_name: str,
    *,
    post_process_mask: bool,
    alpha_matting: bool,
) -> bytes:
    with tempfile.TemporaryDirectory(prefix="imgcompress-rembg-") as temp_dir:
        input_path = os.path.join(temp_dir, "input.bin")
        output_path = os.path.join(temp_dir, "output.bin")
        with open(input_path, "wb") as input_file:
            input_file.write(image_data)

        command = [
            sys.executable,
            "-m",
            "backend.image_converter.core.internals.rembg_worker",
            "--model",
            model_name,
            "--input",
            input_path,
            "--output",
            output_path,
        ]
        if post_process_mask:
            command.append("--post-process-mask")
        if alpha_matting:
            command.append("--alpha-matting")

        completed = subprocess.run(
            command,
            check=False,
            capture_output=True,
            env=_build_child_env(),
            preexec_fn=_limit_child_memory,
            text=True,
        )
        if completed.returncode != 0:
            raise ConversionError(_build_child_failure_message(model_name, completed))

        with open(output_path, "rb") as output_file:
            return output_file.read()


def _build_child_env() -> dict[str, str]:
    env = os.environ.copy()
    env.setdefault("OMP_NUM_THREADS", "1")
    env.setdefault("OPENBLAS_NUM_THREADS", "1")
    env.setdefault("MKL_NUM_THREADS", "1")
    env.setdefault("NUMEXPR_NUM_THREADS", "1")
    env.setdefault("OMP_WAIT_POLICY", "PASSIVE")
    return env


def _build_child_failure_message(model_name: str, completed: subprocess.CompletedProcess) -> str:
    details = _ANSI_ESCAPE_RE.sub("", completed.stderr or completed.stdout or "")
    if "Failed to allocate memory" in details or "std::bad_alloc" in details:
        requested = _extract_requested_buffer_size(details)
        suffix = f" It failed while requesting another {requested}." if requested else ""
        return (
            f"{model_name} needs more RAM than this device currently has available."
            f"{suffix} Try a smaller image or a lighter model."
        )
    return (
        f"{model_name} could not run on this device. "
        "Try a smaller image or a lighter model."
    )


def _extract_requested_buffer_size(details: str) -> str | None:
    match = re.search(r"requested buffer of size (\d+)", details)
    if not match:
        return None
    size_bytes = int(match.group(1))
    if size_bytes >= _MIB:
        return f"{size_bytes / _MIB:.0f} MiB"
    return f"{size_bytes} bytes"


def _limit_child_memory() -> None:
    limit = _detect_cgroup_memory_limit()
    if limit is None or limit <= _CHILD_MEMORY_RESERVE_BYTES:
        return

    try:
        import resource

        child_limit = limit - _CHILD_MEMORY_RESERVE_BYTES
        resource.setrlimit(resource.RLIMIT_AS, (child_limit, child_limit))
    except Exception:
        return


def _detect_cgroup_memory_limit() -> int | None:
    for path in (
        "/sys/fs/cgroup/memory.max",
        "/sys/fs/cgroup/memory/memory.limit_in_bytes",
    ):
        try:
            raw = open(path, encoding="utf-8").read().strip()
        except OSError:
            continue
        if not raw or raw == "max":
            continue
        try:
            limit = int(raw)
        except ValueError:
            continue
        if limit > 0 and limit < (1 << 60):
            return limit
    return _detect_host_memory()


def _detect_host_memory() -> int | None:
    try:
        with open("/proc/meminfo", encoding="utf-8") as meminfo:
            for line in meminfo:
                key, _, value = line.partition(":")
                if key != "MemTotal":
                    continue
                amount, unit, *_rest = value.strip().split()
                if unit != "kB":
                    return None
                return int(amount) * 1024
    except (OSError, ValueError):
        return None
    return None
