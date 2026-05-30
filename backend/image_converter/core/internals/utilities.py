from __future__ import annotations

from functools import cache
import importlib.util
import socket
from dataclasses import dataclass
from pathlib import Path
from typing import Generic, TypeVar

from PIL import Image

from backend.image_converter.config import settings


@cache
def load_supported_formats() -> tuple[str, ...]:
    pillow_formats = {
        ext.lower()
        for ext, fmt in Image.registered_extensions().items()
        if fmt.upper() in Image.OPEN
    }

    supported = set(pillow_formats)
    supported.update(settings.get().formats.custom_pipeline_extensions)

    if importlib.util.find_spec("pillow_heif") is not None:
        supported.update({".heic", ".heif"})

    return tuple(sorted(supported))


def is_file_supported(file_path: str | Path) -> bool:
    return Path(file_path).suffix.lower() in load_supported_formats()


supported_extensions = load_supported_formats()


def has_internet() -> bool:
    try:
        socket.create_connection(("1.1.1.1", 53), timeout=1).close()
        return True
    except OSError:
        return False


class FileUrl:
    """Small path wrapper used by legacy converter code."""

    def __init__(self, path: str):
        self.path = path

    def exists(self) -> bool:
        return Path(self.path).is_file()

    def is_supported(self) -> bool:
        return is_file_supported(self.path)

    def get_extension(self) -> str:
        return Path(self.path).suffix.lower()

    def get_filename(self) -> str:
        return Path(self.path).name

    def __str__(self) -> str:
        return self.path

    def __repr__(self) -> str:
        return f"FileUrl({self.path!r})"

    def __fspath__(self) -> str:
        return self.path


T = TypeVar("T")


@dataclass(frozen=True)
class Result(Generic[T]):
    """Success-or-failure result value."""

    _value: T | None = None
    _error: str | None = None

    @property
    def is_successful(self) -> bool:
        return self._error is None

    @property
    def value(self) -> T | None:
        return self._value

    @property
    def error(self) -> str | None:
        return self._error

    @classmethod
    def success(cls, value: T) -> Result[T]:
        return cls(_value=value)

    @classmethod
    def failure(cls, error: str) -> Result[T]:
        if not error:
            raise ValueError("Result.failure requires a non-empty error message")
        return cls(_error=error)