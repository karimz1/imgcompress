import argparse

def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments for the image conversion script."""
    parser = argparse.ArgumentParser(
        description="Convert images to JPEG (optionally resizing to given width)."
    )
    parser.add_argument(
        "source",
        help="Source file or folder containing images to convert"
    )
    parser.add_argument(
        "destination",
        help="Destination folder to store output JPEG images"
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=85,
        help="JPEG quality (default: 85)"
    )
    parser.add_argument(
        "--width",
        type=int,
        default=None,
        help="Optional width for resizing (height auto-calculated)"
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging"
    )
    parser.add_argument(
        "--json-output",
        action="store_true",
        help="Output logs in JSON format"
    )
    return parser.parse_args()