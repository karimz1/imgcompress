"""Unit tests for `StorageManagementService` — DTO contract and conversion math."""

from backend.image_converter.domain.storage import DiskUsage, StorageSummary
from backend.image_converter.domain.units import BYTES_PER_MEBIBYTE
from backend.image_converter.presentation.web.services.storage_management_service import (
    StorageManagementService,
)


class _ShutilStub:
    def __init__(self, total: int, used: int, free: int):
        self.total = total
        self.used = used
        self.free = free

    def disk_usage(self, _path):
        return (self.total, self.used, self.free)


def test_is_storage_management_enabled_returns_constructor_value():
    assert StorageManagementService(is_enabled=True).is_storage_management_enabled() is True
    assert StorageManagementService(is_enabled=False).is_storage_management_enabled() is False


def test_get_disk_usage_returns_dto_in_mebibytes(monkeypatch):
    monkeypatch.setattr(
        "backend.image_converter.presentation.web.services.storage_management_service.shutil",
        _ShutilStub(total=4 * BYTES_PER_MEBIBYTE, used=BYTES_PER_MEBIBYTE, free=3 * BYTES_PER_MEBIBYTE),
    )

    usage = StorageManagementService(is_enabled=True).get_disk_usage("/tmp")

    assert isinstance(usage, DiskUsage)
    assert usage.total_storage_mb == 4.0
    assert usage.used_storage_mb == 1.0
    assert usage.available_storage_mb == 3.0


def test_get_storage_summary_returns_dto_with_provided_used_mb(monkeypatch):
    monkeypatch.setattr(
        "backend.image_converter.presentation.web.services.storage_management_service.shutil",
        _ShutilStub(total=0, used=0, free=5 * BYTES_PER_MEBIBYTE),
    )

    summary = StorageManagementService(is_enabled=True).get_storage_summary("/tmp", used_mb=2.5)

    assert isinstance(summary, StorageSummary)
    assert summary.used_storage_mb == 2.5
    assert summary.available_storage_mb == 5.0
