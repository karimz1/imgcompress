import os
import subprocess
import traceback
import pillow_heif
from backend.image_converter.argument_parser import parse_arguments
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.presentation.cli.app import main as cli_main
from backend.image_converter.presentation.web.server import start_scheduler

def launch_web_prod():
    start_scheduler()
    workers_setting = os.environ.get("GRANIAN_WORKERS", "auto").strip().lower()
    if workers_setting == "auto":
        workers = os.cpu_count() or 1
    else:
        try:
            workers = max(int(workers_setting), 1)
        except ValueError:
            workers = os.cpu_count() or 1
    subprocess.run([
        "granian",
        "--interface", "wsgi",
        "--workers", str(workers),
        "--host", "0.0.0.0",
        "--port", "5000",
        "backend.image_converter.presentation.web.server:app"
    ], check=True)


def main():
    app_logger = Logger(debug=False, json_output=False)
    pillow_heif.register_heif_opener()
    args, remaining = parse_arguments()

    # fallback so defaults to web if no args are given...
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
        print(f"Exception occurred in file {last_frame.filename} at line {last_frame.lineno}")
        print(traceback.format_exc())
