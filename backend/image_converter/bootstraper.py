import os
import subprocess
import traceback

import pillow_heif

from backend.image_converter.argument_parser import parse_arguments
from backend.image_converter.config import settings
from backend.image_converter.config.app_config import WebConfig
from backend.image_converter.core.enums.runtime_mode import RuntimeMode
from backend.image_converter.infrastructure.logger import (
    Logger,
    enable_error_capture_in_docker_env,
)
from backend.image_converter.presentation.cli.app import main as cli_main
from backend.image_converter.presentation.web.server import start_scheduler


def launch_web_prod(web: WebConfig) -> None:
    start_scheduler()
    workers = web.workers.resolve(fallback_when_auto=os.cpu_count() or 1)
    web_server_process = subprocess.Popen(
        [
            "granian",
            "--interface", "wsgi",
            "--workers", str(workers),
            "--host", web.host,
            "--port", str(web.port),
            "backend.image_converter.presentation.web.server:app",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    assert web_server_process.stdout is not None
    for line in web_server_process.stdout:
        # Verbatim relay: granian's child stdout is already formatted (its own
        # timestamp, level, worker id). Forward unchanged so the parent's
        # TeeStream captures one line per granian line in the log file. Do
        # NOT wrap with Logger — that would prepend a second timestamp and
        # ANSI colors, polluting both the log file and `docker logs`.
        print(line, end="")
    exit_code = web_server_process.wait()
    if exit_code != 0:
        raise subprocess.CalledProcessError(exit_code, web_server_process.args)


def main() -> None:
    config = settings.get()
    enable_error_capture_in_docker_env()
    pillow_heif.register_heif_opener()
    mode, remaining = parse_arguments()

    if mode is RuntimeMode.CLI:
        cli_main(remaining)
    elif mode is RuntimeMode.WEB:
        Logger(debug=False, json_output=False).log("started using mode: web")
        launch_web_prod(config.web)
    else:
        raise ValueError(f"unhandled runtime mode: {mode!r}")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:
        tb_list = traceback.extract_tb(exc.__traceback__)
        last_frame = tb_list[-1]
        message = (
            f"Exception occurred in file {last_frame.filename} "
            f"at line {last_frame.lineno}"
        )
        trace = traceback.format_exc()
        fatal_logger = Logger(debug=False, json_output=False)
        fatal_logger.log(message, "error")
        fatal_logger.log(trace, "error")
