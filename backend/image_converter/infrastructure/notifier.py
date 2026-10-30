"""Optional "Notify me when done" through Apprise (ntfy, Telegram, mail, ...).

Off unless NOTIFY_URL is set. A message names how many images are ready,
the device that started the job and, if PUBLIC_BASE_URL is set, a link back.
It never names files. A failing notification is logged and never breaks a job;
the log never shows NOTIFY_URL, because it often holds a secret token.
"""

import os
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


def build_message(*, done: bool, file_count: int, device: str, base_url: Optional[str]) -> tuple[str, str]:
    if done:
        title = "1 image ready" if file_count == 1 else f"{file_count} images ready"
        body = f"Your conversion from {device} is done."
    else:
        title = "Conversion failed"
        body = f"Your conversion from {device} did not finish."
    if base_url:
        body += f"\n{base_url}"
    return title, body


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
        self.base_url = (base_url or "").strip() or None
        self.logger = logger
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
        title, body = build_message(done=done, file_count=file_count, device=device, base_url=self.base_url)
        try:
            sent = bool(self._send(title, body))
        except Exception as error:
            # Only the error type: messages often repeat the URL with its token.
            self.logger.log(f"Notification failed ({type(error).__name__}).", "warning")
            return False
        if not sent:
            self.logger.log("Notification failed: the notification service did not accept it.", "warning")
        return sent
