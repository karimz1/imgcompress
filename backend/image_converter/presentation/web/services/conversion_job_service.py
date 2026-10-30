"""Runs conversions in the background so the browser can leave and come back.

POST returns a job id at once; the conversion runs in a thread of the worker
process that took the upload, and writes its progress to the job's status
file. Any worker can answer the poll (see ConversionJobStore).
"""

import threading
import time
import traceback
from typing import Callable, Optional

from backend.image_converter.application.dtos import CompressionFormData
from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.infrastructure import job_progress
from backend.image_converter.infrastructure.conversion_job_store import (
    DONE,
    FAILED,
    RUNNING,
    ConversionJobStore,
    RunningJob,
)
from backend.image_converter.infrastructure.notifier import Notifier, describe_device
from backend.image_converter.presentation.web.services.temporary_folder_service import TemporaryFolderService
from backend.image_converter.presentation.web.services.compression_service import (
    CompressionService,
    PreparedCompression,
)

# Tile progress is written at most this often; file and status changes always.
_PROGRESS_WRITE_SECONDS = 0.5


def _start_thread(target: Callable[[], None]) -> None:
    threading.Thread(target=target, name="conversion-job", daemon=True).start()


class ConversionJobService:
    def __init__(
        self,
        logger,
        compression_service: CompressionService,
        store: ConversionJobStore,
        start_thread: Callable[[Callable[[], None]], None] = _start_thread,
        notifier: Optional[Notifier] = None,
    ):
        self.notifier = notifier
        self.logger = logger
        self.compression_service = compression_service
        self.store = store
        self._start_thread = start_thread

    def start(self, form_data: CompressionFormData, user_agent: Optional[str] = None) -> Result[dict]:
        """Saves the uploads and starts the job. Fails at once for invalid options."""
        prepared = self.compression_service.prepare(form_data)
        if not prepared.is_successful:
            return Result.failure(prepared.error)
        try:
            job = self.store.create(
                progress={"files_done": 0, "files_total": prepared.value.file_count},
                # Server-side only: results are served from here, never from a client path.
                dest_folder=prepared.value.dest.path,
                # Only "iPhone · Safari" and the like, for the notification.
                device=describe_device(user_agent),
            )
        except Exception:
            self.logger.log(f"Could not create conversion job: {traceback.format_exc()}", "error")
            CompressionService._discard(prepared.value.source, prepared.value.dest)
            return Result.failure("Unexpected compression failure.")
        state = job.state
        try:
            self._start_thread(lambda: self._run(job, prepared.value))
        except Exception:
            self.logger.log(f"Could not start conversion job: {traceback.format_exc()}", "error")
            CompressionService._discard(prepared.value.source, prepared.value.dest)
            job.finish(FAILED, error="Unexpected compression failure.")
            return Result.failure("Unexpected compression failure.")
        # The token appears only in this one answer to the browser that started the job.
        return Result.success({**_public_view(state), "token": job.token})

    def status(self, job_id: Optional[str], token: Optional[str]) -> Optional[dict]:
        """The job for its own token, else None (unknown id and wrong token look the same)."""
        state = self.store.read(job_id, token)
        if state is None:
            return None
        self.store.touch(job_id)
        if state.get("status") == DONE and state.get("dest_folder"):
            # Results are kept for temporary_storage.max_age_seconds (48 hours by
            # default) after the last look, so someone who comes back later
            # still finds them; every poll restarts that clock.
            TemporaryFolderService.mark_activity(state["dest_folder"])
        return {**_public_view(state), "notify": self.store.wants_notify(job_id)}

    @property
    def notify_enabled(self) -> bool:
        return self.notifier is not None and self.notifier.enabled

    def set_notify(self, job_id: Optional[str], token: Optional[str], enabled: bool) -> bool:
        return self.store.set_notify(job_id, token, enabled)

    def result_folder(self, job_id: Optional[str], token: Optional[str]) -> Optional[str]:
        """The finished job's own output folder, for its token only."""
        state = self.store.read(job_id, token)
        if state is None or state.get("status") != DONE:
            return None
        self.store.touch(job_id)
        return state.get("dest_folder")

    def _run(self, job: RunningJob, prepared: PreparedCompression) -> None:
        progress = dict(job.state.get("progress") or {})
        last_write = 0.0

        def on_progress(fields: dict) -> None:
            nonlocal last_write
            changed = {k: v for k, v in fields.items() if progress.get(k) != v}
            if not changed:
                return
            progress.update(changed)
            now = time.monotonic()
            only_tiles = set(changed) <= {"tiles_done"}
            done_tiles = progress.get("tiles_done") == progress.get("tiles_total")
            if only_tiles and not done_tiles and now - last_write < _PROGRESS_WRITE_SECONDS:
                return
            last_write = now
            job.update(progress=dict(progress))

        try:
            job.update(status=RUNNING)
            with job_progress.reporting_to(on_progress):
                result = self.compression_service.run(prepared)
            if result.is_successful:
                progress.update(files_done=progress.get("files_total", 0), waiting=False)
                summary = result.value.to_json_dict()
                summary.pop("dest_folder", None)
                job.finish(DONE, progress=progress, result=summary)
            else:
                job.finish(FAILED, progress=progress, error=result.error)
        except Exception:
            self.logger.log(f"Conversion job {job.job_id} crashed: {traceback.format_exc()}", "error")
            try:
                job.finish(FAILED, error="Unexpected compression failure.")
            except Exception:
                pass
        self._notify(job)

    def _notify(self, job: RunningJob) -> None:
        """One message for an opted-in job; never lets a failure reach the job."""
        try:
            if not self.notify_enabled or not self.store.wants_notify(job.job_id):
                return
            state = job.state
            result = state.get("result") or {}
            files = result.get("converted_files") or result.get("processed_files") or []
            self.notifier.notify(
                done=state.get("status") == DONE,
                file_count=len(files) if isinstance(files, list) else 0,
                device=state.get("device") or describe_device(None),
            )
        except Exception as error:
            self.logger.log(f"Notification for job {job.job_id} failed ({type(error).__name__}).", "warning")


_PRIVATE_FIELDS = ("token_sha256", "dest_folder")


def _public_view(state: dict) -> dict:
    view = {k: v for k, v in state.items() if k not in _PRIVATE_FIELDS}
    # The browser times the job from these, so its own clock can be off.
    view["server_time"] = time.time()
    if "finished_at" in state and "started_at" in state:
        view["duration_seconds"] = round(max(0.0, state["finished_at"] - state["started_at"]), 2)
    return view
