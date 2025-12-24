from dataclasses import asdict
from typing import List, Optional
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
from backend.image_converter.application.file_payload_expander import PagePayload
from backend.image_converter.application.dtos import (
    PageProcessingResult,
    ConversionSummary,
    FileProcessingSummary,
    ConversionResultsDto,
    ConversionOutputDto,
    ConversionDetails,
)
from backend.image_converter.core.internals.utls import Result
from backend.image_converter.application.payload_expander_factory import create_payload_expander
from PIL import Image
from io import BytesIO

class PayloadExpansionError(RuntimeError):
    """Raised when result-wrapped operations fail during payload processing."""

class ImageConversionProcessor:
    def __init__(
        self,
        source: str,
        destination: str,
        image_format: ImageFormat,
        quality: int = 85,
        width: Optional[int] = None,
        use_rembg: bool = False,
        debug: bool = False,
        json_output: bool = False
    ):
        self.source = source
        self.destination = destination
        self.image_format = image_format
        self.quality = quality
        self.width = width
        self.use_rembg = use_rembg
        self.debug = debug
        self.json_output = json_output

        self.logger = Logger(debug=self.debug, json_output=self.json_output)
        self.file_manager = FileManager(self.source, self.destination, self.logger)
        self.image_loader = ImageLoader()
        self.image_resizer = ImageResizer()
        self.payload_expander = create_payload_expander(self.logger)
        self.converter = ImageConverterFactory.create_converter(
            image_format=self.image_format,
            quality=self.quality,
            logger=self.logger,
            use_rembg=self.use_rembg
        )
        self.results: List[PageProcessingResult] = []

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

    def _convert_file(self, file_path: str) -> List[PageProcessingResult]:
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

        results: List[PageProcessingResult] = []
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
    ) -> PageProcessingResult:
        page_label = payload.label

        try:
            with Image.open(BytesIO(payload.data)) as temp_img:
                original_width, _ = temp_img.size

            data = payload.data
            new_width = original_width

            if self.use_rembg and self.image_format == ImageFormat.PNG:
                rembg_bytes = self.converter.encode_bytes(payload.data)
                data = rembg_bytes
                if self.width and self.width > 0:
                    data = self.image_resizer.resize_image(rembg_bytes, self.width)
                    with Image.open(BytesIO(data)) as resized_img:
                        new_width, _ = resized_img.size
                with open(dest_path, "wb") as f:
                    f.write(data)
                conv_result = ConversionDetails(
                    source=file_path,
                    destination=dest_path,
                    bytes_written=len(data),
                )
            else:
                if self.width and self.width > 0:
                    data = self.image_resizer.resize_image(payload.data, self.width)
                    with Image.open(BytesIO(data)) as resized_img:
                        new_width, _ = resized_img.size

                convert_result = self.converter.convert(
                    image_data=data,
                    source_path=file_path,
                    dest_path=dest_path
                )
                conv_result = self._unwrap_result(convert_result)

            return PageProcessingResult(
                file=dest_name,
                source=file_path,
                destination=conv_result.destination,
                original_width=original_width,
                resized_width=new_width,
                is_successful=True,
                error=None,
            )
        except Exception as e:
            error_msg = f"Error converting {page_label}: {e}"
            self.logger.log(error_msg, LogLevel.ERROR.value)
            return PageProcessingResult(
                file=dest_name,
                source=file_path,
                destination=dest_path,
                original_width=None,
                resized_width=None,
                is_successful=False,
                error=str(e),
            )

    def generate_summary(self) -> ConversionSummary:
        error_count = sum(not r.is_successful for r in self.results)
        return ConversionSummary(processed_pages=list(self.results), errors_count=error_count)

    def output_results(self, summary: ConversionSummary) -> None:
        """Output final results either in JSON or plain text."""
        if self.json_output:
            summary_payload = FileProcessingSummary(
                total_files_count=len(summary.processed_pages),
                successful_files_count=len([r for r in summary.processed_pages if r.is_successful]),
                failed_files_count=len([r for r in summary.processed_pages if not r.is_successful]),
            )

            results_payload = ConversionResultsDto(
                files=list(summary.processed_pages),
                file_processing_summary=summary_payload,
            )

            response = ConversionOutputDto(
                status="complete",
                conversion_results=results_payload,
                logs=self.logger.logs if self.debug else None,
            )

            response_dict = {k: v for k, v in asdict(response).items() if v is not None}
            print(json.dumps(response_dict, indent=4))
        else:
            message = f"Summary: {len(summary.processed_pages)} file(s) processed, {summary.errors_count} error(s)."
            self.logger.log(message, LogLevel.INFO.value)
            for result in summary.processed_pages:
                if not result.is_successful:
                    error_message = f"Failed: {result.file} - Error: {result.error}"
                    self.logger.log(error_message, LogLevel.ERROR.value)

    @staticmethod
    def _build_dest_name(base_name: str, extension: str, page_index: Optional[int]) -> str:
        if page_index is None:
            return base_name + extension
        return f"{base_name}_page-{page_index}{extension}"

    @staticmethod
    def _unwrap_result(result_obj):
        if isinstance(result_obj, Result):
            if not result_obj.is_successful:
                raise PayloadExpansionError(result_obj.error or "Unknown result failure.")
            return result_obj.value
        return result_obj

    def _build_error_result(self, file_path: str, dest_path: str, message: str) -> PageProcessingResult:
        return PageProcessingResult(
            file=os.path.basename(file_path),
            source=file_path,
            destination=dest_path,
            original_width=None,
            resized_width=None,
            is_successful=False,
            error=message,
        )
