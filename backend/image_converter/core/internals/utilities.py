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


from typing import Generic, Optional, TypeVar

T = TypeVar("T")


class Result(Generic[T]):
    """Typed success-or-failure carrier.

    `Result[T]` is either successful with a `value: T` or failed with a
    `error: str`. Callers must check `is_successful` before reading either
    property; the inactive side is `None`. The type parameter `T` flows
    through `success()` and the `value` accessor, so we never need `Any`.
    """

    def __init__(
        self,
        success: bool,
        value: Optional[T] = None,
        error: Optional[str] = None,
    ) -> None:
        self._success = success
        self._value = value
        self._error = error

    @property
    def is_successful(self) -> bool:
        return self._success

    @property
    def value(self) -> Optional[T]:
        """The payload of a successful Result, or `None` for a failed one.

        Callers check `is_successful` first; the type stays `Optional[T]` so
        the static type checker sees the discriminated nature of the union.
        """
        return self._value

    @property
    def error(self) -> Optional[str]:
        """The error message of a failed Result, or `None` for a successful one."""
        return self._error

    @staticmethod
    def success(value: T) -> "Result[T]":
        return Result(True, value=value)

    @staticmethod
    def failure(error: str) -> "Result[T]":
        if not error:
            raise ValueError("Result.failure requires a non-empty error message")
        return Result(False, error=error)
