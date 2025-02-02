import argparse
import json
import os
import sys
from typing import List, Dict

from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.file_manager import FileManager
from backend.image_converter.core.converter import ImageConverter

class ImageConversionProcessor:
    """Handles the image conversion process."""

    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.debug = args.debug
        self.logger = Logger(debug=args.debug, json_output=args.json_output)
        self.converter = ImageConverter(
            quality=args.quality,
            width=args.width,
            output_format=args.format,
            logger=self.logger
        )
        self.results: List[Dict] = []

    def prepare_destination(self):
        """Ensure the destination directory exists."""
        if not os.path.exists(self.args.destination):
            os.makedirs(self.args.destination)
            self.logger.log(f"Created destination directory: {self.args.destination}", "info")
        elif not os.path.isdir(self.args.destination):
            self.logger.log(f"Destination path '{self.args.destination}' is not a directory.", "error")
            sys.exit(1)

    def process_single_file(self, file_path: str):
        """Process a single image file."""
        self.logger.log(f"Processing single file: {file_path}", "info")
        result = self.converter.convert(
            filename=os.path.basename(file_path),
            source_folder=os.path.dirname(file_path),
            dest_folder=self.args.destination
        )
        self.results.append(result)

    def process_directory(self, directory: str):
        """Process all supported image files in a directory."""
        self.logger.log(f"Processing directory: {directory}", "info")
        file_manager = FileManager(directory, self.args.destination, self.logger)
        file_manager.ensure_destination()
        supported_files = file_manager.list_supported_files()

        for filename in supported_files:
            result = self.converter.convert(filename, directory, self.args.destination)
            self.results.append(result)

    def generate_summary(self) -> Dict:
        """Generate a summary of the conversion process."""
        error_count = sum(1 for result in self.results if result["is_successful"] == False)
        summary = {
            "summary": self.results,
            "errors_count": error_count
        }
        return summary

    def output_results(self, summary: Dict):
        if self.args.json_output:
            final_output = {
                "status": "complete",
                **({"logs": self.logger.logs} if self.debug else {}),
                "conversion_results": {
                    "files": self.results,
                    "file_processing_summary": {
                        "total_files_count": len(self.results),
                        "successful_files_count": len([r for r in self.results if r["is_successful"]  == True]),
                        "failed_files_count": len([r for r in self.results if r["is_successful"] == False])
                    }
                }
            }
            print(json.dumps(final_output, indent=4))
        else:
            message = f"Summary: {len(self.results)} file(s) processed, {summary['errors_count']} error(s)."
            self.logger.log(message, "info")

            for result in self.results:
                if result["is_successful"] == False:
                    error_message = f"Failed: {result['file']} - Error: {result['error']}"
                    self.logger.log(error_message, "error")


    def run(self):
        """Execute the image conversion process."""
        self.logger.log("Starting image conversion process.", "info")
        self.prepare_destination()

        source = self.args.source
        if os.path.isfile(source):
            self.process_single_file(source)
        elif os.path.isdir(source):
            self.process_directory(source)
        else:
            self.logger.log(f"Source path '{source}' is neither a file nor a directory.", "error")
            sys.exit(1)

        summary = self.generate_summary()
        self.output_results(summary)
