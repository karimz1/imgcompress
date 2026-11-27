"""Dropped folders keep their layout: results and the ZIP mirror the uploaded tree."""

import dataclasses
import io
import unicodedata
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
from backend.image_converter.infrastructure import upload_folders
from backend.image_converter.infrastructure.local_storage import LocalStorage
from backend.image_converter.infrastructure.safe_path import path_inside
from backend.image_converter.infrastructure.upload_folders import (
    MAX_FOLDER_NAME_BYTES,
    FolderPathTooLong,
    UploadTree,
    folder_segments,
)
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
        # Names that only become ".." after a second cleaning pass.
        (".. .", []),
        ("..  .", []),
        (" .. ", []),
        (". . .", []),
        (".. ./.. ./etc", ["etc"]),
        ("a/.. ./b", ["a", "b"]),
        ("..\\..\\windows", ["windows"]),
        ("\\\\server\\share", ["server", "share"]),
        ("/etc/passwd", ["etc", "passwd"]),
        ("C:/Windows", ["C_", "Windows"]),
        ("a\x00b/..\x00", ["a_b", ".._"]),
        ("%2e%2e/%2e%2e", ["%2e%2e", "%2e%2e"]),
        ("x.", ["x"]),
        ("CON/nul.txt", ["CON_", "nul.txt_"]),
    ],
)
def test_folder_segments_can_never_leave_the_upload_folder(raw, expected):
    assert CompressionService._folder_segments(raw) == expected


@pytest.mark.parametrize(
    "hostile",
    [".. .", "..  .", " .. ", ".. ./.. ./escape", "..\\..\\escape", "/tmp/escape", ".. .\\.. ./escape"],
)
def test_hostile_folders_never_leave_the_upload_folder(tmp_path, service, hostile):
    upload_root = tmp_path / "jobs" / "source"

    result = service._save_uploaded_files([_upload("pwn.png")], str(upload_root), (hostile,))

    assert result.is_successful
    saved = list_files(str(upload_root))
    assert len(saved) == 1 and saved[0].endswith("pwn.png")
    assert sorted(p.name for p in tmp_path.rglob("pwn.png")) == ["pwn.png"]
    assert not (tmp_path / "escape").exists() and not (tmp_path / "jobs" / "escape").exists()


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


# --- Hardening: names, limits, collisions -----------------------------------

def _run(service, names, relative_dirs, image_format=ImageFormat.JPEG):
    prepared = service.prepare(_form_data(names, relative_dirs, image_format))
    assert prepared.is_successful, prepared.error
    result = service.run(prepared.value)
    assert result.is_successful, result.error
    return result.value


def test_long_folder_names_are_capped_in_bytes_not_characters():
    (segment,) = folder_segments("写" * 100)  # 300 bytes of UTF-8

    assert len(segment.encode("utf-8")) <= MAX_FOLDER_NAME_BYTES
    assert segment.startswith("写" * 60)
    segment.encode("utf-8").decode("utf-8")  # cut on a character boundary


def test_emoji_folder_names_are_cut_on_a_character_boundary():
    (segment,) = folder_segments("📷" * 80)  # 4 bytes each

    assert len(segment.encode("utf-8")) <= MAX_FOLDER_NAME_BYTES
    assert segment.rstrip("~0123456789abcdef").strip("📷") == ""


def test_names_within_the_cap_are_kept_as_they_are():
    name = "a" * MAX_FOLDER_NAME_BYTES

    assert folder_segments(name) == [name]


def test_long_names_that_differ_after_the_cap_stay_apart():
    first, second = folder_segments("a" * 300 + "X")[0], folder_segments("a" * 300 + "Y")[0]

    assert first != second
    assert folder_segments("a" * 300 + "X") == [first]  # same name, same folder every time


def test_a_job_with_a_long_cjk_folder_name_works(service):
    result = _run(service, ["p.png"], ["写" * 100])

    (converted,) = result.converted_files
    folder, name = converted.split("/")
    assert name == "p.jpg" and len(folder.encode("utf-8")) <= MAX_FOLDER_NAME_BYTES


def test_folder_names_are_normalized_to_nfc():
    nfd = unicodedata.normalize("NFD", "Ä")
    assert folder_segments(nfd) == [unicodedata.normalize("NFC", "Ä")]


def test_nfc_and_nfd_spellings_share_one_folder(service):
    spellings = [unicodedata.normalize("NFC", "Ärger"), unicodedata.normalize("NFD", "Ärger")]

    result = _run(service, ["p.png", "p.png"], spellings)

    assert result.converted_files == ["Ärger/p.jpg", "Ärger/p_1.jpg"]


def test_deep_folders_keep_every_level():
    parts = [f"d{i}" for i in range(40)]

    assert folder_segments("/".join(parts)) == parts


