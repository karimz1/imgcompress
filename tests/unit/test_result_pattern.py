import os
import unittest
from io import StringIO
from backend.image_converter.core.internals.utls import Result
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.infrastructure.logger import Logger

# -------------------------------------------------------------------
# Test for the ImageFormat.from_string_result method using the result pattern.
# -------------------------------------------------------------------

class TestImageFormatResult(unittest.TestCase):
    def test_from_string_result_success(self):
        # Test with a valid format string.
        result = ImageFormat.from_string_result("jpeg")
        self.assertTrue(result.is_successful)
        self.assertEqual(result.value, ImageFormat.JPEG)

    def test_from_string_result_failure(self):
        # Test with an invalid format string.
        result = ImageFormat.from_string_result("unsupported_format")
        self.assertFalse(result.is_successful)
        self.assertIn("Unsupported image format", result.error)

# -------------------------------------------------------------------
# Test for capturing logger output that uses the result pattern
# -------------------------------------------------------------------

def dummy_function_success():
    # A dummy function that returns a successful Result.
    return Result.success("Everything went fine.")

def dummy_function_failure():
    # A dummy function that returns a failure Result.
    import traceback
    try:
        raise ValueError("Something went wrong!")
    except Exception as e:
        tb = traceback.format_exc()
        return Result.failure(tb)

class TestLoggerAndResultIntegration(unittest.TestCase):
    def setUp(self):
        # Create a logger that writes to an in-memory stream.
        self.log_stream = StringIO()
        self.logger = Logger(debug=True, json_output=False)
        # Replace the logger's internal stream/handler if needed.
        # (This depends on how your Logger is implemented. Here we assume you can add a handler.)
        import logging
        handler = logging.StreamHandler(self.log_stream)
        self.logger.logger.addHandler(handler)
    
    def tearDown(self):
        # Remove handlers if needed.
        for handler in self.logger.logger.handlers:
            self.logger.logger.removeHandler(handler)

    def test_dummy_function_success_logs(self):
        result = dummy_function_success()
        self.assertTrue(result.is_successful)
        # Log a message with the result.
        self.logger.log(f"Success: {result.value}", "info")
        output = self.log_stream.getvalue()
        self.assertIn("Success:", output)
        self.assertIn("Everything went fine", output)

    def test_dummy_function_failure_logs(self):
        result = dummy_function_failure()
        self.assertFalse(result.is_successful)
        self.logger.log(f"Failure: {result.error}", "error")
        output = self.log_stream.getvalue()
        self.assertIn("Failure:", output)
        self.assertIn("ValueError", output)


if __name__ == '__main__':
    unittest.main()
