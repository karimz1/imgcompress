import argparse

from backend.image_converter.domain.upscaling import UpscaleModel, UpscaleTarget

def parse_arguments(argv=None) -> argparse.Namespace:
    """Parse command-line arguments for the image conversion script."""
    parser = argparse.ArgumentParser(
        description="Convert images to JPEG, PNG, AVIF, WebP, or PDF (optionally resizing to a given width)."
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
        help="JPEG, AVIF, and WebP quality (default: 85)"
    )
    parser.add_argument(
        "--width",
        type=int,
        default=None,
        help="Optional width for resizing (height auto-calculated)"
    )
    parser.add_argument(
        "--upscale",
        type=str,
        choices=[target.value for target in UpscaleTarget],
        default=None,
        help="Enlarge images with the bundled local AI model (runs on the CPU, no network). "
             "1080p, 4k, 6k, 8k and 16k fit the image into that frame, preserving the aspect ratio. "
             "Enlargement beyond 4x uses AI followed by Lanczos resizing. "
             "Replaces --width. Not available with --format pdf."
    )
    parser.add_argument(
        "--upscale-model",
        choices=[model.value for model in UpscaleModel],
        default=UpscaleModel.GENERAL.value,
        help="AI model for --upscale: general for photos, anime for drawn images (default: general).",
    )
    parser.add_argument(
        "--format",
        type=str,
        choices=["jpeg", "png", "avif", "webp", "pdf"],
        default="jpeg",
        help="Output format: 'jpeg', 'png', 'avif', 'webp', or 'pdf' (default: jpeg)"
    )
    parser.add_argument(
        "--webp-lossless",
        action="store_true",
        help="Encode WebP losslessly (only used with --format webp; --quality is ignored)."
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
        help="Remove image background using local AI (works with --format png, avif, or webp)"
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
