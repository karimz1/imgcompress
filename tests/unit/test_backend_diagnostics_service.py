from backend.image_converter.presentation.web.services.backend_diagnostics_service import (
    BackendDiagnosticsService,
)


class LoggerStub:
    def __init__(self, buffer: str = ""):
        self.buffer = buffer

    def dump_buffer(self):
        return self.buffer


class StorageManagementStub:
    def __init__(self, enabled: bool):
        self.enabled = enabled

    def is_storage_management_enabled(self):
        return self.enabled


def test_backend_diagnostics_uses_log_file_before_logger_buffer():
    service = BackendDiagnosticsService(
        LoggerStub("buffer log"),
        "/tmp",
        StorageManagementStub(True),
        log_path_provider=lambda: "/tmp/backend.log",
        log_reader=lambda: "file log",
    )

    document = service.build_log_document()

    assert document.filename == "imgcompress-backend.log"
    assert document.mimetype == "text/plain"
    assert "temp_dir: /tmp" in document.body
    assert "log_file: /tmp/backend.log" in document.body
    assert "storage_management_enabled: True" in document.body
    assert "file log" in document.body
    assert "buffer log" not in document.body


def test_backend_diagnostics_falls_back_to_logger_buffer():
    service = BackendDiagnosticsService(
        LoggerStub("buffer log"),
        "/tmp",
        StorageManagementStub(False),
        log_path_provider=lambda: "/tmp/backend.log",
        log_reader=lambda: "",
    )

    document = service.build_log_document()

    assert "storage_management_enabled: False" in document.body
    assert "buffer log" in document.body


def test_backend_diagnostics_has_empty_log_message():
    service = BackendDiagnosticsService(
        LoggerStub(""),
        "/tmp",
        StorageManagementStub(True),
        log_path_provider=lambda: "/tmp/backend.log",
        log_reader=lambda: "",
    )

    document = service.build_log_document()

    assert "(no backend log entries captured yet)" in document.body
