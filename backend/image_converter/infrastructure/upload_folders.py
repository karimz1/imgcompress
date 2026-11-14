"""Turns the folder of an uploaded file ("holiday/day1") into safe folder names.

The browser sends the folder each dropped file came from. It is user input, so
every name is cleaned until nothing changes any more, ".", ".." and empty names
are dropped, and the final path is checked to stay inside the upload folder.
Folder names keep non-ASCII letters (unlike file names, which go through
secure_filename()).
"""

import hashlib
import os
import re
import unicodedata
from typing import Dict, List, Optional

from backend.image_converter.infrastructure.safe_path import path_inside

# Most file systems allow 255 bytes per name; stay well below for the suffixes.
MAX_FOLDER_NAME_BYTES = 200
# Room kept below the folder for the longest file name a job can write.
_FILE_NAME_ROOM_BYTES = 255
# Used when the file system does not report its own limit.
_FALLBACK_PATH_MAX = 4096

_INVALID_CHARS = re.compile(r'[\x00-\x1f\x7f<>:"|?*]')
_HASH_LENGTH = 8
# Names Windows refuses to create, even with an extension ("CON.txt").
_RESERVED_NAMES = {"CON", "PRN", "AUX", "NUL"} | {f"{p}{n}" for p in ("COM", "LPT") for n in range(1, 10)}


def _clean(name: str) -> str:
    name = unicodedata.normalize("NFC", name)
    while True:
        cleaned = _INVALID_CHARS.sub("_", name).strip().rstrip(".").strip()
        if cleaned == name:
            break
        name = cleaned
    if name in (".", ".."):
        return ""
    if name.split(".")[0].upper() in _RESERVED_NAMES:
        name = f"{name}_"
    return name


def _cap(name: str) -> str:
    """At most MAX_FOLDER_NAME_BYTES of UTF-8, cut on a character boundary.

    A cut name gets a short hash of the full name, so two long names that
    only differ after the cut stay two folders.
    """
    encoded = name.encode("utf-8")
    if len(encoded) <= MAX_FOLDER_NAME_BYTES:
        return name
    digest = hashlib.sha1(encoded).hexdigest()[:_HASH_LENGTH]
    keep = MAX_FOLDER_NAME_BYTES - _HASH_LENGTH - 1
    head = encoded[:keep].decode("utf-8", errors="ignore").rstrip(". ")
    return f"{head}~{digest}"


def folder_segments(relative_dir: Optional[str]) -> List[str]:
    """The cleaned folder names of ``relative_dir``; never ".", ".." or empty."""
    parts = [_clean(p) for p in re.split(r"[/\\]", relative_dir or "")]
    return [_cap(p) for p in parts if p]


class FolderPathTooLong(ValueError):
    """The uploaded tree is deeper or longer than the file system allows."""

    def __init__(self):
        super().__init__(
            "A dropped folder is nested too deep or its names are too long to keep its layout. "
            "Shorten the folder names or drop a folder further down the tree."
        )


def _path_max(folder: str) -> int:
    try:
        return int(os.pathconf(folder, "PC_PATH_MAX"))
    except (OSError, ValueError):
        return _FALLBACK_PATH_MAX


class UploadTree:
    """Creates the folders of one upload below ``root``.

    Folder names are matched without regard to case, so "Case" and "case"
    end up in one folder (the first spelling wins) and the ZIP unpacks the
    same on macOS and Windows. A folder whose name is already taken by a file
    gets a counter ("holiday.png_1") instead of failing the upload.

    The tree is kept as deep as it is. A folder whose path, plus room for a
    file name, would pass the file system's path limit is refused with
    FolderPathTooLong instead of being flattened.
    """

    def __init__(self, root: str):
        self.root = root
        self._path_max = _path_max(root)
        # casefolded relative path -> relative path on disk
        self._folders: Dict[str, str] = {"": ""}

    def folder_for(self, relative_dir: Optional[str]) -> str:
        """Absolute path of the folder for ``relative_dir``, created if needed."""
        segments = folder_segments(relative_dir)
        self._check_length(segments)
        key, actual = "", ""
        for segment in segments:
            key = f"{key}/{segment.casefold()}" if key else segment.casefold()
            known = self._folders.get(key)
            if known is None:
                known = self._create(actual, segment)
                self._folders[key] = known
            actual = known
        path = path_inside(self.root, *actual.split("/")) if actual else os.path.realpath(self.root)
        if path is None:
            raise ValueError("Folder outside the upload folder.")
        return path

    def _check_length(self, segments: List[str]) -> None:
        """Refuses the tree before anything is created. Counters add a few bytes, hence the margin."""
        root = os.path.realpath(self.root)
        length = len(root.encode("utf-8")) + sum(len(s.encode("utf-8")) + 8 for s in segments)
        if length + 1 + _FILE_NAME_ROOM_BYTES >= self._path_max:
            raise FolderPathTooLong()

    def _create(self, parent: str, segment: str) -> str:
        name, counter = segment, 0
        while True:
            relative = f"{parent}/{name}" if parent else name
            path = path_inside(self.root, *relative.split("/"))
            if path is None:
                raise ValueError("Folder outside the upload folder.")
            if os.path.isdir(path) and not os.path.islink(path):
                return relative
            if not os.path.lexists(path):
                os.mkdir(path)
                return relative
            counter += 1
            name = f"{segment}_{counter}"
