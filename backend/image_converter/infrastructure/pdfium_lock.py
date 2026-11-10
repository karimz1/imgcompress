"""PDFium calls must be serialized across all threads in a worker process."""

from threading import RLock

PDFIUM_LOCK = RLock()
