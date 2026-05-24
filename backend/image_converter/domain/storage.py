"""Storage-related value objects."""

from dataclasses import dataclass


@dataclass(frozen=True)
class DiskUsage:
    total_storage_mb: float
    used_storage_mb: float
    available_storage_mb: float

    def to_json_dict(self) -> dict[str, float]:
        return {
            "total_storage_mb": self.total_storage_mb,
            "used_storage_mb": self.used_storage_mb,
            "available_storage_mb": self.available_storage_mb,
        }


@dataclass(frozen=True)
class StorageSummary:
    used_storage_mb: float
    available_storage_mb: float

    def to_json_dict(self) -> dict[str, float]:
        return {
            "used_storage_mb": self.used_storage_mb,
            "available_storage_mb": self.available_storage_mb,
        }