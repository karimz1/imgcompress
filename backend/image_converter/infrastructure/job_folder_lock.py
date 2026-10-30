"""Marks temp job folders as in use, across all Granian worker processes.

A running job holds a shared ``flock`` on its folder. Cleanup only deletes a
folder after it gets an exclusive lock without waiting, so folders of running
jobs are skipped. The kernel drops the lock when the job closes it or its
process dies, so a crashed job can never block cleanup.

Only real folders are locked: a link or a file raises instead of being
followed, so a lock never reaches outside the folder it was given.
"""

import os
from typing import Optional

try:
    import fcntl
except ImportError:  # Not POSIX: no cross-process locking, cleanup behaves as before.
    fcntl = None

_FOLDER_ONLY = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)


def hold_shared(path: str) -> Optional[int]:
    """Lock ``path`` for a running job. Raises FileNotFoundError if cleanup removed it first."""
    if fcntl is None:
        return None
    fd = os.open(path, _FOLDER_ONLY)
    try:
        fcntl.flock(fd, fcntl.LOCK_SH)
        # Cleanup may have deleted the folder between its creation and our
        # lock; a removed directory has no links left.
        if os.fstat(fd).st_nlink == 0:
            raise FileNotFoundError(path)
    except BaseException:
        os.close(fd)
        raise
    return fd


def try_exclusive(path: str) -> tuple[bool, Optional[int]]:
    """Returns (acquired, fd). acquired is False while a job still holds the folder."""
    if fcntl is None:
        return True, None
    fd = os.open(path, _FOLDER_ONLY)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        os.close(fd)
        return False, None
    except BaseException:
        os.close(fd)
        raise
    return True, fd


def release(fd: Optional[int]) -> None:
    if fd is not None:
        os.close(fd)
