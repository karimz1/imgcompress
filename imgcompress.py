#!/usr/bin/env python3

import os
import sys
import argparse
import pyheif
from PIL import Image

SUPPORTED_EXTENSIONS = [
    ".heic", ".heif",
    ".jpg", ".jpeg",
    ".png", ".bmp",
    ".gif", ".tif", ".tiff",
    ".webp"
]

def convert_to_jpg(
    source_folder: str,
    dest_folder: str,
    quality: int = 85,
    width: int = None
):
    """
    Convert all supported images in source_folder to JPG in dest_folder,
    preserving aspect ratio. If width is provided, images are scaled 
    to that width; height is automatically calculated.
    """
    if not os.path.exists(dest_folder):
        os.makedirs(dest_folder, exist_ok=True)

    all_files = os.listdir(source_folder)
    supported_files = [
        f for f in all_files
        if os.path.splitext(f)[1].lower() in SUPPORTED_EXTENSIONS
    ]

    for filename in supported_files:
        source_path = os.path.join(source_folder, filename)
        ext = os.path.splitext(filename)[1].lower()
        base_name = os.path.splitext(filename)[0]
        dest_path = os.path.join(dest_folder, base_name + ".jpg")

        # Optional: skip if it's already a JPG or if output exists
        # if ext == ".jpg" and os.path.isfile(source_path):
        #     print(f"Skipping already-JPG file: {filename}")
        #     continue

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
            else:
                image = Image.open(source_path)

            # Convert to RGB if it's RGBA or Palette
            if image.mode in ("RGBA", "P"):
                image = image.convert("RGB")

            # If width is specified, preserve aspect ratio
            if width is not None:
                original_width, original_height = image.size
                if original_width > 0:
                    ratio = width / float(original_width)
                    new_height = int(original_height * ratio)
                    image = image.resize((width, new_height), Image.Resampling.LANCZOS)

            # Save as JPG
            image.save(dest_path, "JPEG", quality=quality)
            print(f"Converted: {source_path} -> {dest_path} (Q={quality}, W={width or 'original'})")
        except Exception as e:
            print(f"Error converting {source_path}: {e}")

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
