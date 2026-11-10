"""rembg loads its model once per process and model, even under parallel requests."""

import sys
import threading
import time
import types

import pytest

from backend.image_converter.core.factory.rembg_png_converter import RembgPngConverter
from backend.image_converter.core.factory.rembg_webp_converter import RembgWebpConverter
from backend.image_converter.core.internals import rembg_session


class _Logger:
    def log(self, *_args, **_kwargs):
        pass


@pytest.fixture
def fake_rembg(monkeypatch):
    created = []

    def new_session(model_name):
        time.sleep(0.05)  # widen the race window
        created.append(model_name)
        return object()

    monkeypatch.setitem(sys.modules, "rembg", types.SimpleNamespace(new_session=new_session))
    rembg_session.clear_rembg_sessions()
    yield created
    rembg_session.clear_rembg_sessions()


def test_converters_share_one_session_per_model(fake_rembg):
    first = RembgPngConverter(_Logger(), model_name="u2net")._get_background_removal_session()
    second = RembgPngConverter(_Logger(), model_name="u2net")._get_background_removal_session()
    webp = RembgWebpConverter(quality=80, logger=_Logger(), model_name="u2net")._get_background_removal_session()
    other = RembgPngConverter(_Logger(), model_name="isnet")._get_background_removal_session()

    assert first is second is webp
    assert other is not first
    assert fake_rembg == ["u2net", "isnet"]


def test_parallel_first_use_creates_the_session_once(fake_rembg):
    barrier = threading.Barrier(8)
    sessions = []

    def worker():
        barrier.wait()
        sessions.append(rembg_session.get_rembg_session("u2net"))

    threads = [threading.Thread(target=worker) for _ in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(10)

    assert fake_rembg == ["u2net"]
    assert len({id(s) for s in sessions}) == 1
