"""Dropped folders keep their layout: results and the ZIP mirror the uploaded tree."""

import io
import zipfile
from io import BytesIO

import pytest
from PIL import Image
from werkzeug.datastructures import FileStorage
from werkzeug.test import EnvironBuilder
from werkzeug.wrappers import Request

from backend.image_converter.application.compress_images_usecase import CompressImagesUseCase
from backend.image_converter.application.dtos import CompressionFormData
from backend.image_converter.application.payload_expander_factory import create_payload_expander
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.core.factory.converter_factory import ImageConverterFactory
from backend.image_converter.domain.image_resizer import ImageResizer
from backend.image_converter.infrastructure.cleanup_service import CleanupService
from backend.image_converter.infrastructure.folder_files import list_files
from backend.image_converter.infrastructure.local_storage import LocalStorage
from backend.image_converter.presentation.web.parse_services import extract_form_data
from backend.image_converter.presentation.web.services.compression_service import CompressionService
from backend.image_converter.presentation.web.services.temporary_folder_service import (
    TemporaryFolderService,
)


class _Logger:
    def log(self, *_args, **_kwargs):
        pass


def _png() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (8, 8), "red").save(buffer, format="PNG")
    return buffer.getvalue()


def _upload(name):
    return FileStorage(stream=BytesIO(_png()), filename=name)


def _form_data(names, relative_dirs, image_format=ImageFormat.JPEG) -> CompressionFormData:
    return CompressionFormData(
        uploaded_files=tuple(_upload(n) for n in names),
        quality=80,
        width=None,
        image_format=image_format,
        target_size_kb=None,
        use_rembg=False,
        pdf_preset="",
        pdf_scale="",
        pdf_margin_mm=10.0,
        pdf_paginate=False,
        relative_dirs=tuple(relative_dirs),
    )


@pytest.fixture
def service(tmp_path):
    logger = _Logger()
    use_case = CompressImagesUseCase(
        logger, ImageResizer(), ImageConverterFactory, LocalStorage(), create_payload_expander(logger)
    )
    folders = TemporaryFolderService(str(tmp_path), 3600, logger)
    return CompressionService(logger, use_case, folders)


def test_storage_lists_nested_files_with_their_folder(tmp_path):
    (tmp_path / "a" / "b").mkdir(parents=True)
    (tmp_path / "top.png").write_bytes(b"1")
    (tmp_path / "a" / "mid.png").write_bytes(b"2")
    (tmp_path / "a" / "b" / "deep.png").write_bytes(b"3")

    items = [(i.relative_dir, i.name) for i in LocalStorage().iter_files(str(tmp_path))]

    assert items == [("", "top.png"), ("a", "mid.png"), ("a/b", "deep.png")]


def test_storage_lists_nothing_for_a_missing_folder(tmp_path):
    assert list(LocalStorage().iter_files(str(tmp_path / "missing"))) == []


def test_uploads_are_saved_in_their_folders(tmp_path, service):
    files = [_upload("test3.jpg"), _upload("test2.jpg"), _upload("test1.jpg")]

    result = service._save_uploaded_files(files, str(tmp_path), ("n1/n2", "n1", ""))

    assert result.is_successful
    assert list_files(str(tmp_path)) == ["n1/n2/test3.jpg", "n1/test2.jpg", "test1.jpg"]


def test_same_name_in_the_same_folder_still_gets_a_counter(tmp_path, service):
    files = [_upload("a.png"), _upload("a.png")]

    service._save_uploaded_files(files, str(tmp_path), ("x", "x"))

    assert list_files(str(tmp_path)) == ["x/a.png", "x/a_1.png"]


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("holiday/day1", ["holiday", "day1"]),
        ("/holiday//day1/", ["holiday", "day1"]),
        ("..", []),
        ("../../etc", ["etc"]),
        ("a/./b/../c", ["a", "b", "c"]),
        ("C:\\Users\\me\\pics", ["C_", "Users", "me", "pics"]),
        ("写真/Фото", ["写真", "Фото"]),
        ("", []),
        (None, []),
        ("a/" + "b" * 300, ["a", "b" * 100]),
        ("/".join(f"d{i}" for i in range(40)), [f"d{i}" for i in range(20)]),
    ],
)
def test_folder_segments_can_never_leave_the_upload_folder(raw, expected):
    assert CompressionService._folder_segments(raw) == expected


