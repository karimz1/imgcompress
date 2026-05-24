import logging
import os
import subprocess
import sys
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


def _granian_stdout_logger() -> logging.Logger:
    logger = logging.getLogger("backend.image_converter.granian")
    logger.handlers = []
    logger.propagate = False
    logger.setLevel(logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)

    return logger


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
    granian_logger = _granian_stdout_logger()
    for line in web_server_process.stdout:
        # Granian's child stdout is already formatted. Relay it through a
        # message-only logger so TeeStream still captures one unchanged line.
        granian_logger.info(line.rstrip("\n"))
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
