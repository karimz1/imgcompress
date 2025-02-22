import importlib
import os
import json
from typing import List, Set, Dict
from PIL import Image

import os
import json
from typing import Set, Dict

def load_supported_formats() -> List[str]:
    """
    Returns a list of all supported image formats.
    """
    has_heif = importlib.util.find_spec("pillow_heif") is not None
    supported_formats = list(Image.registered_extensions().keys())
    
    if has_heif:
        supported_formats.extend(['.heic', '.heif'])
    
    formats = [fmt.lower() for fmt in supported_formats]

    return sorted(list(set(formats)))

    
supported_extensions = load_supported_formats()

def is_file_supported(file_path: str) -> bool:
    """
    Determines if the given file_path points to a supported image file.
    This function checks the file extension against the loaded supported formats.

    Args:
        file_path (str): The path to the file.

    Returns:
        bool: True if the file's extension is in the supported list; otherwise False.
    """
    _, ext = os.path.splitext(file_path)
    return ext.lower() in supported_extensions

class FileUrl:
    """
    Encapsulates a file path and provides helper methods for checking file existence,
    retrieving file properties, and determining if the file type is supported.
    """
    def __init__(self, path: str):
        self.path = path

    def exists(self) -> bool:
        """Returns True if the file exists and is a file."""
        return os.path.isfile(self.path)

    def is_supported(self) -> bool:
        """Returns True if the file has a supported extension."""
        return is_file_supported(self.path)

    def get_extension(self) -> str:
        """Returns the file extension in lowercase."""
        return os.path.splitext(self.path)[1].lower()

    def get_filename(self) -> str:
        """Returns the basename of the file."""
        return os.path.basename(self.path)

    def __str__(self):
        return self.path

    def __repr__(self):
        return f"FileUrl({self.path!r})"

    def __fspath__(self):
        """
        Allows FileUrl objects to be used as os.PathLike objects.
        This method returns the underlying file system path as a string.
        """
        return self.path


from typing import Generic, TypeVar, Any

T = TypeVar('T')

class Result(Generic[T]):
    """A result type that can either be successful with a value or failed with an error."""
    
    def __init__(self, success: bool, value: T = None, error: str = None):
        self._success = success
        self._value = value
        self._error = error

    @property
    def success(self) -> bool:
        return self._success

    @property
    def value(self) -> T:
        return self._value

    @property
    def error(self) -> str:
        return self._error

    @staticmethod
    def success(value: T) -> 'Result[T]':
        if isinstance(value, dict):
            value["is_successful"] = True
            value["error"] = None
        return Result(True, value=value)

    @staticmethod
    def failure(error: str) -> 'Result[T]':
        if isinstance(error, dict):
            error["is_successful"] = False
        return Result(False, error=str(error))

    @property 
    def is_successful(self) -> bool:
        return self._success