def test_a_hostile_folder_stays_inside_the_upload_folder(tmp_path, service):
    upload_root = tmp_path / "source"

    service._save_uploaded_files([_upload("a.png")], str(upload_root), ("../../escape",))

    assert list_files(str(upload_root)) == ["escape/a.png"]
    assert not (tmp_path / "escape").exists()


def test_conversion_mirrors_the_uploaded_tree(tmp_path, service):
    prepared = service.prepare(
        _form_data(
            ["test1.png", "test2.png", "test3.png"],
            ["", "test-nested1", "test-nested1/test-nested2"],
        )
    )
    assert prepared.is_successful, prepared.error

    result = service.run(prepared.value)

    assert result.is_successful, result.error
    assert result.value.converted_files == [
        "test-nested1/test-nested2/test3.jpg",
        "test-nested1/test2.jpg",
        "test1.jpg",
    ]
    assert list_files(result.value.dest_folder) == result.value.converted_files


def test_same_file_name_in_two_folders_does_not_clash(service):
    prepared = service.prepare(_form_data(["photo.png", "photo.png"], ["a", "b"]))

    result = service.run(prepared.value)

    assert result.value.converted_files == ["a/photo.jpg", "b/photo.jpg"]


def test_conversion_without_folders_stays_flat(service):
    prepared = service.prepare(_form_data(["a.png", "b.png"], []))

    result = service.run(prepared.value)

    assert result.value.converted_files == ["a.jpg", "b.jpg"]


def test_zip_keeps_the_folder_layout(service):
    prepared = service.prepare(_form_data(["a.png", "b.png"], ["", "x/y"]))
    result = service.run(prepared.value)

    archive = service.create_all_files_zip(result.value.dest_folder)

    assert archive.is_successful
    with zipfile.ZipFile(archive.value) as zf:
        assert sorted(zf.namelist()) == ["a.jpg", "x/y/b.jpg"]


def test_nested_result_can_be_downloaded(service):
    prepared = service.prepare(_form_data(["a.png"], ["x/y"]))
    result = service.run(prepared.value)

    target = service.temp_folder_service.resolve_download_target(result.value.dest_folder, "x/y/a.jpg")

    assert target is not None
    assert target.download_name == "a.jpg"
    assert target.folder_path == result.value.dest_folder
    assert service.temp_folder_service.resolve_download_target(result.value.dest_folder, "x/../../a.jpg") is None


def test_storage_manager_lists_nested_results(tmp_path, service):
    prepared = service.prepare(_form_data(["a.png", "b.png"], ["", "x"]))
    service.run(prepared.value)

    inventory = CleanupService(str(tmp_path), 3600, _Logger()).get_container_files()

    assert sorted(f.filename for f in inventory.files) == ["a.jpg", "x/b.jpg"]
    assert inventory.total_count == 2


def _request(form, files):
    data = {**form, "files[]": [FileStorage(stream=io.BytesIO(b"x"), filename=n) for n in files]}
    return Request(EnvironBuilder(method="POST", data=data).get_environ())


def test_the_request_carries_one_folder_per_file():
    request = _request({"format": "jpeg", "relative_dirs[]": ["a/b", ""]}, ["x.png", "y.png"])

    result = extract_form_data(request, _Logger())

    assert result.is_successful
    assert result.value.relative_dirs == ("a/b", "")


def test_a_request_without_folders_has_none():
    result = extract_form_data(_request({"format": "jpeg"}, ["x.png"]), _Logger())

    assert result.value.relative_dirs == ()


def test_the_request_is_refused_when_folders_and_files_do_not_match():
    request = _request({"format": "jpeg", "relative_dirs[]": ["a"]}, ["x.png", "y.png"])

    result = extract_form_data(request, _Logger())

    assert not result.is_successful
    assert "folder" in result.error
