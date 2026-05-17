"""Value object describing the granian worker count.

A worker count is either `auto` (resolved from the host's CPU count at runtime)
or a fixed positive integer. Modeling this as a value object eliminates the
`Union[int, str]` smell and keeps the resolution rule in one place.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class WebWorkerCount:
    """Either `auto` (when `_fixed` is None) or a fixed positive integer."""

    _fixed: Optional[int]

    @classmethod
    def auto(cls) -> "WebWorkerCount":
        return cls(_fixed=None)

    @classmethod
    def fixed(cls, count: int) -> "WebWorkerCount":
        if count < 1:
            raise ValueError(f"worker count must be >= 1, got {count}")
        return cls(_fixed=count)

    @property
    def is_auto(self) -> bool:
        return self._fixed is None

    def resolve(self, fallback_when_auto: int) -> int:
        if fallback_when_auto < 1:
            raise ValueError(
                f"fallback_when_auto must be >= 1, got {fallback_when_auto}"
            )
        return fallback_when_auto if self._fixed is None else self._fixed
