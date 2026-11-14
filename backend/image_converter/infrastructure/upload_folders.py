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
# Deeper folders are joined into the last level instead of being dropped.
MAX_FOLDER_DEPTH = 20

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
    parts = [p for p in parts if p]
    if len(parts) > MAX_FOLDER_DEPTH:
        keep = MAX_FOLDER_DEPTH - 1
        parts = parts[:keep] + ["_".join(parts[keep:])]
    return [_cap(p) for p in parts]


class UploadTree:
    """Creates the folders of one upload below ``root``.

    Folder names are matched without regard to case, so "Case" and "case"
    end up in one folder (the first spelling wins) and the ZIP unpacks the
    same on macOS and Windows. A folder whose name is already taken by a file
    gets a counter ("holiday.png_1") instead of failing the upload.
    """

    def __init__(self, root: str):
        self.root = root
        # casefolded relative path -> relative path on disk
        self._folders: Dict[str, str] = {"": ""}

    def folder_for(self, relative_dir: Optional[str]) -> str:
        """Absolute path of the folder for ``relative_dir``, created if needed."""
        key, actual = "", ""
        for segment in folder_segments(relative_dir):
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
