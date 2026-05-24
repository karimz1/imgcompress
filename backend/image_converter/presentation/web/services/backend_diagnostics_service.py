import os
from dataclasses import dataclass
from datetime import datetime, timezone

from backend.image_converter.infrastructure.logger import (
    get_backend_log_file_path,
    read_backend_log_file,
)


@dataclass
class DiagnosticsDocument:
    body: str
    filename: str
    mimetype: str


class BackendDiagnosticsService:
    def __init__(
        self,
        logger,
        temp_dir: str,
        storage_management_service,
        log_path_provider=get_backend_log_file_path,
        log_reader=read_backend_log_file,
    ):
        self.logger = logger
        self.temp_dir = temp_dir
        self.storage_management_service = storage_management_service
        self.log_path_provider = log_path_provider
        self.log_reader = log_reader

    def build_log_document(self) -> DiagnosticsDocument:
        return DiagnosticsDocument(
            body="\n".join(self._document_lines()),
            filename="imgcompress-backend.log",
            mimetype="text/plain",
        )

    def _document_lines(self) -> list[str]:
        return [
            "# imgcompress backend diagnostics",
            "",
            f"generated_at: {datetime.now(timezone.utc).isoformat(timespec='seconds')}",
            f"process_id: {os.getpid()}",
            f"temp_dir: {self.temp_dir}",
            f"log_file: {self.log_path_provider()}",
            f"storage_management_enabled: {self.storage_management_service.is_storage_management_enabled()}",
            "## Captured backend logs",
            self._captured_logs(),
        ]

    def _captured_logs(self) -> str:
        return (
            self.log_reader()
            or self.logger.dump_buffer()
            or "(no backend log entries captured yet)"
        )
