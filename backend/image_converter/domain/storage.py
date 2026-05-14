"""Value objects describing disk-usage and storage-summary readings.

Both objects use binary mebibytes (MiB) — see `domain.units.BYTES_PER_MEBIBYTE`.
They are immutable, carry no behavior, and exist so that callers (and the wire
contract) get a typed shape instead of an anonymous dictionary.
"""

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class DiskUsage:
    total_storage_mb: float
    used_storage_mb: float
    available_storage_mb: float

    def to_json_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class StorageSummary:
    used_storage_mb: float
    available_storage_mb: float

    def to_json_dict(self) -> dict:
        return asdict(self)
