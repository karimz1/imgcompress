"""Status files of background conversion jobs, shared by all Granian workers.

Every job has a public id and a separate secret token, returned once to the
browser that started it. The status file keeps only the token's SHA-256, and
``read`` answers None for a wrong or missing token exactly as for an unknown
id, so nobody can read, or even detect, another user's job.

Each job gets a folder ``job_<id>`` in the temp dir with one ``status.json``.
Any worker process can answer a poll, because the state lives on disk, not in
the memory of the worker that started the job. Writes go to a temp file that
replaces status.json in one step, so a reader never sees half a file.

While the job runs, its worker holds a shared lock on the folder (see
job_folder_lock). Cleanup skips locked folders, and a reader that finds a
"running" job without a lock knows its worker died.
"""

import hashlib
import hmac
import json
import os
import re
import secrets
import shutil
import tempfile
import time
from typing import Optional

from backend.image_converter.infrastructure import job_folder_lock

JOB_PREFIX = "job_"
_STATUS_FILE = "status.json"
# secrets.token_urlsafe(16): 22 URL-safe characters, so the pattern rules out any path.
_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{22}$")
_TOKEN_MAX_LENGTH = 128

QUEUED = "queued"
RUNNING = "running"
DONE = "done"
FAILED = "failed"
_ACTIVE = (QUEUED, RUNNING)

INTERRUPTED_MESSAGE = "The conversion stopped unexpectedly. Please try again."


def is_valid_job_id(job_id: Optional[str]) -> bool:
    return isinstance(job_id, str) and _ID_PATTERN.fullmatch(job_id) is not None


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class RunningJob:
    """A job owned by this process; holds the folder lock until ``finish``."""

    def __init__(
        self, store: "ConversionJobStore", job_id: str, token: str, lock_fd: Optional[int], state: dict
    ):
        self.store = store
        self.job_id = job_id
        # Only the browser that started the job gets this, once.
        self.token = token
        self._lock_fd = lock_fd
        self._state = state

    @property
    def state(self) -> dict:
        return dict(self._state)

    def update(self, **fields) -> None:
        if self._state["status"] not in _ACTIVE:
            return
        self._state.update(fields)
        self._state["updated_at"] = time.time()
        self.store._write(self.job_id, self._state)

    def finish(self, status: str, **fields) -> None:
        try:
            self._state.update(fields, status=status, updated_at=time.time())
            self.store._write(self.job_id, self._state)
        finally:
            job_folder_lock.release(self._lock_fd)
            self._lock_fd = None


class ConversionJobStore:
    def __init__(self, temp_dir: str):
        self.temp_dir = temp_dir

    def create(self, **fields) -> RunningJob:
        while True:
            job_id = secrets.token_urlsafe(16)
            path = self._folder(job_id)
            try:
                os.mkdir(path, 0o700)
            except FileExistsError:
                continue
            try:
                lock_fd = job_folder_lock.hold_shared(path)
            except FileNotFoundError:
                # A forced cleanup won the race for the empty folder; take a new id.
                shutil.rmtree(path, ignore_errors=True)
                continue
            token = secrets.token_urlsafe(32)
            now = time.time()
            state = {
                **fields,
                "id": job_id,
                "token_sha256": _hash_token(token),
                "status": QUEUED,
                "created_at": now,
                "updated_at": now,
            }
            job = RunningJob(self, job_id, token, lock_fd, state)
            self._write(job_id, state)
            return job

    def read(self, job_id: Optional[str], token: Optional[str]) -> Optional[dict]:
        """
        The job's state, or None for an unknown, invalid or cleaned-up id and
        for a missing or wrong token. Callers must not tell these apart.
        """
        if not is_valid_job_id(job_id):
            return None
        path = self._folder(job_id)
        try:
            with open(os.path.join(path, _STATUS_FILE), encoding="utf-8") as f:
                state = json.load(f)
        except (OSError, ValueError):
            return None
        expected = state.get("token_sha256")
        given = token if isinstance(token, str) and 0 < len(token) <= _TOKEN_MAX_LENGTH else ""
        # Always hash and compare, so a missing token takes as long as a wrong one.
        if not isinstance(expected, str) or not hmac.compare_digest(_hash_token(given), expected) or not given:
            return None
        if state.get("status") in _ACTIVE and self._worker_is_gone(path):
            # Re-read first: the job may have finished between the two steps.
            try:
                with open(os.path.join(path, _STATUS_FILE), encoding="utf-8") as f:
                    state = json.load(f)
            except (OSError, ValueError):
                return None
            if state.get("status") in _ACTIVE:
                state.update(status=FAILED, error=INTERRUPTED_MESSAGE)
        return state

    def touch(self, job_id: str) -> None:
        """Age-based cleanup counts from the last activity, so a poll restarts the clock."""
        if not is_valid_job_id(job_id):
            return
        try:
            os.utime(self._folder(job_id))
        except OSError:
            pass

    def _folder(self, job_id: str) -> str:
        return os.path.join(self.temp_dir, JOB_PREFIX + job_id)

    @staticmethod
    def _worker_is_gone(path: str) -> bool:
        try:
            acquired, fd = job_folder_lock.try_exclusive(path)
        except OSError:
            return False
        job_folder_lock.release(fd)
        return acquired and fd is not None

    def _write(self, job_id: str, state: dict) -> None:
        folder = self._folder(job_id)
        fd, tmp = tempfile.mkstemp(dir=folder, prefix=".status-", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(state, f)
            os.replace(tmp, os.path.join(folder, _STATUS_FILE))
        except BaseException:
            try:
                os.remove(tmp)
            except OSError:
                pass
            raise
