import logging
import os
import sys
from collections import deque
from datetime import datetime, timezone
from threading import Lock

from colorama import Fore, Style

from backend.image_converter.config import settings

_LOG_FILE_LOCK = Lock()
_stdio_capture_installed = False


def get_backend_log_file_path() -> str:
    return settings.get().logging.backend_log_file


def append_backend_log_line(line: str):
    if not line:
        return
    ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with _LOG_FILE_LOCK:
        with open(get_backend_log_file_path(), "a", encoding="utf-8") as f:
            f.write(f"[{ts}] {line.rstrip()}\n")


class TeeStream:
    def __init__(self, wrapped, prefix: str = ""):
        self.wrapped = wrapped
        self.prefix = prefix

    def write(self, text: str):
        self.wrapped.write(text)
        self.wrapped.flush()
        for line in text.splitlines():
            if line.strip():
                append_backend_log_line(f"{self.prefix}{line}")

    def flush(self):
        self.wrapped.flush()


def enable_error_capture_in_docker_env() -> None:
    """Tee stdout/stderr into the backend log file.

    Called exactly once from the composition root (`bootstraper.main`). The
    process that calls this becomes the single writer to the log file —
    anything Python writes to stdout/stderr from this point on (including
    captured stdout of subprocess children that we relay through `print`) is
    appended to the log. Idempotent within a process via a module-level flag.
    """
    global _stdio_capture_installed
    if _stdio_capture_installed:
        return
    _stdio_capture_installed = True
    sys.stdout = TeeStream(sys.stdout)
    sys.stderr = TeeStream(sys.stderr, "[stderr] ")


def read_backend_log_file() -> str:
    path = get_backend_log_file_path()
    if not os.path.exists(path):
        return ""
    with _LOG_FILE_LOCK:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()


class Logger:
    def __init__(self, debug: bool = False, json_output: bool = False, buffer_size: int = 1000):
        self.debug = debug
        self.json_output = json_output
        self.logs = []
        self._buffer: deque[str] = deque(maxlen=buffer_size)
        self._buffer_lock = Lock()
        self._setup_logger()

    def _setup_logger(self):
        self.logger = logging.getLogger(__name__)
        self.logger.handlers = []
        self.logger.propagate = False
        self.logger.setLevel(logging.DEBUG if self.debug else logging.INFO)

        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter("%(message)s"))
        self.logger.addHandler(handler)

    def log(self, message: str, level: str = "info", **kwargs):
        if self._should_skip_debug(level):
            return
        self._record_to_buffer(message, level)
        if self.json_output:
            self._store_json_log(message, level, **kwargs)
        else:
            self._log_plain_text(message, level)

    def dump_buffer(self) -> str:
        with self._buffer_lock:
            return "\n".join(self._buffer)

    def _record_to_buffer(self, message: str, level: str):
        ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
        line = f"[{ts}] [{level.upper()}] {message}"
        with self._buffer_lock:
            self._buffer.append(line)

    def _should_skip_debug(self, level: str) -> bool:
        return level == "debug" and not self.debug

    def _store_json_log(self, message: str, level: str, **kwargs):
        log_entry = {"level": level, "message": message, **kwargs}
        self.logs.append(log_entry)

    def _log_plain_text(self, message: str, level: str):
        colored = self._colorize_message(message, level)
        if level == "debug":
            self.logger.debug(colored)
        elif level == "info":
            self.logger.info(colored)
        elif level == "warning":
            self.logger.warning(colored)
        elif level == "error":
            self.logger.error(colored)

    def _colorize_message(self, message: str, level: str) -> str:
        if level == "error":
            return f"{Fore.RED}{message}{Style.RESET_ALL}"
        if level == "info":
            return f"{Fore.GREEN}{message}{Style.RESET_ALL}"
        if level == "warning":
            return f"{Fore.YELLOW}{message}{Style.RESET_ALL}"
        if level == "debug":
            return f"{Fore.CYAN}{message}{Style.RESET_ALL}"
        return message
