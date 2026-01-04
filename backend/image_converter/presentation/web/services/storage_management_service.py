import shutil
import os

class StorageManagementService:
    @staticmethod
    def is_storage_management_enabled() -> bool:
        return os.environ.get("DISABLE_STORAGE_MANAGEMENT", "false").lower() != "true"

    @staticmethod
    def get_disk_usage(path: str = "/"):
        total, used, free = shutil.disk_usage(path)
        mib = 1024 * 1024
        return {
            "total_storage_mb": round(total / mib, 2),
            "used_storage_mb": round(used / mib, 2),
            "available_storage_mb": round(free / mib, 2),
        }
