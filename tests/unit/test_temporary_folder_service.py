import os

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


def test_resolve_download_target_rejects_absolute_traversal(tmp_path):
    target = _service(tmp_path).resolve_download_target(
        f"{tmp_path}/../../etc", "passwd"
    )
    assert target is None


def test_resolve_download_target_rejects_symlink_escape(tmp_path):
    folder = tmp_path / "converted_123"
    folder.mkdir()
    escape_link = folder / "escape"
    escape_link.symlink_to("/etc")

    target = _service(tmp_path).resolve_download_target(str(escape_link), "passwd")

    assert target is None


def test_resolve_download_target_rejects_unrelated_absolute_path(tmp_path):
    target = _service(tmp_path).resolve_download_target("/var/lib/secrets", "creds.txt")
    assert target is None


def test_resolve_download_target_rejects_empty_inputs(tmp_path):
    svc = _service(tmp_path)
    assert svc.resolve_download_target("", "x") is None
    assert svc.resolve_download_target(None, "x") is None
    assert svc.resolve_download_target(str(tmp_path), "") is None
    assert svc.resolve_download_target(str(tmp_path), None) is None


def test_resolve_download_target_rejects_relative_traversal_mid_path(tmp_path):
    folder = tmp_path / "converted_123"
    folder.mkdir()
    (folder / "result.png").write_bytes(b"png")

    target = _service(tmp_path).resolve_download_target(
        "converted_123/../../etc", "passwd"
    )

    assert target is None


def test_resolve_download_target_accepts_symlinked_temp_prefix(tmp_path):
    # On macOS tempfile prefixes (/var) are symlinks to /private/var. When the
    # backend echoes back a path the client previously received, the prefix may
    # not textually match base_dir's resolved form — realpath must reconcile it.
    folder = tmp_path / "converted_123"
    folder.mkdir()
    output = folder / "result.png"
    output.write_bytes(b"png")

    resolved_form = os.path.realpath(str(tmp_path)) + "/converted_123"
    target = _service(tmp_path).resolve_download_target(resolved_form, "result.png")

    assert target is not None
    assert target.file_path == os.path.realpath(str(output))