def test_a_tree_30_plus_levels_deep_is_kept_in_results_and_zip(service):
    deep = "/".join(f"level{i}" for i in range(35))

    result = _run(service, ["p.png", "p.png", "q.png"], [deep, deep + "/next", deep[: deep.index("/level20")]])

    assert result.converted_files == sorted([
        "/".join(f"level{i}" for i in range(20)) + "/q.jpg",
        f"{deep}/next/p.jpg",
        f"{deep}/p.jpg",
    ])
    archive = service.create_all_files_zip(result.dest_folder)
    with zipfile.ZipFile(archive.value) as zf:
        assert sorted(zf.namelist()) == result.converted_files


def test_every_level_of_a_deep_tree_respects_the_byte_cap():
    segments = folder_segments("/".join("写" * 100 for _ in range(30)))

    assert len(segments) == 30
    assert all(len(s.encode("utf-8")) <= MAX_FOLDER_NAME_BYTES for s in segments)


def test_a_path_past_the_file_system_limit_is_refused_cleanly(tmp_path, service):
    too_long = "/".join(f"{i:02d}" + "x" * 150 for i in range(40))  # ~6 KB

    prepared = service.prepare(_form_data(["p.png"], [too_long]))

    assert not prepared.is_successful
    assert "too deep" in prepared.error
    assert str(tmp_path) not in prepared.error and "/" not in prepared.error
    assert not any(p.name.startswith(("source_", "converted_")) for p in tmp_path.iterdir())


def test_the_path_limit_is_checked_before_anything_is_created(tmp_path):
    tree = UploadTree(str(tmp_path))

    with pytest.raises(FolderPathTooLong):
        tree.folder_for("/".join("y" * 190 for _ in range(30)))
    assert list(tmp_path.iterdir()) == []


def test_the_path_limit_comes_from_the_file_system(tmp_path, monkeypatch):
    monkeypatch.setattr(upload_folders.os, "pathconf", lambda *_: 600)
    tree = UploadTree(str(tmp_path))

    tree.folder_for("short")
    with pytest.raises(FolderPathTooLong):
        tree.folder_for("/".join("z" * 100 for _ in range(4)))


def test_the_request_is_refused_with_a_400(tmp_path):
    from backend.image_converter.presentation.web import server

    files = {"files[]": (BytesIO(_png()), "p.png")}
    data = {"format": "jpeg", "relative_dirs[]": "/".join("w" * 190 for _ in range(30)), **files}
    response = server.app.test_client().post("/api/v1/jobs", data=data, content_type="multipart/form-data")

    assert response.status_code == 400
    body = response.get_data(as_text=True)
    assert "too deep" in body and "source_" not in body


def test_names_that_clean_to_the_same_folder_never_overwrite(service):
    result = _run(service, ["p.png"] * 4, ["a:b", "a_b", "x.", "x"])

    assert result.converted_files == ["a_b/p.jpg", "a_b/p_1.jpg", "x/p.jpg", "x/p_1.jpg"]


def test_folders_that_only_differ_in_case_share_one_folder(service):
    result = _run(service, ["p.png", "p.png", "q.png"], ["Case", "case", "CASE/sub"])

    assert result.converted_files == ["Case/p.jpg", "Case/p_1.jpg", "Case/sub/q.jpg"]


def test_outputs_that_only_differ_in_case_get_a_counter(service):
    result = _run(service, ["Photo.png", "photo.png"], ["x", "x"])

    assert sorted(f.casefold() for f in result.converted_files) == ["x/photo.jpg", "x/photo_1.jpg"]


def test_a_folder_named_like_an_uploaded_file_does_not_fail_the_job(service):
    result = _run(service, ["holiday.png", "other.png"], ["x", "x/holiday.png"])

    assert result.converted_files == ["x/holiday.jpg", "x/holiday.png_1/other.jpg"]


def test_an_uploaded_file_named_like_a_folder_does_not_fail_the_job(service):
    result = _run(service, ["other.png", "holiday.png"], ["x/holiday.png", "x"])

    assert sorted(result.converted_files) == ["x/holiday.png/other.jpg", "x/holiday_1.jpg"]


def test_a_folder_named_like_an_output_does_not_drop_the_file(service):
    result = _run(service, ["holiday.png", "holiday.png"], ["x", "x/holiday.avif"], ImageFormat.AVIF)

    assert sorted(result.converted_files) == ["x/holiday.avif/holiday.avif", "x/holiday_1.avif"]


def test_upload_tree_reuses_the_first_spelling(tmp_path):
    tree = UploadTree(str(tmp_path))

    first = tree.folder_for("Trip/Day1")
    second = tree.folder_for("trip/DAY1")

    assert first == second == str((tmp_path / "Trip" / "Day1").resolve())


def test_upload_tree_refuses_a_link_out_of_the_upload_folder(tmp_path):
    root = tmp_path / "source"
    root.mkdir()
    (tmp_path / "outside").mkdir()
    (root / "evil").symlink_to(tmp_path / "outside")

    with pytest.raises(ValueError):
        UploadTree(str(root)).folder_for("evil/x")
    assert not (tmp_path / "outside" / "x").exists()


