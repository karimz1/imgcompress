"""Granian worker-count value object."""

from __future__ import annotations
from dataclasses import dataclass


@dataclass(frozen=True)
class WebWorkerCount:
    """Represents either automatic or fixed worker count."""

    _fixed: int | None = None

    @classmethod
    def auto(cls) -> WebWorkerCount:
        return cls()

    @classmethod
    def fixed(cls, count: int) -> WebWorkerCount:
        if count < 1:
            raise ValueError(f"worker count must be >= 1, got {count}")
        return cls(_fixed=count)

    @property
    def is_auto(self) -> bool:
        return self._fixed is None

    @property
    def fixed_value(self) -> int | None:
        return self._fixed

    def resolve(self, fallback_when_auto: int) -> int:
        if fallback_when_auto < 1:
            raise ValueError(
                f"fallback_when_auto must be >= 1, got {fallback_when_auto}"
            )
        return fallback_when_auto if self.is_auto else self._fixed