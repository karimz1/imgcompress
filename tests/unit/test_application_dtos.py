"""Unit tests for the application-layer DTOs and their JSON projections.

Anything that crosses a service or HTTP boundary must travel as a typed DTO
(per AGENTS.md). These tests pin the wire shape so refactors of internal
field names cannot silently change the JSON contract.
"""

import dataclasses

import pytest

from backend.image_converter.application.dtos import (
    CleanedItem,
    CleanupError,
    CleanupSummary,
    CompressionFormData,
    CompressionResponse,
    CompressResult,
    ContainerFile,
    ContainerInventory,
)
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.domain.storage import DiskUsage, StorageSummary


def test_disk_usage_to_json_dict_uses_wire_field_names():
    usage = DiskUsage(total_storage_mb=1000.0, used_storage_mb=250.0, available_storage_mb=750.0)

    assert usage.to_json_dict() == {
        "total_storage_mb": 1000.0,
        "used_storage_mb": 250.0,
        "available_storage_mb": 750.0,
    }


def test_disk_usage_is_immutable():
    usage = DiskUsage(0.0, 0.0, 0.0)
    with pytest.raises(dataclasses.FrozenInstanceError):
        usage.total_storage_mb = 999.0  # type: ignore[misc]


def test_storage_summary_to_json_dict_matches_frontend_contract():
    summary = StorageSummary(used_storage_mb=12.5, available_storage_mb=87.5)

    assert summary.to_json_dict() == {
        "used_storage_mb": 12.5,
        "available_storage_mb": 87.5,
    }


def test_container_file_to_json_dict_uses_wire_field_names():
    file = ContainerFile(
        folder="converted_abc",
        folder_path="/tmp/converted_abc",
        filename="out.png",
        size_mb=1.25,
    )

    assert file.to_json_dict() == {
        "folder": "converted_abc",
        "folder_path": "/tmp/converted_abc",
        "filename": "out.png",
        "size_mb": 1.25,
    }


def test_container_inventory_serializes_nested_files():
    file_a = ContainerFile("f1", "/tmp/f1", "a.png", 1.0)
    file_b = ContainerFile("f2", "/tmp/f2", "b.png", 2.5)
    inventory = ContainerInventory(files=[file_a, file_b], total_size_mb=3.5, total_count=2)

    assert inventory.to_json_dict() == {
        "files": [
            {"folder": "f1", "folder_path": "/tmp/f1", "filename": "a.png", "size_mb": 1.0},
            {"folder": "f2", "folder_path": "/tmp/f2", "filename": "b.png", "size_mb": 2.5},
        ],
        "total_size_mb": 3.5,
        "total_count": 2,
    }


def test_container_inventory_defaults_to_empty():
    inventory = ContainerInventory()

    assert inventory.files == []
    assert inventory.total_size_mb == 0.0
    assert inventory.total_count == 0
    assert inventory.to_json_dict() == {
        "files": [],
        "total_size_mb": 0.0,
        "total_count": 0,
    }


def test_cleaned_item_serializes_kind_as_type_for_legacy_contract():
    item = CleanedItem(kind="directory", path="/tmp/converted_abc")

    assert item.to_json_dict() == {"type": "directory", "path": "/tmp/converted_abc"}


def test_cleanup_error_includes_error_field():
    err = CleanupError(kind="zip", path="/tmp/out.zip", error="boom")

    assert err.to_json_dict() == {
        "type": "zip",
        "path": "/tmp/out.zip",
        "error": "boom",
    }


def test_cleanup_summary_separates_deleted_and_errors():
    summary = CleanupSummary(
        deleted=[CleanedItem(kind="directory", path="/tmp/a")],
        errors=[CleanupError(kind="zip", path="/tmp/b.zip", error="locked")],
    )

    assert summary.to_json_dict() == {
        "deleted": [{"type": "directory", "path": "/tmp/a"}],
        "errors": [{"type": "zip", "path": "/tmp/b.zip", "error": "locked"}],
    }


def test_cleanup_summary_defaults_are_empty_lists():
    summary = CleanupSummary()

    assert summary.deleted == []
    assert summary.errors == []


def test_compress_result_to_json_dict_uses_wire_keys():
    result = CompressResult(processed_files=["a.png", "b.png"], errors=["c: boom"])

    assert result.to_json_dict() == {
        "processed_files": ["a.png", "b.png"],
        "errors": ["c: boom"],
    }


def test_compression_response_to_json_dict_preserves_compress_endpoint_contract():
    summary = CompressResult(processed_files=["out.png"], errors=[])
    response = CompressionResponse(
        converted_files=["out.png"],
        dest_folder="/tmp/converted_abc",
        process_summary=summary,
    )

    assert response.to_json_dict() == {
        "converted_files": ["out.png"],
        "dest_folder": "/tmp/converted_abc",
        "process_summary": {"processed_files": ["out.png"], "errors": []},
    }


def test_compression_form_data_is_immutable_value_object():
    data = CompressionFormData(
        uploaded_files=(),
        quality=85,
        width=None,
        image_format=ImageFormat.JPEG,
        target_size_kb=None,
        use_rembg=False,
        pdf_preset="",
        pdf_scale="",
        pdf_margin_mm=10.0,
        pdf_paginate=False,
    )
    with pytest.raises(dataclasses.FrozenInstanceError):
        data.quality = 50  # type: ignore[misc]
