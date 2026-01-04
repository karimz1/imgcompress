import importlib
import importlib.util
import os
import socket
from typing import List, Set, Dict
from PIL import Image

# Formats that are ingest via custom pipelines (e.g. PdfPageExtractor)
EXTRA_SUPPORTED_EXTENSIONS = {".pdf"}


def load_supported_formats() -> List[str]:
    """
    Dynamically returns a sorted list of file extensions for which Pillow has a registered
    decoder (i.e. that Pillow can actually open). Adds optional HEIF support and curated
    formats handled via custom pipelines.
    """
    pillow_formats = [
        ext.lower()
        for ext, fmt in Image.registered_extensions().items()
        if fmt.upper() in Image.OPEN
    ]

    supported: List[str] = list(pillow_formats)

    if importlib.util.find_spec("pillow_heif") is not None:
        supported.extend([".heic", ".heif"])

    supported.extend(EXTRA_SUPPORTED_EXTENSIONS)
    return sorted(set(supported))


supported_extensions = load_supported_formats()

def has_internet():
    try:
        socket.create_connection(("1.1.1.1", 53), 1)
        return True
    except:
        return False

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


from typing import Generic, TypeVar, Any, Optional

T = TypeVar("T")


class Result(Generic[T]):
    """A result type that can either be successful with a value or failed with an error."""

    def __init__(self, success: bool, value: Optional[T] = None, error: Optional[str] = None):
        self._success = success
        self._value = value
        self._error = error

    @property
    def is_successful(self) -> bool:
        """Use this property to check if the operation succeeded."""
        return self._success

    @property
    def value(self) -> T:
        return self._value

    @property
    def error(self) -> str:
        return self._error

    @staticmethod
    def success(value: T) -> 'Result[T]':
        """Static factory method to create a successful result."""
        safe_value = Result._clone_with_flags(value, True)
        return Result(True, value=safe_value)

    @staticmethod
    def failure(error: Any) -> 'Result[T]':
        """Static factory method to create a failed result."""
        safe_error = Result._clone_with_flags(error, False)
        return Result(False, error=str(safe_error))

    @staticmethod
    def _clone_with_flags(payload: Any, is_successful: bool) -> Any:
        if isinstance(payload, dict):
            cloned = payload.copy()
            cloned["is_successful"] = is_successful
            if is_successful:
                cloned["error"] = None
            return cloned
        return payload
