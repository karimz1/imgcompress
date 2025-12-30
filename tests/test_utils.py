import os
import sys
import logging
from io import StringIO
from PIL import Image
from backend.image_converter.core.enums.image_format import ImageFormat


                                                                     
                              
                                                                     
def capture_stdout(func, *args, **kwargs):
    """
    Captures anything printed to stdout.
    """
    original_stdout = sys.stdout
    captured_output = StringIO()
    try:
        sys.stdout = captured_output
        func(*args, **kwargs)
    finally:
        sys.stdout = original_stdout
    return captured_output.getvalue()

def capture_logger_output(func, *args, **kwargs):
    """
    Captures output emitted via Python's logging module.
    """
    logger_output = StringIO()
    handler = logging.StreamHandler(logger_output)
    logger = logging.getLogger("backend.image_converter.infrastructure.logger")
    
    old_level = logger.level
    old_handlers = logger.handlers[:]
    logger.handlers = []
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    try:
        func(*args, **kwargs)
    finally:
        logger.removeHandler(handler)
    return logger_output.getvalue()


def validate_image_dimensions(file_path: str, expected_width: int):
    """
    Opens an image from file_path and asserts that its width 
    matches the expected_width.
    """
    if not os.path.exists(file_path):
        raise AssertionError(f"File does not exist: {file_path}")

    try:
        with Image.open(file_path) as img:
            width, _ = img.size
            msg = (
                f"Expected width of {expected_width} for '{os.path.basename(file_path)}', "
                f"but got {width}."
            )
            assert width == expected_width, msg
    except Exception as e:
        raise AssertionError(f"Failed to open/validate '{file_path}'. Error: {e}")
    

def create_sample_test_image(dest_img_path):
    """
    Creates a dummy PNG imaage for testing.
    """
    from PIL import Image
    img = Image.new("RGB", (100, 100), color="white")
    img.save(dest_img_path)



                                                                     
                
                                                                     

def is_github_actions():
    """
    Detect if running inside GitHub Actions.
    """
    return os.getenv("IS_RUNNING_IN_GITHUB_ACTIONS") == "true"
