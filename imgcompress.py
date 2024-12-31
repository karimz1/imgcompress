#!/usr/bin/env python3

import os
import sys
import argparse
import pyheif
from PIL import Image
import logging


logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

SUPPORTED_EXTENSIONS = [
    ".heic", ".heif",
    ".jpg", ".jpeg",
    ".png", ".bmp",
    ".gif", ".tif", ".tiff",
    ".webp"
]

def convert_to_jpg(source_folder: str, dest_folder: str, quality: int = 85, width: int = None):
    logging.info(f"Starting conversion: {source_folder} -> {dest_folder} with quality={quality}, width={width}")
    if not os.path.exists(dest_folder):
        os.makedirs(dest_folder, exist_ok=True)
        logging.debug(f"Created destination folder: {dest_folder}")

    all_files = os.listdir(source_folder)
    supported_files = [
        f for f in all_files
        if os.path.splitext(f)[1].lower() in SUPPORTED_EXTENSIONS
    ]
    logging.debug(f"Found {len(supported_files)} supported files.")

    for filename in supported_files:
        source_path = os.path.join(source_folder, filename)
        ext = os.path.splitext(filename)[1].lower()
        base_name = os.path.splitext(filename)[0]
        dest_path = os.path.join(dest_folder, base_name + ".jpg")
        logging.debug(f"Processing file: {source_path}")

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
                logging.debug(f"Loaded HEIF image: {source_path}")
            else:
                image = Image.open(source_path)
                logging.debug(f"Loaded image: {source_path}")

            if image.mode in ("RGBA", "P"):
                image = image.convert("RGB")
                logging.debug(f"Converted image mode to RGB: {source_path}")

            if width is not None:
                original_width, original_height = image.size
                if original_width > 0:
                    ratio = width / float(original_width)
                    new_height = int(original_height * ratio)
                    image = image.resize((width, new_height), Image.Resampling.LANCZOS)
                    logging.debug(f"Resized image to width {width}: {source_path}")

            image.save(dest_path, "JPEG", quality=quality)
            logging.info(f"Converted: {source_path} -> {dest_path} (Q={quality}, W={width or 'original'})")
        except Exception as e:
            logging.error(f"Error converting {source_path}: {e}")
            sys.exit(1)

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

    args = parser.parse_args()

    convert_to_jpg(
        source_folder=args.source_folder,
        dest_folder=args.dest_folder,
        quality=args.quality,
        width=args.width,
    )

if __name__ == "__main__":
    main()
