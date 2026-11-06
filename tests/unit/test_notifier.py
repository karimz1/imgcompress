"""Optional "Notify me when done": off unless NOTIFY_URL is set, and the
message never carries file names, only a count, the device and a link."""

from datetime import datetime, timedelta, timezone

import pytest

from backend.image_converter.infrastructure.notifier import (
    Notifier,
    build_message,
    clean_public_base_url,
    share_link,
    describe_device,
    format_duration,
    format_link_expiry,
    resolve_language,
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


def test_message_with_a_share_link_says_to_open_it():
    link = "https://img.example.com/r/abc/secret"
    now = datetime(2026, 11, 5, 17, 51, tzinfo=timezone.utc)
    title, body = build_message(
        done=True, file_count=3, device="iPhone · Safari", link=link,
        link_ttl_seconds=172800, now=now,
    )
    assert title == "3 images ready"
    when = format_link_expiry(now + timedelta(seconds=172800), "en")
    assert body == f"Open this link to download them:\n{link}\nLink expires {when}."


def test_failed_message_with_a_share_link():
    now = datetime(2026, 11, 5, 17, 51, tzinfo=timezone.utc)
    _, body = build_message(
        done=False, file_count=0, device="Mac · Safari", link="https://x.example/r/a/b",
        link_ttl_seconds=172800, now=now,
    )
    when = format_link_expiry(now + timedelta(seconds=172800), "en")
    assert body == (
        f"Open this link to see what went wrong:\nhttps://x.example/r/a/b\n"
        f"Link expires {when}."
    )


@pytest.mark.parametrize(
    "base, expected",
    [
        ("https://img.example.com", "https://img.example.com/r/JOB/SHARE"),
        ("https://img.example.com/", "https://img.example.com/r/JOB/SHARE"),
        ("https://example.com/imgcompress", "https://example.com/imgcompress/r/JOB/SHARE"),
        (None, None),
        ("https://user:pw@evil.example", None),
        ("javascript:alert(1)", None),
    ],
)
def test_share_link_only_from_a_clean_public_base_url(base, expected):
    assert share_link(base, "JOB", "SHARE") == expected


def test_message_for_one_file_and_without_a_link():
    title, body = build_message(done=True, file_count=1, device="Windows · Chrome", link=None)
    assert title == "1 image ready"
    assert body == "Open imgcompress in Chrome on your Windows PC to get your result."


def test_message_for_a_failed_job():
    title, body = build_message(done=False, file_count=0, device="Mac · Safari", link=None)
    assert title == "Conversion failed"
    assert body == "Open imgcompress in Safari on your Mac to see what went wrong."


def test_message_for_an_unknown_browser():
    _, body = build_message(done=True, file_count=2, device="a browser", link=None)
    assert body == "Open imgcompress in the browser you used to get your results."


def test_message_for_several_files_says_results():
    _, body = build_message(done=True, file_count=4, device="Android · Chrome", link=None)
    assert body == "Open imgcompress in Chrome on your Android device to get your results."


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("https://img.example.com", "https://img.example.com"),
        ("  https://img.example.com/  ", "https://img.example.com/"),
        ("http://192.168.1.10:3001", "http://192.168.1.10:3001"),
        ("https://example.com/imgcompress", "https://example.com/imgcompress"),
        ("javascript:alert(1)", None),
        ("ftp://img.example.com", None),
        ("https://user:pass@img.example.com", None),
        ("https://img.example.com?x=1", None),
        ("https://img.example.com#x", None),
        ("https://img.example.com:99999", None),
        ("https://", None),
        ("img.example.com", None),
        ("https://img example.com", None),
        ("https://img.example.com\nFake line", None),
        ("https://" + "a" * 600 + ".com", None),
        ("", None),
        (None, None),
    ],
)
def test_clean_public_base_url(value, expected):
    assert clean_public_base_url(value) == expected


def test_invalid_public_base_url_is_ignored_with_a_warning_that_does_not_echo_it():
    logger = _Logger()
    notifier = Notifier(url="json://x", base_url="https://user:secret@x.example", logger=logger, send=lambda t, b: True)
    assert notifier.base_url is None
    assert any(level == "warning" and "PUBLIC_BASE_URL" in line for level, line in logger.lines)
    assert "secret" not in str(logger.lines)


def test_without_public_base_url_the_message_has_no_link():
    sent = []
    notifier = Notifier(url="json://x", base_url=None, logger=_Logger(), send=lambda t, b: sent.append(b) or True)
    notifier.notify(done=True, file_count=1, device="iPhone · Safari")
    assert sent == ["Open imgcompress in Safari on your iPhone to get your result."]


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


