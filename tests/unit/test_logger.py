"""Unit tests for the size-bounded backend log file.

The backend tees stdout/stderr into a log file. These tests assert that the
file is rotated by size so it can never grow without bound, honoring the
``max_size_bytes``/``backup_count`` values from the app config.
"""

from types import SimpleNamespace

import pytest

from backend.image_converter.infrastructure import logger as logger_module


@pytest.fixture
def reset_file_logger():
    logger_module._file_logger = None
    yield
    existing = logger_module._file_logger
    if existing is not None:
        for handler in existing.handlers:
            handler.close()
    logger_module._file_logger = None


def _use_fake_config(monkeypatch, *, log_path, max_size_bytes, backup_count):
    fake_logging = SimpleNamespace(
        backend_log_file=str(log_path),
        max_size_bytes=max_size_bytes,
        backup_count=backup_count,
    )
    monkeypatch.setattr(
        logger_module.settings,
        "get",
        lambda: SimpleNamespace(logging=fake_logging),
    )


def test_backend_log_is_rotated_and_bounded(tmp_path, monkeypatch, reset_file_logger):
    log_path = tmp_path / "backend.log"
    _use_fake_config(monkeypatch, log_path=log_path, max_size_bytes=2000, backup_count=2)

    for i in range(1000):
        logger_module.append_backend_log_line(f"line {i} " + "x" * 60)

    # The active file is rolled over before it exceeds the cap, so it never
    # grows past the limit plus a single trailing record.
    assert log_path.stat().st_size <= 2000 + 200

    # At most `backup_count` rotated files are kept, so the total footprint is
    # bounded rather than growing forever.
    backups = sorted(tmp_path.glob("backend.log.*"))
    assert 0 < len(backups) <= 2
    for backup in backups:
        assert backup.stat().st_size <= 2000 + 200


def test_append_writes_timestamped_line(tmp_path, monkeypatch, reset_file_logger):
    log_path = tmp_path / "backend.log"
    _use_fake_config(
        monkeypatch, log_path=log_path, max_size_bytes=10_000_000, backup_count=1
    )

    logger_module.append_backend_log_line("hello world")

    contents = log_path.read_text(encoding="utf-8")
    assert contents.endswith("hello world\n")
    assert contents.startswith("[")  # ISO timestamp prefix
