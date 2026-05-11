from backend.image_converter.presentation.web.services.temporary_folder_service import (
    TemporaryFolderService,
)


class LoggerStub:
    def log(self, *_args, **_kwargs):
        pass


def _service(tmp_path):
    return TemporaryFolderService(str(tmp_path), 3600, LoggerStub())


def test_resolve_download_target_accepts_file_inside_temp(tmp_path):
    folder = tmp_path / "converted_123"
    folder.mkdir()
    output = folder / "result.png"
    output.write_bytes(b"png")

    target = _service(tmp_path).resolve_download_target(str(folder), "result.png")

    assert target is not None
    assert target.file_path == str(output)
    assert target.download_name == "result.png"


def test_create_temp_dir_uses_configured_temp_dir(tmp_path):
    created = _service(tmp_path).create_temp_dir("source_")

    assert created.startswith(str(tmp_path))


def test_resolve_download_target_accepts_relative_folder_inside_temp(tmp_path):
    folder = tmp_path / "converted_123"
    folder.mkdir()
    output = folder / "result.png"
    output.write_bytes(b"png")

    target = _service(tmp_path).resolve_download_target("converted_123", "result.png")

    assert target is not None
    assert target.file_path == str(output)


def test_resolve_download_target_rejects_folder_outside_temp(tmp_path):
    outside = tmp_path.parent / f"{tmp_path.name}-outside"
    outside.mkdir(exist_ok=True)
    output = outside / "secret.png"
    output.write_bytes(b"png")

    target = _service(tmp_path).resolve_download_target(str(outside), "secret.png")

    assert target is None


def test_resolve_download_target_rejects_filename_traversal(tmp_path):
    folder = tmp_path / "converted_123"
    folder.mkdir()
    outside = tmp_path / "secret.png"
    outside.write_bytes(b"png")

    target = _service(tmp_path).resolve_download_target(str(folder), "../secret.png")

    assert target is None


def test_get_validated_path_rejects_traversal(tmp_path):
    assert _service(tmp_path).get_validated_path("../") is None
