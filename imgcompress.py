#!/usr/bin/env python3

import os
import sys
import argparse
import pyheif
from PIL import Image
import logging
import json

def setup_logging(debug: bool = False):
    logging_level = logging.DEBUG if debug else logging.INFO
    logging.basicConfig(
        level=logging_level,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )

def log_output(message: str, level: str = "info", json_output: bool = False, debug: bool = False, **kwargs):
    if json_output:
        if level == "debug" and not debug:
            return  # Skip debug messages in JSON output unless debug is enabled
        output = {"level": level, "message": message, **kwargs}
        print(json.dumps(output))
    else:
        if level == "debug":
            logging.debug(message)
        elif level == "info":
            logging.info(message)
        elif level == "warning":
            logging.warning(message)
        elif level == "error":
            logging.error(message)
        else:
            logging.info(message)

SUPPORTED_EXTENSIONS = [
    ".heic", ".heif",
    ".jpg", ".jpeg",
    ".png", ".bmp",
    ".gif", ".tif", ".tiff",
    ".webp"
]

def convert_to_jpg(source_folder: str, dest_folder: str, quality: int = 85, width: int = None, json_output: bool = False, debug: bool = False):
    log_output(f"Starting conversion: {source_folder} -> {dest_folder} with quality={quality}, width={width}", "info", json_output, debug=debug)
    if not os.path.exists(dest_folder):
        os.makedirs(dest_folder, exist_ok=True)
        log_output(f"Created destination folder: {dest_folder}", "debug", json_output, debug=debug)

    all_files = os.listdir(source_folder)
    supported_files = [
        f for f in all_files
        if os.path.splitext(f)[1].lower() in SUPPORTED_EXTENSIONS
    ]
    log_output(f"Found {len(supported_files)} supported files.", "debug", json_output, debug=debug)

    results = []

    for filename in supported_files:
        source_path = os.path.join(source_folder, filename)
        ext = os.path.splitext(filename)[1].lower()
        base_name = os.path.splitext(filename)[0]
        dest_path = os.path.join(dest_folder, base_name + ".jpg")
        log_output(f"Processing file: {source_path}", "debug", json_output, debug=debug)

        try:
            if ext in [".heic", ".heif"]:
                heif_file = pyheif.read(source_path)
                image = Image.frombytes(
                    heif_file.mode,
                    heif_file.size,
                    heif_file.data,
                    "raw",
                    heif_file.mode,
                    heif_file.stride,
                )
                log_output(f"Loaded HEIF image: {source_path}", "debug", json_output, debug=debug)
            else:
                image = Image.open(source_path)
                log_output(f"Loaded image: {source_path}", "debug", json_output, debug=debug)

            if image.mode in ("RGBA", "P"):
                image = image.convert("RGB")
                log_output(f"Converted image mode to RGB: {source_path}", "debug", json_output, debug=debug)

            original_width, original_height = image.size
            resized_width = None

            if width is not None:
                if original_width > 0:
                    ratio = width / float(original_width)
                    new_height = int(original_height * ratio)
                    image = image.resize((width, new_height), Image.Resampling.LANCZOS)
                    resized_width = width
                    log_output(f"Resized image to width {width}: {source_path}", "debug", json_output, debug=debug)

            image.save(dest_path, "JPEG", quality=quality)
            log_output(f"Converted: {source_path} -> {dest_path} (Q={quality}, W={resized_width or 'original'})", "info", json_output, debug=debug)
            results.append({"file": filename, "status": "success", "source": source_path, "destination": dest_path, "original_width": original_width, "resized_width": resized_width or original_width})
        except Exception as e:
            log_output(f"Error converting {source_path}: {e}", "error", json_output, debug=debug)
            results.append({"file": filename, "status": "failed", "source": source_path, "error": str(e)})

    error_count = sum(1 for result in results if result["status"] == "failed")
    summary = {
        "summary": results,
        "status": "success" if error_count == 0 else "failed",
        "errors": error_count
    }

    if json_output:
        print(json.dumps(summary, indent=4))
    else:
        log_output(f"Summary: {len(results)} files processed, {error_count} errors.", "info", json_output)
        for result in results:
            if result["status"] == "failed":
                log_output(f"Failed: {result['file']} - Error: {result['error']}", "error", json_output)


def main():
    parser = argparse.ArgumentParser(
        description="Convert images to JPEG (optionally resizing to given width)."
    )
    parser.add_argument("source_folder", help="Folder containing images to convert")
    parser.add_argument("dest_folder", help="Folder to store output JPEG images")
    parser.add_argument("--quality", type=int, default=85,
                        help="JPEG quality (default: 85)")
    parser.add_argument("--width", type=int, default=None,
                        help="Optional width for resizing (height auto-calculated)")
    parser.add_argument("--debug", action="store_true",
                        help="Enable debug logging")
    parser.add_argument("--json-output", action="store_true",
                        help="Output logs in JSON format")

    args = parser.parse_args()

    setup_logging(debug=args.debug)

    convert_to_jpg(
        source_folder=args.source_folder,
        dest_folder=args.dest_folder,
        quality=args.quality,
        width=args.width,
        json_output=args.json_output,
        debug=args.debug
    )

if __name__ == "__main__":
    main()
