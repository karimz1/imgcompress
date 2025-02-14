import os
import unittest
from io import StringIO
from backend.image_converter.core.internals.utls import Result
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.infrastructure.logger import Logger

                                                                     
                                                                              
                                                                     

class TestImageFormatResult(unittest.TestCase):
    def test_from_string_result_success(self):
                                          
        result = ImageFormat.from_string_result("jpeg")
        self.assertTrue(result.is_successful)
        self.assertEqual(result.value, ImageFormat.JPEG)

    def test_from_string_result_failure(self):
                                             
        result = ImageFormat.from_string_result("unsupported_format")
        self.assertFalse(result.is_successful)
        self.assertIn("Unsupported image format", result.error)

                                                                     
                                                               
                                                                     

def dummy_function_success():
                                                        
    return Result.success("Everything went fine.")

def dummy_function_failure():
                                                     
    import traceback
    try:
        raise ValueError("Something went wrong!")
    except Exception as e:
        tb = traceback.format_exc()
        return Result.failure(tb)

class TestLoggerAndResultIntegration(unittest.TestCase):
    def setUp(self):
                                                             
        self.log_stream = StringIO()
        self.logger = Logger(debug=True, json_output=False)
                                                                 
                                                                                                 
        import logging
        handler = logging.StreamHandler(self.log_stream)
        self.logger.logger.addHandler(handler)
    
    def tearDown(self):
                                    
        for handler in self.logger.logger.handlers:
            self.logger.logger.removeHandler(handler)

    def test_dummy_function_success_logs(self):
        result = dummy_function_success()
        self.assertTrue(result.is_successful)
                                        
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
