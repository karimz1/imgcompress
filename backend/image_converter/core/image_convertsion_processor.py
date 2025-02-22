from typing import List, Dict, Optional
import os
import json

from PIL import Image
from io import BytesIO

from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.internals.file_manager import FileManager
from backend.image_converter.core.internals.image_loader import ImageLoader
from backend.image_converter.domain.image_resizer import ImageResizer
from backend.image_converter.core.factory.converter_factory import ImageConverterFactory
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.core.enums.conversion_error import ConversionError
from backend.image_converter.core.enums.log_level import LogLevel

class ImageConversionProcessor:
    def __init__(
        self,
        source: str,
        destination: str,
        image_format: ImageFormat,
        quality: int = 85,
        width: Optional[int] = None,
        debug: bool = False,
        json_output: bool = False
    ):
        self.source = source
        self.destination = destination
        self.image_format = image_format
        self.quality = quality
        self.width = width
        self.debug = debug
        self.json_output = json_output

        self.logger = Logger(debug=self.debug, json_output=self.json_output)
        self.file_manager = FileManager(self.source, self.destination, self.logger)
        self.image_loader = ImageLoader()
        self.image_resizer = ImageResizer()
        self.converter = ImageConverterFactory.create_converter(
            image_format=self.image_format,
            quality=self.quality,
            logger=self.logger
        )
        self.results: List[Dict] = []

    def run(self) -> None:
        """Entry point to process a file or directory."""
        if os.path.isfile(self.source):
            self._process_single_file(self.source)
        elif os.path.isdir(self.source):
            self._process_directory(self.source)
        else:
            raise ConversionError(
                f"Source path '{self.source}' is neither file nor directory."
            )

        summary = self.generate_summary()
        self.output_results(summary)

    def _process_single_file(self, file_path: str) -> None:
        """Process (load, resize if needed, convert) a single file."""
        self.logger.log(f"Processing single file: {file_path}", LogLevel.INFO.value)
        result = self._convert_file(file_path)
        self.results.append(result)

    def _process_directory(self, directory: str) -> None:
        """Process all supported files in a directory."""
        self.logger.log(f"Processing directory: {directory}", LogLevel.INFO.value)
        self.file_manager.ensure_destination()
        supported_files = self.file_manager.list_supported_files()

        for file_url in supported_files:
            path = file_url.path
            result = self._convert_file(path)
            self.results.append(result)

    def _convert_file(self, file_path: str) -> Dict:
        """
        1) Load image bytes,
        2) Resize if needed,
        3) Convert to selected format,
        4) Return a result dict.
        """
        try:
            image_data, original_width = self._load_image_bytes(file_path)
            image_data, new_width = self._maybe_resize(image_data, original_width)
            convert_info = self._perform_conversion(file_path, image_data)

            return self._build_success_result(
                file_path=file_path,
                convert_info=convert_info,
                original_width=original_width,
                resized_width=new_width
            )

        except Exception as e:
            return self._build_failure_result(file_path, e)

    def _load_image_bytes(self, file_path: str) -> (bytes, int):
        """
        Loads image bytes from disk via `ImageLoader`.
        Returns (image_data, original_width).
        Raises an Exception if loading fails.
        """
        self.logger.log(f"Loading image: {file_path}", LogLevel.DEBUG.value)
        load_result = self.image_loader.load_image_as_bytes(file_path)

        if not load_result.get("is_successful", False):
            raise Exception(load_result.get("error", "Unknown load error"))
        image_data = load_result["value"]

        with Image.open(BytesIO(image_data)) as temp_img:
            original_width, _ = temp_img.size

        return image_data, original_width

    def _maybe_resize(self, image_data: bytes, original_width: int) -> (bytes, int):
        """
        Resizes the image if self.width is set & valid.
        Returns (possibly modified image_data, new_width).
        """
        new_width = original_width

        if self.width and self.width > 0:
            self.logger.log(
                f"Resizing image from width {original_width} to {self.width}",
                LogLevel.DEBUG.value
            )
            resize_result = self.image_resizer.resize_image(image_data, self.width)

            if not resize_result.get("is_successful", False):
                raise Exception(resize_result.get("error", "Unknown resize error"))
            image_data = resize_result["value"]

            with Image.open(BytesIO(image_data)) as resized_img:
                new_width, _ = resized_img.size

        return image_data, new_width

    def _perform_conversion(self, file_path: str, image_data: bytes) -> Dict:
        """
        Converts the (possibly resized) image bytes to the target format,
        writes it to disk, and returns converter's result info.
        """
        base_name, _ = os.path.splitext(os.path.basename(file_path))

        extension = ImageFormat.get_file_extension()

        dest_path = os.path.join(self.destination, base_name + extension)

        self.logger.log(
            f"Converting {file_path} -> {dest_path} [Format: {self.image_format.name}]",
            LogLevel.DEBUG.value
        )

        convert_result = self.converter.convert(
            image_data=image_data,
            source_path=file_path,
            dest_path=dest_path
        )

        if not convert_result.get("success", False) and not convert_result.get("is_successful", False):
            raise Exception(convert_result.get("error", "Unknown conversion error"))
        return convert_result

    def _build_success_result(
        self,
        file_path: str,
        convert_info: Dict,
        original_width: int,
        resized_width: int
    ) -> Dict:
        """
        Builds a standardized success result dict combining the converter info
        plus original/resized widths.
        """
        result = {
            "file": os.path.basename(file_path),
            "source": file_path,
            "destination": convert_info.get("destination"),
            "original_width": original_width,
            "resized_width": resized_width,
            "is_successful": True,
        }
        result.update(convert_info)
        return result

    def _build_failure_result(self, file_path: str, exception: Exception) -> Dict:
        """
        Builds a standardized failure result dict.
        """
        error_msg = f"Error converting {file_path}: {exception}"
        self.logger.log(error_msg, LogLevel.ERROR.value)

        base_name, _ = os.path.splitext(os.path.basename(file_path))
        extension = ImageFormat.get_file_extension()
        dest_path = os.path.join(self.destination, base_name + extension)

        return {
            "file": os.path.basename(file_path),
            "source": file_path,
            "destination": dest_path,
            "original_width": None,
            "resized_width": None,
            "is_successful": False,
            "error": str(exception),
        }

    def generate_summary(self) -> Dict:
        """Generates a summary dict of the entire run (how many errors, etc.)."""
        error_count = sum(not r.get("is_successful", False) for r in self.results)
        return {
            "summary": self.results,
            "errors_count": error_count
        }

    def output_results(self, summary: Dict) -> None:
        """Output final results either as JSON or plain text logs."""
        if self.json_output:
            final_output = {
                "status": "complete",
                **({"logs": self.logger.logs} if self.debug else {}),
                "conversion_results": {
                    "files": self.results,
                    "file_processing_summary": {
                        "total_files_count": len(self.results),
                        "successful_files_count": len([r for r in self.results if r.get("is_successful")]),
                        "failed_files_count": len([r for r in self.results if not r.get("is_successful")])
                    }
                }
            }
            print(json.dumps(final_output, indent=4))
        else:
            message = f"Summary: {len(self.results)} file(s) processed, {summary['errors_count']} error(s)."
            self.logger.log(message, LogLevel.INFO.value)
            for result in self.results:
                if not result.get("is_successful"):
                    error_message = f"Failed: {result['file']} - Error: {result.get('error')}"
                    self.logger.log(error_message, LogLevel.ERROR.value)
