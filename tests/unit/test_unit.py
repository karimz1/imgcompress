from unittest.mock import MagicMock
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.core.internals.file_manager import FileManager
from backend.image_converter.core.image_convertsion_processor import ImageConversionProcessor
from backend.image_converter.core.factory.jpeg_converter import JpegConverter
from backend.image_converter.core.enums.image_format import ImageFormat
from tests.test_utils import capture_stdout, capture_logger_output
from backend.image_converter.application.dtos import PageProcessingResult
import pytest

@pytest.fixture
def mock_logger():
    """
    Returns a Logger instance for testing. 
    Debug=True for color output (if desired), and JSON mode off by default.
    """
    return Logger(debug=True, json_output=False)

@pytest.fixture
def mock_file_manager():
    """
    Returns a MagicMock for the FileManager class to avoid filesystem operations.
    """
    return MagicMock(spec=FileManager)

@pytest.fixture
def mock_converter():
    """
    Returns a MagicMock for the FileManager class to avoid filesystem operations.
    """
    return MagicMock(spec=JpegConverter)

def test_When_OutputResultsRunsInJsonMode_Expect_SummarySerialized(mock_converter, mock_file_manager):
    """
    Test that output_results prints valid JSON when json_output=True,
    capturing the printed JSON via capture_stdout.
    """
    processor = ImageConversionProcessor(source="/mock/source",
        destination="/mock/destination",
        image_format=ImageFormat.JPEG,
        quality=80,
        width=800,
        debug=False,
        json_output=True)
    processor.prepare_destination = MagicMock()
    processor.logger.logs = []
    processor.converter = mock_converter
    processor.results = [
        PageProcessingResult(
            file="test1.jpg",
            source="/mock/source/test1.jpg",
            destination="/mock/destination/test1.jpg",
            original_width=2000,
            resized_width=800,
            is_successful=True,
        ),
        PageProcessingResult(
            file="test2.jpg",
            source="/mock/source/test2.jpg",
            destination="/mock/destination/test2.jpg",
            original_width=3000,
            resized_width=800,
            is_successful=True,
        ),
    ]

    summary = processor.generate_summary()
    output = capture_stdout(processor.output_results, summary) 

    import json
    output_json = json.loads(output)
    assert output_json["status"] == "complete"
    conv_results = output_json["conversion_results"]
    assert conv_results["file_processing_summary"]["total_files_count"] == 2
    assert conv_results["file_processing_summary"]["successful_files_count"] == 2
    assert conv_results["file_processing_summary"]["failed_files_count"] == 0


def test_When_OutputResultsRunsInTextModeWithErrors_Expect_FailuresLogged(mock_converter, mock_file_manager):
    """
    Test that output_results logs plain text when json_output=False,
    capturing logger-based messages via capture_logger_output.
    """
    processor = ImageConversionProcessor(source="/mock/source",
        destination="/mock/destination",
        image_format=ImageFormat.JPEG,
        quality=80,
        width=800,
        debug=True,
        json_output=False)
    processor.prepare_destination = MagicMock()

    processor.logger.logs = []
    processor.converter = mock_converter

    processor.results = [
        PageProcessingResult(
            file="test1.jpg",
            source="/mock/source/test1.jpg",
            destination="/mock/destination/test1.jpg",
            original_width=2000,
            resized_width=800,
            is_successful=True,
        ),
        PageProcessingResult(
            file="test2.jpg",
            source="/mock/source/test2.jpg",
            destination="/mock/destination/test2.jpg",
            original_width=None,
            resized_width=None,
            is_successful=False,
            error="Mock failure",
        ),
    ]

    summary = processor.generate_summary()
    output = capture_logger_output(processor.output_results, summary)
    assert "Summary: 2 file(s) processed, 1 error(s)." in output
    assert "Failed: test2.jpg - Error: Mock failure" in output

def test_When_DebugModeEnabled_Expect_LogsBypassStorage(mock_logger):
    """
    Test debug mode logs different levels but doesn't store them 
    in json_output=False mode.
    """
    logger = mock_logger
    logger.debug = True

    logger.log("Mock: Debug - Debugging info...", "debug")
    logger.log("Mock: Info - Just an info message.", "info")
    logger.log("Mock: Warning - Heads up!", "warning")
    logger.log("Mock: Error - occurred!", "error")

    assert len(logger.logs) == 0
