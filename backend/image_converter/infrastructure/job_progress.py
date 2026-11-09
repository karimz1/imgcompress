"""Lets long steps report progress to the background job running them.

A job sets a reporter for its own thread; code deep inside the conversion
(the upscaler's tile loop, the per-file loop) just calls ``report``. Without a
reporter, for example in the CLI, ``report`` does nothing.

The same thread can also check a cancel flag on every ``report``, so a long
upscale stops between tiles when the user hits Cancel.
"""

import threading
from contextlib import contextmanager
from typing import Callable, Optional

_local = threading.local()

Reporter = Callable[[dict], None]
CancelCheck = Callable[[], bool]


class JobCanceled(Exception):
    """The user asked to stop this job; the worker should finish as canceled."""


@contextmanager
def reporting_to(reporter: Reporter, cancel_check: Optional[CancelCheck] = None):
    previous_reporter: Optional[Reporter] = getattr(_local, "reporter", None)
    previous_check: Optional[CancelCheck] = getattr(_local, "cancel_check", None)
    _local.reporter = reporter
    _local.cancel_check = cancel_check
    try:
        yield
    finally:
        _local.reporter = previous_reporter
        _local.cancel_check = previous_check


def check_canceled() -> None:
    """Raises JobCanceled when the running job's cancel flag is set."""
    checker: Optional[CancelCheck] = getattr(_local, "cancel_check", None)
    if checker is not None and checker():
        raise JobCanceled()


def report(**fields) -> None:
    check_canceled()
    reporter: Optional[Reporter] = getattr(_local, "reporter", None)
    if reporter is None:
        return
    try:
        reporter(fields)
    except JobCanceled:
        raise
    except Exception:
        # Progress is only a hint; it must never break the conversion.
        pass
