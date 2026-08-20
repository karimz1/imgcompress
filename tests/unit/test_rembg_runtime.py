import sys
from unittest.mock import MagicMock

import pytest

from backend.image_converter.core.internals import rembg_runtime
from backend.image_converter.core.exceptions import ConversionError
from backend.image_converter.core.internals.rembg_runtime import (
    remove_background,
    remove_background_in_process,
)


def test_remove_background_in_process_releases_session_after_success(monkeypatch):
    collect_calls = []
    session = {"model": "u2net"}

    mock_rembg = MagicMock()
    mock_rembg.new_session.return_value = session
    mock_rembg.remove.return_value = b"png"
    monkeypatch.setitem(sys.modules, "rembg", mock_rembg)
    monkeypatch.setattr(
        "backend.image_converter.core.internals.rembg_runtime.gc.collect",
        lambda: collect_calls.append(True),
    )

    result = remove_background_in_process(b"input", "u2net")

    assert result == b"png"
    mock_rembg.new_session.assert_called_once_with("u2net")
    mock_rembg.remove.assert_called_once_with(
        b"input",
        session=session,
        post_process_mask=True,
        alpha_matting=False,
    )
    assert collect_calls == [True]


def test_remove_background_in_process_releases_session_after_failure(monkeypatch):
    collect_calls = []

    mock_rembg = MagicMock()
    mock_rembg.new_session.return_value = {"model": "u2net"}
    mock_rembg.remove.side_effect = RuntimeError("model failed")
    monkeypatch.setitem(sys.modules, "rembg", mock_rembg)
    monkeypatch.setattr(
        "backend.image_converter.core.internals.rembg_runtime.gc.collect",
        lambda: collect_calls.append(True),
    )

    with pytest.raises(RuntimeError, match="model failed"):
        remove_background_in_process(b"input", "u2net")

    assert collect_calls == [True]


def test_remove_background_runs_short_lived_worker(monkeypatch, tmp_path):
    commands = []

    class CompletedProcess:
        returncode = 0
        stdout = ""
        stderr = ""

    class FakeTemporaryDirectory:
        def __init__(self, prefix):
            self.prefix = prefix

        def __enter__(self):
            return str(tmp_path)

        def __exit__(self, *_args):
            return False

    def fake_run(command, **_kwargs):
        commands.append(command)
        output_path = command[command.index("--output") + 1]
        with open(output_path, "wb") as output_file:
            output_file.write(b"worker-output")
        return CompletedProcess()

    monkeypatch.setattr(rembg_runtime.subprocess, "run", fake_run)
    monkeypatch.setattr(rembg_runtime.tempfile, "TemporaryDirectory", FakeTemporaryDirectory)
    monkeypatch.setattr(rembg_runtime, "_limit_child_memory", lambda: None)

    result = remove_background(b"input", "isnet-anime")

    assert result == b"worker-output"
    assert commands[0][0] == sys.executable
    assert "backend.image_converter.core.internals.rembg_worker" in commands[0]
    assert commands[0][commands[0].index("--model") + 1] == "isnet-anime"


def test_remove_background_returns_concise_memory_error(monkeypatch, tmp_path):
    class FailedProcess:
        returncode = 1
        stdout = ""
        stderr = "Failed to allocate memory for requested buffer of size 822083584\nTraceback..."

    class FakeTemporaryDirectory:
        def __init__(self, prefix):
            self.prefix = prefix

        def __enter__(self):
            return str(tmp_path)

        def __exit__(self, *_args):
            return False

    monkeypatch.setattr(rembg_runtime.subprocess, "run", lambda *_args, **_kwargs: FailedProcess())
    monkeypatch.setattr(rembg_runtime.tempfile, "TemporaryDirectory", FakeTemporaryDirectory)
    monkeypatch.setattr(rembg_runtime, "_limit_child_memory", lambda: None)

    with pytest.raises(ConversionError) as exc_info:
        remove_background(b"input", "birefnet-portrait")

    message = str(exc_info.value)
    assert message == (
        "birefnet-portrait needs more RAM than this device currently has available. "
        "It failed while requesting another 784 MiB. Try a smaller image or a lighter model."
    )
    assert "Traceback" not in message
