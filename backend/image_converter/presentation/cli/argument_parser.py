import argparse

def parse_arguments(argv=None) -> argparse.Namespace:
    """Parse command-line arguments for the image conversion script."""
    parser = argparse.ArgumentParser(
        description="Convert images to JPEG, PNG, AVIF, or PDF (optionally resizing to a given width)."
    )
    parser.add_argument(
        "source",
        help="Source file or folder containing images to convert"
    )
    parser.add_argument(
        "destination",
        help="Destination folder to store output images"
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
        "--format",
        type=str,
        choices=["jpeg", "png", "avif", "pdf"],
        default="jpeg",
        help="Output format: 'jpeg', 'png', 'avif', or 'pdf' (default: jpeg)"
    )
    parser.add_argument(
        "--pdf-preset",
        type=str,
        choices=[
            "original",
            "a4-auto",
            "a4-portrait",
            "a4-landscape",
            "letter-auto",
            "letter-portrait",
            "letter-landscape",
            "mobile-portrait",
            "mobile-landscape",
        ],
        default="original",
        help="PDF page preset (only used with --format pdf)."
    )
    parser.add_argument(
        "--pdf-scale",
        type=str,
        choices=["fit", "fill"],
        default="fit",
        help="PDF scale mode for presets: fit (letterbox) or fill (crop)."
    )
    parser.add_argument(
        "--pdf-margin-mm",
        type=float,
        default=10.0,
        help="PDF margin in millimeters for presets (default: 10)."
    )
    parser.add_argument(
        "--pdf-paginate",
        action="store_true",
        help="Split long images across multiple PDF pages (presets only)."
    )
    parser.add_argument(
        "--remove-background",
        action="store_true",
        help="Remove image background using local AI (works with --format png or --format avif)"
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
    return parser.parse_args(argv)