@pytest.mark.parametrize("parts", [("..",), ("a", "..", ".."), ("/etc",), ("a\x00",)])
def test_path_inside_refuses_paths_outside_the_base(tmp_path, parts):
    assert path_inside(str(tmp_path), *parts) is None


def test_output_paths_outside_the_result_folder_are_refused(tmp_path):
    storage = LocalStorage()

    for name in ["../x.jpg", "a/../../x.jpg", "", "a//x.jpg"]:
        with pytest.raises(ValueError):
            storage.build_dest_path(str(tmp_path), name)
    assert storage.build_dest_path(str(tmp_path), "a/b/x.jpg") == str((tmp_path / "a" / "b" / "x.jpg").resolve())


def test_output_errors_do_not_show_container_paths(tmp_path):
    (tmp_path / "a").write_bytes(b"file, not a folder")

    with pytest.raises(ValueError) as error:
        LocalStorage().build_dest_path(str(tmp_path), "a/x.jpg")

    assert str(tmp_path) not in str(error.value)


def test_file_system_errors_in_a_job_do_not_show_container_paths():
    error = IsADirectoryError(21, "Is a directory", "/tmp/converted_abc/x/holiday.avif")

    assert CompressImagesUseCase._describe(error) == "Is a directory"


def test_a_nested_holiday_tree_keeps_every_file_apart(service):
    dirs = ["trip", "trip/sub", "trip/sub/subsub", "a", "b", "trip", "trip"]
    names = ["holiday.png"] * 5 + ["holiday.png", "holiday.jpg"]

    result = _run(service, names, dirs, ImageFormat.AVIF)

    files = result.converted_files
    assert len(set(files)) == len(names)
    assert [f for f in files if not f.startswith("trip/holiday")] == [
        "a/holiday.avif",
        "b/holiday.avif",
        "trip/sub/holiday.avif",
        "trip/sub/subsub/holiday.avif",
    ]
    assert len([f for f in files if f.count("/") == 1 and f.startswith("trip/")]) == 3

    archive = service.create_all_files_zip(result.dest_folder)
    with zipfile.ZipFile(archive.value) as zf:
        assert sorted(zf.namelist()) == result.converted_files


def test_a_psd_and_a_png_with_the_same_name_both_survive(service):
    from psd_tools import PSDImage

    psd = BytesIO()
    PSDImage.frompil(Image.new("RGB", (8, 8), "blue")).save(psd)
    form = _form_data(["holiday.png"], ["trip"], ImageFormat.AVIF)
    form = dataclasses.replace(
        form,
        uploaded_files=form.uploaded_files + (FileStorage(stream=BytesIO(psd.getvalue()), filename="holiday.psd"),),
        relative_dirs=("trip", "trip"),
    )
    prepared = service.prepare(form)
    result = service.run(prepared.value)

    assert result.is_successful, result.error
    assert result.value.converted_files == ["trip/holiday.avif", "trip/holiday_1.avif"]


def test_the_zip_never_contains_unsafe_entries(service):
    result = _run(service, ["p.png", "p.png", "p.png"], [".. ./.. ./x", "/abs/y", "..\\..\\z"])

    archive = service.create_all_files_zip(result.dest_folder)
    with zipfile.ZipFile(archive.value) as zf:
        names = zf.namelist()
    assert names and all(not n.startswith("/") and ".." not in n.split("/") and "\\" not in n for n in names)


def test_capped_names_leave_room_below_the_file_system_limit():
    assert MAX_FOLDER_NAME_BYTES + 9 < 255


# --- "Keep folder structure" switch off: the browser sends no folders --------


def test_without_folders_same_named_files_from_different_folders_get_unique_names(service):
    # Switch off: trip/holiday.png and trip/sub/holiday.png arrive without folders.
    result = _run(service, ["holiday.png", "holiday.png", "holiday.png"], [])

    assert result.converted_files == ["holiday.jpg", "holiday_1.jpg", "holiday_2.jpg"]
    archive = service.create_all_files_zip(result.dest_folder)
    with zipfile.ZipFile(archive.value) as zf:
        assert sorted(zf.namelist()) == result.converted_files


def test_without_folders_outputs_that_only_differ_in_case_stay_apart_in_the_flat_zip(service):
    result = _run(service, ["Holiday.png", "holiday.png"], [])

    assert sorted(f.casefold() for f in result.converted_files) == ["holiday.jpg", "holiday_1.jpg"]


def test_a_request_with_folders_keeps_them_and_one_without_is_flat():
    flat = extract_form_data(_request({"format": "jpeg"}, ["a.png", "a.png"]), _Logger())
    kept = extract_form_data(
        _request({"format": "jpeg", "relative_dirs[]": ["x", "y"]}, ["a.png", "a.png"]), _Logger()
    )

    assert flat.value.relative_dirs == ()
    assert kept.value.relative_dirs == ("x", "y")
