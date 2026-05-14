"""Unit tests for `CleanupService` — focused on the DTO contract.

These cover the typed shape returned by `cleanup_temp_folders` and
`get_container_files`, plus the path-prefix selection rules. They do not
re-test deletion timing logic in detail; that is what `expiration_time` plus
file mtime fixtures handle in integration tests.
"""

import os
import time

from backend.image_converter.application.dtos import (
    CleanedItem,
    CleanupError,
    CleanupSummary,
    ContainerFile,
    ContainerInventory,
)
from backend.image_converter.infrastructure.cleanup_service import CleanupService


class _Logger:
    def __init__(self):
        self.messages = []

    def log(self, message, level="info"):
        self.messages.append((level, message))


def test_get_container_files_returns_typed_inventory(tmp_path):
    folder = tmp_path / "converted_abc"
    folder.mkdir()
    (folder / "a.png").write_bytes(b"x" * 2048)
    (tmp_path / "converted_xyz.zip").write_bytes(b"y" * 1024)

    svc = CleanupService(str(tmp_path), expiration_time=3600, logger=_Logger())

    inventory = svc.get_container_files()

    assert isinstance(inventory, ContainerInventory)
    assert inventory.total_count == 2
    assert all(isinstance(f, ContainerFile) for f in inventory.files)
    filenames = sorted(f.filename for f in inventory.files)
    assert filenames == ["a.png", "converted_xyz.zip"]


def test_get_container_files_skips_unrelated_entries(tmp_path):
    (tmp_path / "random_folder").mkdir()
    (tmp_path / "random_folder" / "file.txt").write_bytes(b"x")
    (tmp_path / "random_file.txt").write_bytes(b"y")
    (tmp_path / "source_abc").mkdir()
    (tmp_path / "source_abc" / "src.png").write_bytes(b"z")

    svc = CleanupService(str(tmp_path), expiration_time=3600, logger=_Logger())

    inventory = svc.get_container_files()

    assert inventory.total_count == 0


def test_get_container_files_zip_uses_temp_dir_as_folder_path(tmp_path):
    (tmp_path / "converted_xyz.zip").write_bytes(b"x" * 4096)

    svc = CleanupService(str(tmp_path), expiration_time=3600, logger=_Logger())

    inventory = svc.get_container_files()

    assert inventory.total_count == 1
    only = inventory.files[0]
    assert only.folder == "zip"
    assert only.folder_path == str(tmp_path)
    assert only.filename == "converted_xyz.zip"


def test_cleanup_temp_folders_returns_typed_summary(tmp_path):
    fresh = tmp_path / "converted_fresh"
    fresh.mkdir()
    (fresh / "a.png").write_bytes(b"x")

    svc = CleanupService(str(tmp_path), expiration_time=999_999, logger=_Logger())

    result = svc.cleanup_temp_folders(force=False)

    assert result.is_successful
    summary = result.value
    assert isinstance(summary, CleanupSummary)
    assert summary.errors == []
    assert summary.deleted == []
    assert all(isinstance(item, CleanedItem) for item in summary.deleted)
    assert os.path.isdir(fresh)


def test_cleanup_temp_folders_force_records_deleted_items(tmp_path):
    folder = tmp_path / "converted_abc"
    folder.mkdir()
    zip_path = tmp_path / "converted_xyz.zip"
    zip_path.write_bytes(b"x")

    svc = CleanupService(str(tmp_path), expiration_time=3600, logger=_Logger())

    summary = svc.cleanup_temp_folders(force=True).value

    kinds = sorted(item.kind for item in summary.deleted)
    assert kinds == ["directory", "zip"]
    assert not folder.exists()
    assert not zip_path.exists()


def test_cleanup_temp_folders_records_errors_with_typed_dto(tmp_path, monkeypatch):
    folder = tmp_path / "converted_abc"
    folder.mkdir()

    svc = CleanupService(str(tmp_path), expiration_time=3600, logger=_Logger())

    def _boom(*_args, **_kwargs):
        raise PermissionError("locked")

    monkeypatch.setattr(
        "backend.image_converter.infrastructure.cleanup_service.shutil.rmtree",
        _boom,
    )
    monkeypatch.setattr(
        "backend.image_converter.infrastructure.cleanup_service.os.path.getctime",
        lambda _p: time.time() - 999_999,
    )

    summary = svc.cleanup_temp_folders(force=True).value

    assert len(summary.errors) == 1
    err = summary.errors[0]
    assert isinstance(err, CleanupError)
    assert err.kind == "directory"
    assert err.path == str(folder)
    assert "locked" in err.error
