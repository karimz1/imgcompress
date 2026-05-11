import os
import subprocess
import traceback
import pillow_heif
from backend.image_converter.argument_parser import parse_arguments
from backend.image_converter.config import settings
from backend.image_converter.infrastructure.logger import (
    Logger,
    append_backend_log_line,
    enable_error_capture_in_docker_env,
)
from backend.image_converter.presentation.cli.app import main as cli_main
from backend.image_converter.presentation.web.server import start_scheduler

def launch_web_prod():
    start_scheduler()
    workers_setting = settings.web_workers()
    workers = os.cpu_count() or 1 if workers_setting == "auto" else workers_setting
    env = os.environ.copy()
    env["IMGCOMPRESS_PARENT_STDOUT_CAPTURE"] = "true"
    proc = subprocess.Popen([
        "granian",
        "--interface", "wsgi",
        "--workers", str(workers),
        "--host", settings.web_host(),
        "--port", str(settings.web_port()),
        "backend.image_converter.presentation.web.server:app"
    ], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1, env=env)
    assert proc.stdout is not None
    stdout_capture_installed = os.environ.get("IMGCOMPRESS_STDIO_CAPTURE_INSTALLED") == "true"
    for line in proc.stdout:
        print(line, end="")
        if not stdout_capture_installed:
            append_backend_log_line(line)
    exit_code = proc.wait()
    if exit_code != 0:
        raise subprocess.CalledProcessError(exit_code, proc.args)


def main():
    settings.validate_all()
    enable_error_capture_in_docker_env()
    app_logger = Logger(debug=False, json_output=False)
    pillow_heif.register_heif_opener()
    args, remaining = parse_arguments()

    if args.mode is None:
        args.mode = "web"

    app_logger.log(f"started using mode: {args.mode}")

    if args.mode == "cli":
        cli_main(remaining)
    elif args.mode == "web":
        launch_web_prod()
    else:
        raise ValueError(f"no argument that match was found for args.mode value: {args.mode}")



if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        tb_list = traceback.extract_tb(e.__traceback__)
        last_frame = tb_list[-1]
        message = f"Exception occurred in file {last_frame.filename} at line {last_frame.lineno}"
        trace = traceback.format_exc()
        append_backend_log_line(f"[ERROR] {message}")
        append_backend_log_line(trace)
        print(message)
        print(trace)
