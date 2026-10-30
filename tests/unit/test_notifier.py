"""Optional "Notify me when done": off unless NOTIFY_URL is set, and the
message never carries file names, only a count, the device and a link."""

import pytest

from backend.image_converter.infrastructure.notifier import (
    Notifier,
    build_message,
    describe_device,
)


class _Logger:
    def __init__(self):
        self.lines = []

    def log(self, message, level="info"):
        self.lines.append((level, str(message)))


IPHONE = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"
)
WINDOWS_CHROME = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)


@pytest.mark.parametrize(
    ("user_agent", "expected"),
    [
        (IPHONE, "iPhone · Safari"),
        (WINDOWS_CHROME, "Windows · Chrome"),
        ("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0", "Windows · Firefox"),
        (WINDOWS_CHROME + " Edg/130.0.0.0", "Windows · Edge"),
        ("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1", "iPhone · Chrome"),
        ("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", "iPad · Safari"),
        ("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36", "Android · Chrome"),
        ("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15", "Mac · Safari"),
        ("Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0", "Linux · Firefox"),
        ("", "a browser"),
        (None, "a browser"),
        ("curl/8.5.0", "a browser"),
    ],
)
def test_describe_device(user_agent, expected):
    assert describe_device(user_agent) == expected


def test_message_has_count_device_and_link_but_no_file_names():
    title, body = build_message(
        done=True, file_count=3, device="iPhone · Safari", base_url="https://img.example.com/"
    )
    assert title == "3 images ready"
    assert "iPhone · Safari" in body
    assert "https://img.example.com/" in body


def test_message_for_one_file_and_without_a_link():
    title, body = build_message(done=True, file_count=1, device="Windows · Chrome", base_url=None)
    assert title == "1 image ready"
    assert "http" not in body


def test_message_for_a_failed_job():
    title, body = build_message(done=False, file_count=0, device="Mac · Safari", base_url=None)
    assert title == "Conversion failed"
    assert "Mac · Safari" in body


def test_disabled_without_url():
    sent = []
    notifier = Notifier(url=None, base_url=None, logger=_Logger(), send=lambda *a: sent.append(a) or True)
    assert not notifier.enabled
    notifier.notify(done=True, file_count=2, device="x")
    assert sent == []


def test_from_env(monkeypatch):
    monkeypatch.delenv("NOTIFY_URL", raising=False)
    assert not Notifier.from_env(_Logger()).enabled
    monkeypatch.setenv("NOTIFY_URL", "  ")
    assert not Notifier.from_env(_Logger()).enabled
    monkeypatch.setenv("NOTIFY_URL", "ntfy://ntfy/imgcompress")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://img.example.com")
    notifier = Notifier.from_env(_Logger())
    assert notifier.enabled and notifier.base_url == "https://img.example.com"


def test_send_failure_is_logged_without_the_url():
    logger = _Logger()
    secret_url = "tgram://123456:SECRET-TOKEN/987"

    def broken(title, body):
        raise RuntimeError(f"could not reach {secret_url}")

    notifier = Notifier(url=secret_url, base_url=None, logger=logger, send=broken)
    assert notifier.notify(done=True, file_count=1, device="x") is False
    text = " ".join(line for _, line in logger.lines)
    assert "Notification" in text
    assert "SECRET" not in text and secret_url not in text


def test_apprise_is_used_for_the_real_send(tmp_path):
    # json:// to a port nobody listens on: Apprise reports failure, we just log it.
    logger = _Logger()
    notifier = Notifier(url="json://127.0.0.1:9/", base_url=None, logger=logger)
    assert notifier.notify(done=True, file_count=1, device="x") is False


def _runtime_config():
    from flask import Flask

    from backend.image_converter.presentation.web.static_routes import static_blueprint

    app = Flask(__name__)
    app.register_blueprint(static_blueprint)
    return app.test_client().get("/config/runtime.json").get_json()


def test_runtime_config_reports_notify_off_by_default(monkeypatch):
    monkeypatch.delenv("NOTIFY_URL", raising=False)
    assert _runtime_config()["NOTIFY_ENABLED"] == "false"


def test_runtime_config_reports_notify_on_with_url(monkeypatch):
    monkeypatch.setenv("NOTIFY_URL", "ntfy://ntfy/imgcompress")
    body = _runtime_config()
    assert body["NOTIFY_ENABLED"] == "true"
    assert "ntfy" not in str(body)
