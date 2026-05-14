import shutil

from backend.image_converter.domain.storage import DiskUsage, StorageSummary
from backend.image_converter.domain.units import BYTES_PER_MEBIBYTE


class StorageManagementService:
    def __init__(self, is_enabled: bool):
        self.is_enabled = is_enabled

    def is_storage_management_enabled(self) -> bool:
        return self.is_enabled

    def get_disk_usage(self, path: str = "/") -> DiskUsage:
        total, used, free = shutil.disk_usage(path)
        return DiskUsage(
            total_storage_mb=round(total / BYTES_PER_MEBIBYTE, 2),
            used_storage_mb=round(used / BYTES_PER_MEBIBYTE, 2),
            available_storage_mb=round(free / BYTES_PER_MEBIBYTE, 2),
        )

    def get_storage_summary(self, path: str, used_mb: float) -> StorageSummary:
        _, _, free = shutil.disk_usage(path)
        return StorageSummary(
            used_storage_mb=used_mb,
            available_storage_mb=round(free / BYTES_PER_MEBIBYTE, 2),
        )
