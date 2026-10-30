"""Optional "Notify me when done" through Apprise (ntfy, Telegram, mail, ...).

Off unless NOTIFY_URL is set. A message names how many images are ready and
tells you to open imgcompress in the browser that started the job (the result
belongs to it). The address is added only when the admin sets PUBLIC_BASE_URL.
It never names files. A failing notification is logged and never breaks a job;
the log never shows NOTIFY_URL, because it often holds a secret token.
"""

import os
from urllib.parse import urlsplit
from typing import Callable, Optional

NOTIFY_URL_ENV = "NOTIFY_URL"
PUBLIC_BASE_URL_ENV = "PUBLIC_BASE_URL"

_UNKNOWN_DEVICE = "a browser"

# Order matters: iPhone/iPad/Android user agents also contain "Mac OS X" or "Linux".
_PLATFORMS = (
    ("iPhone", "iPhone"),
    ("iPad", "iPad"),
    ("Android", "Android"),
    ("Windows", "Windows"),
    ("CrOS", "ChromeOS"),
    ("Macintosh", "Mac"),
    ("Linux", "Linux"),
)
# Order matters: Edge and Opera also say "Chrome", Chrome also says "Safari".
_BROWSERS = (
    ("Edg", "Edge"),
    ("OPR/", "Opera"),
    ("SamsungBrowser/", "Samsung Internet"),
    ("Firefox/", "Firefox"),
    ("FxiOS/", "Firefox"),
    ("CriOS/", "Chrome"),
    ("Chrome/", "Chrome"),
    ("Safari/", "Safari"),
)


def describe_device(user_agent: Optional[str]) -> str:
    """'iPhone · Safari', 'Windows · Chrome', or 'a browser' when unsure."""
    ua = user_agent or ""
    platform = next((name for marker, name in _PLATFORMS if marker in ua), None)
    browser = next((name for marker, name in _BROWSERS if marker in ua), None)
    if not platform or not browser:
        return _UNKNOWN_DEVICE
    return f"{platform} · {browser}"


# How a platform reads in "... on your iPhone".
_PLATFORM_NOUNS = {
    "Windows": "Windows PC",
    "Linux": "Linux PC",
    "Android": "Android device",
    "ChromeOS": "Chromebook",
}

_URL_MAX_LENGTH = 500


def _where(device: str) -> str:
    """'in Safari on your iPhone', or a hint to use the same browser."""
    platform, _, browser = device.partition(" · ")
    if not browser:
        return "in the browser you used"
    return f"in {browser} on your {_PLATFORM_NOUNS.get(platform, platform)}"


def build_message(*, done: bool, file_count: int, device: str, link: Optional[str]) -> tuple[str, str]:
    """
    The result is kept for the browser that started the job, so the message
    says where to open it instead of linking straight to it (a tap would
    open the default browser, which does not know the job).
    """
    if done:
        title = "1 image ready" if file_count == 1 else f"{file_count} images ready"
        result = "result" if file_count == 1 else "results"
        body = f"Open imgcompress {_where(device)} to get your {result}."
    else:
        title = "Conversion failed"
        body = f"Open imgcompress {_where(device)} to see what went wrong."
    if link:
        body += f"\n{link}"
    return title, body


def clean_public_base_url(value) -> Optional[str]:
    """
    PUBLIC_BASE_URL when it is a plain http(s) address without credentials,
    query or fragment (a path such as /imgcompress is fine), else None. Only
    the admin sets it; nothing from a request (Origin, Host, X-Forwarded-Host)
    is ever used, because those can be spoofed.
    """
    if not isinstance(value, str):
        return None
    value = value.strip()
    if not 0 < len(value) <= _URL_MAX_LENGTH:
        return None
    if any(ch.isspace() or ord(ch) < 33 or ord(ch) > 126 for ch in value):
        return None
    try:
        parts = urlsplit(value)
        parts.port
    except ValueError:
        return None
    if parts.scheme.lower() not in ("http", "https") or not parts.hostname:
        return None
    if "@" in parts.netloc or parts.query or parts.fragment or value.endswith(("?", "#")):
        return None
    return value


def _apprise_sender(url: str) -> Callable[[str, str], bool]:
    def send(title: str, body: str) -> bool:
        import apprise

        app = apprise.Apprise()
        if not app.add(url):
            return False
        return bool(app.notify(title=title, body=body))

    return send


class Notifier:
    def __init__(self, url: Optional[str], base_url: Optional[str], logger, send=None):
        self.url = (url or "").strip() or None
        self.logger = logger
        self.base_url = clean_public_base_url(base_url)
        if (base_url or "").strip() and self.base_url is None:
            # Not the value itself: keep logs free of whatever was pasted there.
            logger.log(
                "PUBLIC_BASE_URL is ignored: use a plain http:// or https:// address without user, password, ? or #.",
                "warning",
            )
        self._send = send or (_apprise_sender(self.url) if self.url else None)

    @classmethod
    def from_env(cls, logger) -> "Notifier":
        return cls(os.environ.get(NOTIFY_URL_ENV), os.environ.get(PUBLIC_BASE_URL_ENV), logger)

    @property
    def enabled(self) -> bool:
        return self.url is not None

    def notify(self, *, done: bool, file_count: int, device: str) -> bool:
        if not self.enabled or self._send is None:
            return False
        title, body = build_message(
            done=done, file_count=file_count, device=device, link=self.base_url
        )
        try:
            sent = bool(self._send(title, body))
        except Exception as error:
            # Only the error type: messages often repeat the URL with its token.
            self.logger.log(f"Notification failed ({type(error).__name__}).", "warning")
            return False
        if not sent:
            self.logger.log("Notification failed: the notification service did not accept it.", "warning")
        return sent
