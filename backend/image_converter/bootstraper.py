import sys
import subprocess
from backend.image_converter.cli.convert_images import main as cli_main


def launch_web():
    subprocess.run([
        "python",
        "-m",
        "flask",
        "--app", "backend.image_converter.web_app.app",
        "run",
        "--host=0.0.0.0",
        "--port=5000"
    ], check=True)

def main():
    if len(sys.argv) > 1 and sys.argv[1].lower() == "web":
        launch_web()
        return
    cli_main()

if __name__ == "__main__":
    main()
