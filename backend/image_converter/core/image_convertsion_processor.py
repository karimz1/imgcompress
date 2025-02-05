import os
import sys
from typing import List, Dict, Optional
import json
from backend.image_converter.infrastructure.logger import Logger
from .file_manager import FileManager
from .image_loader import ImageLoader
from .image_resizer import ImageResizer
from .converter_factory import ImageConverterFactory
from .enums.image_format import ImageFormat
from .enums.conversion_error import ConversionError
from .enums.log_level import LogLevel

class ImageConversionProcessor:
    """Orchestrates the image conversion process using the factory and helper classes."""

    def __init__(self, 
                 source: str,
                 destination: str,
                 image_format: ImageFormat,
                 quality: int = 85,
                 width: Optional[int] = None,
                 debug: bool = False,
                 json_output: bool = False):
        self.source = source
        self.destination = destination
        self.image_format = image_format
        self.quality = quality
        self.width = width
        self.debug = debug
        self.json_output = json_output

        # Initialize logger
        self.logger = Logger(debug=self.debug, json_output=self.json_output)

        # Create needed components
        self.file_manager = FileManager(self.source, self.destination, self.logger)
        self.image_loader = ImageLoader(self.logger)
        self.image_resizer = ImageResizer(self.logger)

        self.converter = ImageConverterFactory.create_converter(
            image_format=self.image_format,
            quality=self.quality,
            logger=self.logger
        )

        self.results: List[Dict] = []

    def run(self) -> None:
        """Execute the conversion process."""
        try:
            self.logger.log("Starting image conversion process.", LogLevel.INFO.value)

            # Check and prepare destination
            self.prepare_destination()

            if os.path.isfile(self.source):
                self.process_single_file(self.source)
            elif os.path.isdir(self.source):
                self.process_directory(self.source)
            else:
                raise ConversionError(f"Source path '{self.source}' is neither a file nor a directory.")
            
            summary = self.generate_summary()
            self.output_results(summary)

        except ConversionError as ce:
            self.logger.log(str(ce), LogLevel.ERROR.value)
            sys.exit(1)
        except Exception as e:
            self.logger.log(f"Unexpected error: {str(e)}", LogLevel.ERROR.value)
            sys.exit(1)

    def prepare_destination(self):
        if not os.path.exists(self.destination):
            os.makedirs(self.destination)
            self.logger.log(f"Created destination directory: {self.destination}", LogLevel.INFO.value)
        elif not os.path.isdir(self.destination):
            msg = f"Destination path '{self.destination}' is not a directory."
            self.logger.log(msg, LogLevel.ERROR.value)
            sys.exit(1)

    def process_single_file(self, file_path: str) -> None:
        self.logger.log(f"Processing single file: {file_path}", LogLevel.INFO.value)
        result = self._convert_file(file_path)
        self.results.append(result)

    def process_directory(self, directory: str) -> None:
        self.logger.log(f"Processing directory: {directory}", LogLevel.INFO.value)

        self.file_manager.ensure_destination()
        supported_files = self.file_manager.list_supported_files()

        for filename in supported_files:
            full_path = os.path.join(directory, filename)
            result = self._convert_file(full_path)
            self.results.append(result)

    def _convert_file(self, file_path: str) -> Dict:
        """Load, resize, and convert a single image, returning a result dict."""
        result = {"file": os.path.basename(file_path)}
        base_name, _ = os.path.splitext(os.path.basename(file_path))

        # Destination path based on format
        extension = ".png" if self.image_format == ImageFormat.PNG else ".jpg"
        dest_path = os.path.join(self.destination, base_name + extension)

        try:
            image = self.image_loader.load_image(file_path, self.image_format)
            original_width, _ = image.size
            resized_image = self.image_resizer.resize_image(image, self.width)

            convert_result = self.converter.convert(
                image=resized_image,
                source_path=file_path,
                dest_path=dest_path
            )

            # Merge top-level result data
            result.update(convert_result)
            result["original_width"] = original_width
            new_width, _ = resized_image.size
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
        """Generate a summary of the conversion process."""
        error_count = sum(not r["is_successful"] for r in self.results)
        summary = {
            "summary": self.results,
            "errors_count": error_count
        }
        return summary

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
