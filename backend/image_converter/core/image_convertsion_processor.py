from typing import List, Dict, Optional
import os
import json
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.internals.file_manager import FileManager
from backend.image_converter.core.internals.image_loader import ImageLoader
from backend.image_converter.domain.image_resizer import ImageResizer
from backend.image_converter.core.factory.converter_factory import ImageConverterFactory
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.core.enums.conversion_error import ConversionError
from backend.image_converter.core.enums.log_level import LogLevel
from backend.image_converter.infrastructure.pdf_page_extractor import PdfPageExtractor
from backend.image_converter.application.file_payload_expander import FilePayloadExpander, PagePayload
from PIL import Image
from io import BytesIO

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
        self.pdf_page_extractor = PdfPageExtractor(logger=self.logger)
        self.payload_expander = FilePayloadExpander(self.pdf_page_extractor)
        self.converter = ImageConverterFactory.create_converter(
            image_format=self.image_format,
            quality=self.quality,
            logger=self.logger
        )
        self.results: List[Dict] = []

    def run(self) -> None:
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
        self.file_manager.ensure_destination()
        result = self._convert_file(file_path)
        self.results.extend(result)

    def process_directory(self, directory: str) -> None:
        self.logger.log(f"Processing directory: {directory}", LogLevel.INFO.value)
        self.file_manager.ensure_destination()
        supported_files = self.file_manager.list_supported_files()
        for file_url in supported_files:
            path = file_url.path
            result = self._convert_file(path)
            self.results.extend(result)

    def _convert_file(self, file_path: str) -> List[Dict]:
        """
        1) Load file bytes,
        2) Expand into per-page payloads (PDF aware),
        3) Resize if needed,
        4) Convert (JPEG/PNG/ICO),
        5) Return list of result dicts (one per generated file).
        """
        base_name, _ = os.path.splitext(os.path.basename(file_path))
        extension = self.image_format.get_file_extension()
        default_dest = os.path.join(self.destination, base_name + extension)

        try:
            load_result = self.image_loader.load_image_as_bytes(file_path)
            image_data = self._unwrap_result(load_result)
            payload_result = self.payload_expander.expand(os.path.basename(file_path), image_data)
            if not payload_result.is_successful:
                raise ValueError(payload_result.error)
            page_payloads = payload_result.value
        except Exception as e:
            error_msg = f"Error preparing {file_path}: {e}"
            self.logger.log(error_msg, LogLevel.ERROR.value)
            return [self._build_error_result(file_path, default_dest, str(e))]

        results: List[Dict] = []
        for payload in page_payloads:
            dest_name = self._build_dest_name(base_name, extension, payload.page_index)
            dest_path = os.path.join(self.destination, dest_name)
            results.append(
                self._convert_page(
                    file_path=file_path,
                    dest_path=dest_path,
                    dest_name=dest_name,
                    payload=payload,
                )
            )

        return results

    def _convert_page(
        self,
        file_path: str,
        dest_path: str,
        dest_name: str,
        payload: PagePayload,
    ) -> Dict:
        page_label = payload.label
        result = {"file": dest_name}

        try:
            with Image.open(BytesIO(payload.data)) as temp_img:
                original_width, _ = temp_img.size

            data = payload.data
            new_width = original_width

            if self.width and self.width > 0:
                resized = self.image_resizer.resize_image(payload.data, self.width)
                data = self._unwrap_result(resized)
                with Image.open(BytesIO(data)) as resized_img:
                    new_width, _ = resized_img.size

            convert_result = self.converter.convert(
                image_data=data,
                source_path=file_path,
                dest_path=dest_path
            )
            conv_result = self._unwrap_result(convert_result)

            result.update(conv_result)
            result["file"] = dest_name
            result["original_width"] = original_width
            result["resized_width"] = new_width

        except Exception as e:
            error_msg = f"Error converting {page_label}: {e}"
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
        error_count = sum(not r.get("is_successful", False) for r in self.results)
        return {
            "summary": self.results,
            "errors_count": error_count
        }

    def output_results(self, summary: Dict) -> None:
        """Output final results either in JSON or plain text."""
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

    @staticmethod
    def _build_dest_name(base_name: str, extension: str, page_index: Optional[int]) -> str:
        if page_index is None:
            return base_name + extension
        return f"{base_name}_page-{page_index}{extension}"

    @staticmethod
    def _unwrap_result(result_obj):
        if hasattr(result_obj, "value"):
            value = result_obj.value
            if isinstance(value, dict) and "is_successful" in value:
                if not value.get("is_successful", False):
                    raise Exception(value.get("error"))
            return value
        return result_obj

    def _build_error_result(self, file_path: str, dest_path: str, message: str) -> Dict:
        return {
            "file": os.path.basename(file_path),
            "source": file_path,
            "destination": dest_path,
            "original_width": None,
            "resized_width": None,
            "is_successful": False,
            "error": message,
        }
