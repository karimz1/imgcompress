"""Files of one batch must never overwrite each other, on upload or on output."""

import io

import pytest

from backend.image_converter.application.compress_images_usecase import CompressImagesUseCase
from backend.image_converter.presentation.web.services.compression_service import CompressionService
from backend.image_converter.presentation.web.services.temporary_folder_service import (
    TemporaryFolderService,
)


class _Logger:
    def log(self, *_args, **_kwargs):
        pass


class _Upload:
    def __init__(self, filename, data=b"data"):
        self.filename = filename
        self.stream = io.BytesIO(data)


@pytest.mark.parametrize(
    ("original", "expected"),
    [
        ("photo.png", "photo.png"),
        ("../../etc/x.png", "etc_x.png"),
        ("é.png", "e.png"),
        ("фото.png", "upload_3.png"),
        ("写真.JPG", "upload_3.JPG"),
        ("фото", "upload_3"),
        ("", "upload_3"),
        (None, "upload_3"),
        ("README", "README"),
    ],
)
def test_upload_name_falls_back_when_secure_filename_drops_stem_or_extension(original, expected):
    assert CompressionService._upload_name(original, 3) == expected


def test_saved_uploads_with_the_same_name_get_a_counter(tmp_path):
    service = CompressionService(_Logger(), use_case=None, temp_folder_service=None)
    files = [_Upload("photo.png", b"1"), _Upload("photo.png", b"2"), _Upload("photo_1.png", b"3")]

    assert service._save_uploaded_files(files, str(tmp_path)).is_successful

    saved = {p.name: p.read_bytes() for p in tmp_path.iterdir()}
    assert saved == {"photo.png": b"1", "photo_1.png": b"2", "photo_1_1.png": b"3"}


def test_non_ascii_names_do_not_collide(tmp_path):
    service = CompressionService(_Logger(), use_case=None, temp_folder_service=None)

    service._save_uploaded_files([_Upload("фото.png", b"1"), _Upload("картинка.png", b"2")], str(tmp_path))

    assert sorted(p.name for p in tmp_path.iterdir()) == ["upload_1.png", "upload_2.png"]


def test_reserve_dest_name_adds_counter_for_names_already_used_in_the_batch():
    reserved = set()

    names = [CompressImagesUseCase._reserve_dest_name(n, reserved) for n in
             ["photo.jpg", "photo.jpg", "photo_1.jpg", "other.jpg", "photo.jpg"]]

    assert names == ["photo.jpg", "photo_1.jpg", "photo_1_1.jpg", "other.jpg", "photo_2.jpg"]


@pytest.mark.parametrize(
    "folder",
    ["", ".", "source_abc", "converted_abc/nested", "imgcompress-backend.log", "other_dir"],
)
def test_download_only_serves_direct_converted_folders(tmp_path, folder):
    (tmp_path / "source_abc").mkdir()
    (tmp_path / "source_abc" / "a.png").write_bytes(b"x")
    (tmp_path / "converted_abc" / "nested").mkdir(parents=True)
    (tmp_path / "converted_abc" / "nested" / "a.png").write_bytes(b"x")
    (tmp_path / "other_dir").mkdir()
    (tmp_path / "other_dir" / "a.png").write_bytes(b"x")
    (tmp_path / "a.png").write_bytes(b"x")
    (tmp_path / "imgcompress-backend.log").write_text("log")
    service = TemporaryFolderService(str(tmp_path), 3600, _Logger())

    target = folder if folder else str(tmp_path)
    assert service.resolve_download_target(target, "a.png") is None
    assert service.resolve_download_target(str(tmp_path), "imgcompress-backend.log") is None
    assert service.get_validated_path(target) is None


def test_download_accepts_direct_converted_folder(tmp_path):
    (tmp_path / "converted_abc").mkdir()
    (tmp_path / "converted_abc" / "a.png").write_bytes(b"x")
    service = TemporaryFolderService(str(tmp_path), 3600, _Logger())

    assert service.resolve_download_target(str(tmp_path / "converted_abc"), "a.png") is not None
    assert service.get_validated_path("converted_abc") == str(tmp_path / "converted_abc")
