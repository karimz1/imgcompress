import os
import pyheif
from PIL import Image
from typing import Optional, Dict, List
from backend.image_converter.infrastructure.logger import Logger


class ImageConverter:
    def __init__(self, quality: int = 85, width: Optional[int] = None, logger: Logger = None):
        self.quality = quality
        self.width = width
        self.logger = logger
        self.summary = []

    def convert(self, filename: str, source_folder: str, dest_folder: str) -> Dict:
        source_path = os.path.join(source_folder, filename)
        base_name, ext = os.path.splitext(filename)
        dest_path = os.path.join(dest_folder, base_name + ".jpg")
        result = {"file": filename}

        self.logger.log(f"Processing file: {source_path}", "debug")

        try:
            image = self.load_image(source_path, ext)
            original_width, original_height = image.size

            resized_width = None
            if self.width:
                image, resized_width = self.resize_image(image, original_width, original_height)

            image.save(dest_path, "JPEG", quality=self.quality)
            self.logger.log(
                f"Converted: {source_path} -> {dest_path} (Q={self.quality}, W={resized_width or original_width})",
                "info"
            )

            result.update({
                "source": source_path,
                "destination": dest_path,
                "original_width": original_width,
                "resized_width": resized_width or original_width,
                "is_successful": True,
                "error": None
            })
        except Exception as e:
            self.logger.log(f"Error converting {source_path}: {e}", "error")
            result.update({
                "source": source_path,
                "destination": dest_path,
                "original_width": None,
                "resized_width": None,
                "is_successful": False,
                "error": str(e)
            })

        self.summary.append(result)
        return result

    def load_image(self, source_path: str, ext: str) -> Image.Image:
        if ext.lower() in [".heic", ".heif"]:
            heif_file = pyheif.read(source_path)
            image = Image.frombytes(
                heif_file.mode,
                heif_file.size,
                heif_file.data,
                "raw",
                heif_file.mode,
                heif_file.stride,
            )
            self.logger.log(f"Loaded HEIF image: {source_path}", "debug")
        else:
            image = Image.open(source_path)
            self.logger.log(f"Loaded image: {source_path}", "debug")

        if image.mode in ("RGBA", "P"):
            image = image.convert("RGB")
            self.logger.log(f"Converted image mode to RGB: {source_path}", "debug")

        return image

    def resize_image(self, image: Image.Image, original_width: int, original_height: int) -> (Image.Image, int):
        if original_width <= 0:
            raise ValueError("Original width must be greater than 0")

        ratio = self.width / float(original_width)
        new_height = int(original_height * ratio)
        image = image.resize((self.width, new_height), Image.Resampling.LANCZOS)
        self.logger.log(f"Resized image to width {self.width}", "debug")
        return image, self.width
