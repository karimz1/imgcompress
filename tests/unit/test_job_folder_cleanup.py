"""Cleanup must only delete finished results, never folders of running jobs.

A running job holds a lock on its temp folder (see job_folder_lock). These
tests cover the lock itself, how CleanupService treats locked folders, and
that a crashed or hung job cannot block cleanup forever.
"""

import os
import subprocess
import sys
import time

import pytest

from backend.image_converter.infrastructure import cleanup_service as cleanup_module
from backend.image_converter.infrastructure import job_folder_lock
from backend.image_converter.infrastructure.cleanup_service import CleanupService
from backend.image_converter.presentation.web.services.temporary_folder_service import (
    TemporaryFolderService,
)

pytestmark = pytest.mark.skipif(job_folder_lock.fcntl is None, reason="needs POSIX flock")


class _Logger:
    def log(self, *_args, **_kwargs):
        pass


def _cleanup(tmp_path, expiration_time=3600):
    return CleanupService(str(tmp_path), expiration_time=expiration_time, logger=_Logger())


def _job_folder(tmp_path, name="converted_job", age_seconds=0):
    folder = tmp_path / name
    folder.mkdir()
    (folder / "out.png").write_bytes(b"png")
    _age(folder, age_seconds)
    return folder


def _age(folder, seconds):
    stamp = time.time() - seconds
    for path in [*folder.iterdir(), folder]:
        os.utime(path, (stamp, stamp))


def _deleted_paths(summary):
    return {item.path for item in summary.deleted}


def test_running_job_blocks_exclusive_lock_until_released(tmp_path):
    job = TemporaryFolderService(str(tmp_path), 3600, _Logger()).create_job_dir("converted_")

    acquired, fd = job_folder_lock.try_exclusive(job.path)
    assert not acquired and fd is None

    job.release()
    acquired, fd = job_folder_lock.try_exclusive(job.path)
    assert acquired
    job_folder_lock.release(fd)


def test_release_is_idempotent(tmp_path):
    job = TemporaryFolderService(str(tmp_path), 3600, _Logger()).create_job_dir("source_")
    job.release()
    job.release()


def test_force_cleanup_keeps_running_job_and_deletes_finished_one(tmp_path):
    service = TemporaryFolderService(str(tmp_path), 3600, _Logger())
    running = service.create_job_dir("converted_")
    (tmp_path / "converted_done").mkdir()

    summary = _cleanup(tmp_path).cleanup_temp_folders(force=True).value

    assert os.path.isdir(running.path)
    assert not (tmp_path / "converted_done").exists()
    assert _deleted_paths(summary) == {str(tmp_path / "converted_done")}
    assert not summary.errors

    running.release()
    _cleanup(tmp_path).cleanup_temp_folders(force=True)
    assert not os.path.exists(running.path)


def test_age_cleanup_skips_expired_but_running_job(tmp_path):
    folder = _job_folder(tmp_path, age_seconds=7200)
    fd = job_folder_lock.hold_shared(str(folder))
    try:
        summary = _cleanup(tmp_path).cleanup_temp_folders().value
        assert folder.is_dir()
        assert not summary.deleted and not summary.errors
    finally:
        job_folder_lock.release(fd)

    _cleanup(tmp_path).cleanup_temp_folders()
    assert not folder.exists()


def test_force_cleanup_never_deletes_a_locked_folder_even_if_very_old(tmp_path):
    folder = _job_folder(tmp_path, age_seconds=cleanup_module.ABANDONED_JOB_SECONDS + 600)
    fd = job_folder_lock.hold_shared(str(folder))
    try:
        _cleanup(tmp_path).cleanup_temp_folders(force=True)
        assert folder.is_dir()
    finally:
        job_folder_lock.release(fd)


def test_age_cleanup_treats_long_idle_locked_folder_as_abandoned(tmp_path):
    folder = _job_folder(tmp_path, age_seconds=cleanup_module.ABANDONED_JOB_SECONDS + 600)
    fd = job_folder_lock.hold_shared(str(folder))
    try:
        summary = _cleanup(tmp_path).cleanup_temp_folders().value
        assert not folder.exists()
        assert _deleted_paths(summary) == {str(folder)}
    finally:
        job_folder_lock.release(fd)


def test_lock_of_a_crashed_job_process_does_not_block_cleanup(tmp_path):
    folder = _job_folder(tmp_path)
    holder = subprocess.Popen(
        [
            sys.executable, "-c",
            "import sys, time\n"
            "from backend.image_converter.infrastructure import job_folder_lock\n"
            "job_folder_lock.hold_shared(sys.argv[1])\n"
            "print('locked', flush=True)\n"
            "time.sleep(60)\n",
            str(folder),
        ],
        stdout=subprocess.PIPE,
        text=True,
    )
    try:
        assert holder.stdout.readline().strip() == "locked"
        _cleanup(tmp_path).cleanup_temp_folders(force=True)
        assert folder.is_dir(), "a live job in another worker process must be kept"
    finally:
        holder.kill()
        holder.wait(10)
        holder.stdout.close()

    _cleanup(tmp_path).cleanup_temp_folders(force=True)
    assert not folder.exists()


def test_age_counts_from_last_activity_not_creation(tmp_path):
    folder = _job_folder(tmp_path, age_seconds=7200)
    (folder / "late.png").write_bytes(b"written just now")

    _cleanup(tmp_path).cleanup_temp_folders()

    assert folder.is_dir()


def test_mark_activity_restarts_the_age_clock(tmp_path):
    folder = _job_folder(tmp_path, age_seconds=7200)

    TemporaryFolderService.mark_activity(str(folder))
    _cleanup(tmp_path).cleanup_temp_folders()

    assert folder.is_dir()


def test_create_job_dir_retries_when_cleanup_removed_the_folder_first(tmp_path, monkeypatch):
    service = TemporaryFolderService(str(tmp_path), 3600, _Logger())
    real_hold = job_folder_lock.hold_shared
    calls = []

    def hold_after_cleanup(path):
        calls.append(path)
        if len(calls) == 1:
            os.rmdir(path)  # a forced cleanup won the race
        return real_hold(path)

    monkeypatch.setattr(job_folder_lock, "hold_shared", hold_after_cleanup)

    job = service.create_job_dir("converted_")
    try:
        assert len(calls) == 2
        assert os.path.isdir(job.path)
        assert job.path == calls[1]
    finally:
        job.release()


def test_use_folder_keeps_cleanup_away_while_reading(tmp_path):
    folder = _job_folder(tmp_path)
    service = TemporaryFolderService(str(tmp_path), 3600, _Logger())

    with service.use_folder(str(folder)):
        _cleanup(tmp_path).cleanup_temp_folders(force=True)
        assert folder.is_dir()

    _cleanup(tmp_path).cleanup_temp_folders(force=True)
    assert not folder.exists()
