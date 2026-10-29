"""Lets long steps report progress to the background job running them.

A job sets a reporter for its own thread; code deep inside the conversion
(the upscaler's tile loop, the per-file loop) just calls ``report``. Without a
reporter, for example in the CLI, ``report`` does nothing.
"""

import threading
from contextlib import contextmanager
from typing import Callable, Optional

_local = threading.local()

Reporter = Callable[[dict], None]


@contextmanager
def reporting_to(reporter: Reporter):
    previous: Optional[Reporter] = getattr(_local, "reporter", None)
    _local.reporter = reporter
    try:
        yield
    finally:
        _local.reporter = previous


def report(**fields) -> None:
    reporter: Optional[Reporter] = getattr(_local, "reporter", None)
    if reporter is None:
        return
    try:
        reporter(fields)
    except Exception:
        # Progress is only a hint; it must never break the conversion.
        pass
