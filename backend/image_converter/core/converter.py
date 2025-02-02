import os
import pyheif
from PIL import Image
from typing import Optional, Dict, List
from backend.image_converter.infrastructure.logger import Logger


class ImageConverter:
    def __init__(self, quality: int = 85, width: Optional[int] = None, output_format: str = "JPEG", logger: Logger = None):
        """
        :param quality: Quality setting for JPEG output.
        :param width: Optional new width to resize the image.
        :param output_format: Output image format ("JPEG" or "PNG").
        :param logger: Logger instance.
        """
        self.quality = quality
        self.width = width
        self.output_format = output_format.upper()  # Normalize to uppercase
        self.logger = logger
        self.summary = []

    def convert(self, filename: str, source_folder: str, dest_folder: str) -> Dict:
        source_path = os.path.join(source_folder, filename)
        base_name, _ = os.path.splitext(filename)
        # Choose extension based on output format.
        if self.output_format == "PNG":
            dest_path = os.path.join(dest_folder, base_name + ".png")
        else:
            dest_path = os.path.join(dest_folder, base_name + ".jpg")

        result = {"file": filename}
        self.logger.log(f"Processing file: {source_path}", "debug")

        try:
            image = self.load_image(source_path, filename)
            original_width, original_height = image.size

            resized_width = None
            if self.width:
                image, resized_width = self.resize_image(image, original_width, original_height)

            if self.output_format == "JPEG":
                # For JPEG, composite any transparency over a white background.
                if image.mode in ("RGBA", "LA"):
                    background = Image.new("RGB", image.size, (255, 255, 255))
                    # Use the alpha channel as mask. For "RGBA", it's the 4th channel.
                    alpha = image.split()[-1]
                    background.paste(image, mask=alpha)
                    image = background
                image.save(dest_path, "JPEG", quality=self.quality)
            elif self.output_format == "PNG":
                # For PNG, preserve transparency if present.
                image.save(dest_path, "PNG")
            else:
                raise ValueError(f"Unsupported output format: {self.output_format}")

            self.logger.log(
                f"Converted: {source_path} -> {dest_path} (Format={self.output_format}, Q={self.quality}, W={resized_width or original_width})",
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

    def load_image(self, source_path: str, filename: str) -> Image.Image:
        ext = os.path.splitext(filename)[1]
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

        # Only convert to RGB if outputting as JPEG.
        if self.output_format == "JPEG" and image.mode in ("RGBA", "P"):
            image = image.convert("RGB")
            self.logger.log(f"Converted image mode to RGB for JPEG: {source_path}", "debug")

        return image

    def resize_image(self, image: Image.Image, original_width: int, original_height: int) -> (Image.Image, int):
        if original_width <= 0:
            raise ValueError("Original width must be greater than 0")

        ratio = self.width / float(original_width)
        new_height = int(original_height * ratio)
        image = image.resize((self.width, new_height), Image.Resampling.LANCZOS)
        self.logger.log(f"Resized image to width {self.width}", "debug")
        return image, self.width
