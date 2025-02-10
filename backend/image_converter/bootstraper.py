import multiprocessing
import sys
import subprocess
from backend.image_converter.presentation.web.server import start_scheduler
from backend.image_converter.presentation.cli.app import main as cli_main
import pillow_heif



def get_workers_count(cpu_multiplier: int = 2, extra_workers: int = 1, min_workers: int = 1) -> int:
    """
    Calculate the recommended number of Gunicorn workers based on CPU count.

    The default formula is:
        workers = (cpu_multiplier * cpu_count) + extra_workers
    which defaults to:
        workers = (2 * cpu_count) + 1

    This formula is a common starting point for many applications. However, for
    CPU-bound tasks (like image processing), you might want to adjust the multiplier
    or even use a simpler strategy (e.g., one worker per CPU core).

    Parameters:
        cpu_multiplier (int): The factor to multiply the CPU count by. Default is 2.
        extra_workers (int): An extra number of workers to add after the multiplication. Default is 1.
        min_workers (int): Ensures that at least this many workers are returned. Default is 1.

    Returns:
        int: The recommended number of workers.
    """
    try:
        cpu_count = multiprocessing.cpu_count()
    except NotImplementedError:
        cpu_count = 1  # Fallback in case CPU count cannot be determined

    workers = (cpu_multiplier * cpu_count) + extra_workers
    return max(workers, min_workers)



def launch_web_prod():
    start_scheduler()
    subprocess.run([
        "gunicorn",
        "-w", str(get_workers_count()),
        "--timeout", "1800", #30Min 
        "-b", "0.0.0.0:5000",
        "backend.image_converter.presentation.web.server:app"  
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
        "--app", "backend.image_converter.presentation.web.server",
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

    pillow_heif.register_heif_opener()

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
