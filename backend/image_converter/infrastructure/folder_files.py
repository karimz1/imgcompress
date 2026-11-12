"""Lists the files of a result folder, including those in its sub folders."""

import os
from typing import List


def list_files(folder: str) -> List[str]:
    """Paths of all files below ``folder``, relative to it, "/"-separated and sorted.

    Uploaded folders keep their layout in the results, so a file can sit in a
    sub folder ("holiday/day1/photo.avif"). Links are not followed.
    """
    found: List[str] = []
    for current, _dirs, names in os.walk(folder):
        relative_dir = os.path.relpath(current, folder).replace(os.sep, "/")
        for name in names:
            if os.path.isfile(os.path.join(current, name)):
                found.append(name if relative_dir == "." else f"{relative_dir}/{name}")
    return sorted(found)
