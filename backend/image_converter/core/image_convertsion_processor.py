from typing import List, Dict, Optional
import os
import sys
import json
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.internals.file_manager import FileManager
from backend.image_converter.core.internals.image_loader import ImageLoader
from backend.image_converter.domain.image_resizer import ImageResizer
from backend.image_converter.core.factory.converter_factory import ImageConverterFactory
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.core.enums.conversion_error import ConversionError
from backend.image_converter.core.enums.log_level import LogLevel
from PIL import Image
from io import BytesIO


class ImageConversionProcessor:
    def __init__(self, source: str, destination: str, image_format: ImageFormat,
                 quality: int = 85, width: Optional[int] = None,
                 debug: bool = False, json_output: bool = False):
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
        # Standard logic ...
        if os.path.isfile(self.source):
            self.process_single_file(self.source)
        elif os.path.isdir(self.source):
            self.process_directory(self.source)
        else:
            raise ConversionError(f"Source path '{self.source}' is neither file nor directory.")
        summary = self.generate_summary()
        self.output_results(summary)

    def process_single_file(self, file_path: str) -> None:
        self.logger.log(f"Processing single file: {file_path}", LogLevel.INFO.value)
        result = self._convert_file(file_path)
        self.results.append(result)

    def process_directory(self, directory: str) -> None:
        self.logger.log(f"Processing directory: {directory}", LogLevel.INFO.value)
        self.file_manager.ensure_destination()
        supported_files = self.file_manager.list_supported_files()
        for filename in supported_files:
            path = os.path.join(directory, filename)
            result = self._convert_file(path)
            self.results.append(result)

    def _convert_file(self, file_path: str) -> Dict:
        """
        1) Load bytes,
        2) Resize if self.width,
        3) Convert (JPEG/PNG),
        4) Return result dict
        """
        result = {"file": os.path.basename(file_path)}
        base_name, _ = os.path.splitext(os.path.basename(file_path))
        extension = ".png" if self.image_format == ImageFormat.PNG else ".jpg"
        dest_path = os.path.join(self.destination, base_name + extension)

        try:
            # 1) Load raw bytes
            image_data = self.image_loader.load_image_as_bytes(file_path)

            # 2) Resize if needed
            original_width = None
            new_width = None
            # We can discover original width by opening the bytes quickly
            with Image.open(BytesIO(image_data)) as temp_img:
                original_width, _ = temp_img.size

            if self.width and self.width > 0:
                image_data = self.image_resizer.resize_image(image_data, self.width)
                with Image.open(BytesIO(image_data)) as resized_img:
                    new_width, _ = resized_img.size
            else:
                new_width = original_width

            # 3) Convert via our factory-chosen converter
            convert_result = self.converter.convert(
                image_data=image_data,
                source_path=file_path,
                dest_path=dest_path
            )
            result.update(convert_result)
            result["original_width"] = original_width
            result["resized_width"] = new_width

        except Exception as e:
            error_msg = f"Error converting {file_path}: {e}"
            self.logger.log(error_msg, LogLevel.ERROR.value)
            result.update({
                "source": file_path,
                "destination": dest_path,
                "original_width": None,
                "resized_width": None,
                "is_successful": False,
                "error": str(e)
            })

        return result

    def generate_summary(self) -> Dict:
        error_count = sum(not r["is_successful"] for r in self.results)
        return {
            "summary": self.results,
            "errors_count": error_count
        }
    
    def output_results(self, summary: Dict) -> None:
        """Output final results either in JSON or text."""
        if self.json_output:
            final_output = {
                "status": "complete",
                **({"logs": self.logger.logs} if self.debug else {}),
                "conversion_results": {
                    "files": self.results,
                    "file_processing_summary": {
                        "total_files_count": len(self.results),
                        "successful_files_count": len([r for r in self.results if r["is_successful"]]),
                        "failed_files_count": len([r for r in self.results if not r["is_successful"]])
                    }
                }
            }
            print(json.dumps(final_output, indent=4))
        else:
            message = f"Summary: {len(self.results)} file(s) processed, {summary['errors_count']} error(s)."
            self.logger.log(message, LogLevel.INFO.value)

            for result in self.results:
                if not result["is_successful"]:
                    error_message = f"Failed: {result['file']} - Error: {result['error']}"
                    self.logger.log(error_message, LogLevel.ERROR.value)
