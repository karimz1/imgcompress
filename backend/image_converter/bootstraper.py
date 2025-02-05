import sys
import subprocess

from backend.image_converter.presentation.web.app import start_scheduler
from backend.image_converter.presentation.cli.app import main as cli_main

def launch_web_prod():
    start_scheduler()
    subprocess.run([
        "gunicorn",
        "-w", "4",
        "-b", "0.0.0.0:5000",
        "backend.image_converter.presentation.web.app:app"  
    ], check=True)


def launch_web_dev():
    """
    Launch Flask's built-in dev server (not for production).
    """
    start_scheduler()
    subprocess.run([
        "python",
        "-m",
        "flask",
        "--app", "backend.image_converter.presentation.web.app",
        "run",
        "--host=0.0.0.0",
        "--port=5000"
    ], check=True)

def main():
    """
    If "web" is provided, run Gunicorn (production).
    If "web_dev" is provided, run the Flask dev server.
    Otherwise, run the CLI.
    """
    if len(sys.argv) > 1:
        mode = sys.argv[1].lower()
        if mode == "web":
            launch_web_prod()
            return
        elif mode == "web_dev":
            launch_web_dev()
            return

    # Default: run the CLI
    cli_main()

if __name__ == "__main__":
    main()
