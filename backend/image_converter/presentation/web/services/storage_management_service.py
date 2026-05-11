import shutil


class StorageManagementService:
    def __init__(self, enabled: bool, bytes_per_megabyte: int):
        self.enabled = enabled
        self.bytes_per_megabyte = bytes_per_megabyte

    def is_storage_management_enabled(self) -> bool:
        return self.enabled

    def get_disk_usage(self, path: str = "/"):
        total, used, free = shutil.disk_usage(path)
        return {
            "total_storage_mb": round(total / self.bytes_per_megabyte, 2),
            "used_storage_mb": round(used / self.bytes_per_megabyte, 2),
            "available_storage_mb": round(free / self.bytes_per_megabyte, 2),
        }

    def get_storage_summary(self, path: str, used_mb: float) -> dict:
        _, _, free = shutil.disk_usage(path)
        return {
            "used_storage_mb": used_mb,
            "available_storage_mb": round(free / self.bytes_per_megabyte, 2),
        }