@pytest.mark.parametrize(
    "seconds, expected",
    [(0.2, "1 s"), (12, "12 s"), (59.6, "1 min 0 s"), (2855, "47 min 35 s"), (3780, "1 h 3 min"), (7322, "2 h 2 min")],
)
def test_format_duration_reads_like_the_done_sheet(seconds, expected):
    assert format_duration(seconds) == expected


def test_message_says_how_long_the_job_took():
    title, body = build_message(
        done=True, file_count=1, device="iPhone · Safari", link=None, duration_seconds=2855
    )
    assert title == "1 image ready in 47 min 35 s"
    assert body == "Open imgcompress in Safari on your iPhone to get your result."


def test_failed_message_says_after_how_long():
    title, _ = build_message(done=False, file_count=0, device="Mac · Safari", link=None, duration_seconds=12)
    assert title == "Conversion failed after 12 s"


def test_notify_passes_the_duration_on():
    sent = []
    notifier = Notifier("json://localhost", None, _Logger(), send=lambda t, b: sent.append(t) or True)
    notifier.notify(done=True, file_count=2, device="a browser", duration_seconds=75)
    assert sent == ["2 images ready in 1 min 15 s"]


def test_message_in_german():
    now = datetime(2026, 11, 5, 17, 51, tzinfo=timezone.utc)
    title, body = build_message(
        done=True, file_count=1, device="iPhone · Safari", link="https://img.example.com/r/a/b",
        duration_seconds=2855, language="de",
        link_ttl_seconds=172800, now=now,
    )
    assert title == "1 Bild fertig in 47 min 35 s"
    when = format_link_expiry(now + timedelta(seconds=172800), "de")
    assert body == (
        f"Öffne diesen Link, um es zu laden:\nhttps://img.example.com/r/a/b\n"
        f"Der Link gilt bis {when}."
    )


def test_message_in_french_with_hours():
    title, body = build_message(
        done=True, file_count=3, device="Windows · Chrome", link=None, duration_seconds=3780, language="fr"
    )
    assert title == "3 images prêtes en 1 h 3 min"
    assert body == "Ouvrez imgcompress dans Chrome sur votre PC Windows pour récupérer vos résultats."


@pytest.mark.parametrize("language", ["xx", "de-AT ", None, "", 42, "../../etc"])
def test_unknown_or_missing_language_falls_back(language):
    expected = "de" if language == "de-AT " else "en"
    assert resolve_language(language) == expected


@pytest.mark.parametrize("language", ["xx", None])
def test_unsupported_or_missing_language_gives_english(language):
    title, _ = build_message(done=True, file_count=1, device="a browser", link=None, duration_seconds=12, language=language)
    assert title == "1 image ready in 12 s"


def test_every_locale_has_a_message():
    now = datetime(2026, 11, 5, 17, 51, tzinfo=timezone.utc)
    for code in ["en", "de", "fr", "es-MX", "pt-BR", "ru", "ja", "zh-CN", "hi", "hu", "ar"]:
        assert resolve_language(code) == code
        title, body = build_message(done=True, file_count=2, device="Mac · Safari", link=None, duration_seconds=75, language=code)
        assert title and "imgcompress" in body and "{" not in title + body
        failed, _ = build_message(done=False, file_count=0, device="a browser", link=None, duration_seconds=5, language=code)
        assert failed and "{" not in failed
        _, linked = build_message(
            done=True, file_count=1, device="a browser", link="https://img.example.com/r/a/b",
            language=code, link_ttl_seconds=172800, now=now,
        )
        assert "https://img.example.com/r/a/b" in linked and "{" not in linked
        assert linked.splitlines()[-1]  # expiry line present


def test_notify_with_share_link_includes_expiry_line():
    sent = []
    notifier = Notifier(
        "json://localhost",
        "https://img.example.com",
        _Logger(),
        send=lambda t, b: sent.append(b) or True,
        result_ttl_seconds=172800,
    )
    notifier.notify(done=True, file_count=1, device="iPhone · Safari", link="https://img.example.com/r/a/b")
    assert len(sent) == 1
    lines = sent[0].split("\n")
    assert lines[0] == "Open this link to download it:"
    assert lines[1] == "https://img.example.com/r/a/b"
    assert lines[2].startswith("Link expires ") and lines[2].endswith(".")
