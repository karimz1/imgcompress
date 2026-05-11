import shutil

from backend.image_converter.config import settings


class StorageManagementService:
    @staticmethod
    def is_storage_management_enabled() -> bool:
        return settings.storage_management_enabled()

    @staticmethod
    def get_disk_usage(path: str = "/"):
        total, used, free = shutil.disk_usage(path)
        per_mb = settings.bytes_per_megabyte()
        return {
            "total_storage_mb": round(total / per_mb, 2),
            "used_storage_mb": round(used / per_mb, 2),
            "available_storage_mb": round(free / per_mb, 2),
        }

    def get_storage_summary(self, path: str, used_mb: float) -> dict:
        _, _, free = shutil.disk_usage(path)
        per_mb = settings.bytes_per_megabyte()
        return {
            "used_storage_mb": used_mb,
            "available_storage_mb": round(free / per_mb, 2),
        }
