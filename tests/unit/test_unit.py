from unittest.mock import MagicMock
from image_converter.infrastructure.logger import Logger
from image_converter.core.converter import ImageConverter
from image_converter.core.file_manager import FileManager
from image_converter.core.processor import ImageConversionProcessor
from tests.test_utils import mock_args, capture_stdout, capture_logger_output
import pytest

@pytest.fixture
def mock_logger():
    """
    Returns a Logger instance for testing. 
    Debug=True for color output (if desired), and JSON mode off by default.
    """
    return Logger(debug=True, json_output=False)

@pytest.fixture
def mock_converter():
    """
    Returns a MagicMock for the ImageConverter class to avoid actual image processing.
    """
    return MagicMock(spec=ImageConverter)

@pytest.fixture
def mock_file_manager():
    """
    Returns a MagicMock for the FileManager class to avoid filesystem operations.
    """
    return MagicMock(spec=FileManager)



def test_success_json_output(mock_converter, mock_file_manager):
    """
    Test that output_results prints valid JSON when json_output=True,
    capturing the printed JSON via capture_stdout.
    """
    args = mock_args(json_output=True)
    processor = ImageConversionProcessor(args)
    processor.prepare_destination = MagicMock()
    processor.logger.logs = []
    processor.converter = mock_converter

    processor.results = [
        {
            "file": "test1.jpg", "status": "success",
            "source": "/mock/source/test1.jpg", "destination": "/mock/destination/test1.jpg",
            "original_width": 2000, "resized_width": 800,
            "successful": True, "error": None
        },
        {
            "file": "test2.jpg", "status": "success",
            "source": "/mock/source/test2.jpg", "destination": "/mock/destination/test2.jpg",
            "original_width": 3000, "resized_width": 800,
            "successful": True, "error": None
        },
    ]

    summary = processor.generate_summary()
    output = capture_stdout(processor.output_results, summary) 

    import json
    output_json = json.loads(output)
    assert output_json["status"] == "complete"
    assert len(output_json["logs"]) == 0
    conv_results = output_json["conversion_results"]
    assert conv_results["summary"]["total_files"] == 2
    assert conv_results["summary"]["successful_files"] == 2
    assert conv_results["summary"]["failed_files"] == 0

def test_failure_text_output(mock_converter, mock_file_manager):
    """
    Test that output_results logs plain text when json_output=False,
    capturing logger-based messages via capture_logger_output.
    """
    args = mock_args(json_output=False, debug=True)
    processor = ImageConversionProcessor(args)
    processor.prepare_destination = MagicMock()

    processor.logger.logs = []
    processor.converter = mock_converter

    processor.results = [
        {
            "file": "test1.jpg", "status": "success",
            "source": "/mock/source/test1.jpg", "destination": "/mock/destination/test1.jpg",
            "original_width": 2000, "resized_width": 800,
            "successful": True, "error": None
        },
        {
            "file": "test2.jpg", "status": "failed",
            "source": "/mock/source/test2.jpg", "destination": "/mock/destination/test2.jpg",
            "original_width": None, "resized_width": None,
            "successful": False, "error": "Mock failure"
        },
    ]

    summary = processor.generate_summary()
    output = capture_logger_output(processor.output_results, summary)
    assert "Summary: 2 file(s) processed, 1 error(s)." in output
    assert "Failed: test2.jpg - Error: Mock failure" in output

def test_debug_mode_logging(mock_logger):
    """
    Test debug mode logs different levels but doesn't store them 
    in json_output=False mode.
    """
    logger = mock_logger
    logger.debug = True

    logger.log("Debugging info...", "debug")
    logger.log("Just an info message.", "info")
    logger.log("Heads up!", "warning")
    logger.log("Error occurred!", "error")

 
    assert len(logger.logs) == 0
