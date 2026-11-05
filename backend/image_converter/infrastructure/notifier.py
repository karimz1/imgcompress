"""Optional "Notify me when done" through Apprise (ntfy, Telegram, mail, ...).

Off unless NOTIFY_URL is set. A message names how many images are ready and how long the job took. When the
admin sets PUBLIC_BASE_URL it carries a share link that opens the result on any
device (a secret made for this one job) and a UTC expiry stamp from send time
plus retention; without it, it tells you to open imgcompress in the browser
that started the job. It never names files. A failing notification is logged and never breaks a job;
the log never shows NOTIFY_URL, because it often holds a secret token.
"""

import os
from datetime import datetime, timedelta, timezone
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


# Message texts per app locale (the same codes as the frontend). Anything else
# falls back to English. {where} is the "in Safari on your iPhone" part.
_TEXTS = {
    "en": dict(open_one="Open this link to download it:", open_many="Open this link to download them:", open_error="Open this link to see what went wrong:",
               one="1 image ready", many="{n} images ready", took=" in {d}", failed="Conversion failed",
               failed_after=" after {d}", get_one="Open imgcompress {where} to get your result.",
               get_many="Open imgcompress {where} to get your results.", see_error="Open imgcompress {where} to see what went wrong.",
               where="in {browser} on your {platform}", where_unknown="in the browser you used",
               nouns={"Windows": "Windows PC", "Linux": "Linux PC", "Android": "Android device", "ChromeOS": "Chromebook"},
               link_expires="Link expires {when}.", expires_when="{d} {mon} {y}, {hh}:{mm} UTC",
               s="{s} s", m="{m} min {s} s", h="{h} h {m} min"),
    "de": dict(open_one="Öffne diesen Link, um es zu laden:", open_many="Öffne diesen Link, um sie zu laden:", open_error="Öffne diesen Link, um zu sehen, was schiefging:",
               one="1 Bild fertig", many="{n} Bilder fertig", took=" in {d}", failed="Konvertierung fehlgeschlagen",
               failed_after=" nach {d}", get_one="Öffne imgcompress {where}, um dein Ergebnis zu holen.",
               get_many="Öffne imgcompress {where}, um deine Ergebnisse zu holen.", see_error="Öffne imgcompress {where}, um zu sehen, was schiefging.",
               where="in {browser} auf deinem {platform}", where_unknown="in dem Browser, den du benutzt hast",
               nouns={"Windows": "Windows-PC", "Linux": "Linux-PC", "Android": "Android-Gerät", "ChromeOS": "Chromebook"},
               link_expires="Der Link gilt bis {when}.", expires_when="{d}. {mon} {y}, {hh}:{mm} UTC",
               s="{s} s", m="{m} min {s} s", h="{h} h {m} min"),
    "fr": dict(open_one="Ouvrez ce lien pour la télécharger :", open_many="Ouvrez ce lien pour les télécharger :", open_error="Ouvrez ce lien pour voir ce qui n'a pas marché :",
               one="1 image prête", many="{n} images prêtes", took=" en {d}", failed="Échec de la conversion",
               failed_after=" après {d}", get_one="Ouvrez imgcompress {where} pour récupérer votre résultat.",
               get_many="Ouvrez imgcompress {where} pour récupérer vos résultats.", see_error="Ouvrez imgcompress {where} pour voir ce qui n'a pas marché.",
               where="dans {browser} sur votre {platform}", where_unknown="dans le navigateur utilisé",
               nouns={"Windows": "PC Windows", "Linux": "PC Linux", "Android": "appareil Android", "ChromeOS": "Chromebook"},
               link_expires="Le lien expire le {when}.", expires_when="{d} {mon} {y}, {hh}:{mm} UTC",
               s="{s} s", m="{m} min {s} s", h="{h} h {m} min"),
    "es-MX": dict(open_one="Abre este enlace para descargarla:", open_many="Abre este enlace para descargarlas:", open_error="Abre este enlace para ver qué salió mal:",
               one="1 imagen lista", many="{n} imágenes listas", took=" en {d}", failed="La conversión falló",
               failed_after=" tras {d}", get_one="Abre imgcompress {where} para obtener tu resultado.",
               get_many="Abre imgcompress {where} para obtener tus resultados.", see_error="Abre imgcompress {where} para ver qué salió mal.",
               where="en {browser} en tu {platform}", where_unknown="en el navegador que usaste",
               nouns={"Windows": "PC con Windows", "Linux": "PC con Linux", "Android": "dispositivo Android", "ChromeOS": "Chromebook"},
               link_expires="El enlace caduca el {when}.", expires_when="{d} {mon} {y}, {hh}:{mm} UTC",
               s="{s} s", m="{m} min {s} s", h="{h} h {m} min"),
    "pt-BR": dict(open_one="Abra este link para baixar:", open_many="Abra este link para baixar:", open_error="Abra este link para ver o que deu errado:",
               one="1 imagem pronta", many="{n} imagens prontas", took=" em {d}", failed="A conversão falhou",
               failed_after=" após {d}", get_one="Abra o imgcompress {where} para pegar seu resultado.",
               get_many="Abra o imgcompress {where} para pegar seus resultados.", see_error="Abra o imgcompress {where} para ver o que deu errado.",
               where="no {browser} do seu {platform}", where_unknown="no navegador que você usou",
               nouns={"Windows": "PC com Windows", "Linux": "PC com Linux", "Android": "dispositivo Android", "ChromeOS": "Chromebook"},
               link_expires="O link expira em {when}.", expires_when="{d} {mon} {y}, {hh}:{mm} UTC",
               s="{s} s", m="{m} min {s} s", h="{h} h {m} min"),
    "ru": dict(open_one="Откройте ссылку, чтобы скачать:", open_many="Откройте ссылку, чтобы скачать:", open_error="Откройте ссылку, чтобы узнать, что пошло не так:",
               one="1 изображение готово", many="Готово изображений: {n}", took=" за {d}", failed="Ошибка конвертации",
               failed_after=" через {d}", get_one="Откройте imgcompress {where}, чтобы забрать результат.",
               get_many="Откройте imgcompress {where}, чтобы забрать результаты.", see_error="Откройте imgcompress {where}, чтобы узнать, что пошло не так.",
               where="в {browser} на вашем {platform}", where_unknown="в том же браузере",
               nouns={"Windows": "ПК с Windows", "Linux": "ПК с Linux", "Android": "Android-устройстве", "ChromeOS": "Chromebook"},
               link_expires="Ссылка действует до {when}.", expires_when="{d} {mon} {y}, {hh}:{mm} UTC",
               s="{s} с", m="{m} мин {s} с", h="{h} ч {m} мин"),
    "ja": dict(open_one="このリンクを開いてダウンロード：", open_many="このリンクを開いてダウンロード：", open_error="このリンクを開いて原因を確認：",
               one="1 枚の画像が完成", many="{n} 枚の画像が完成", took="（{d}）", failed="変換に失敗しました",
               failed_after="（{d}）", get_one="{where}で imgcompress を開いて結果を受け取ってください。",
               get_many="{where}で imgcompress を開いて結果を受け取ってください。", see_error="{where}で imgcompress を開いて原因を確認してください。",
               where="{platform} の {browser}", where_unknown="使用したブラウザ",
               nouns={"Windows": "Windows PC", "Linux": "Linux PC", "Android": "Android 端末", "ChromeOS": "Chromebook"},
               link_expires="リンクの有効期限：{when}", expires_when="{y}年{mon}{d}日 {hh}:{mm} UTC",
               s="{s} 秒", m="{m} 分 {s} 秒", h="{h} 時間 {m} 分"),
    "zh-CN": dict(open_one="打开此链接下载：", open_many="打开此链接下载：", open_error="打开此链接查看出错原因：",
               one="1 张图片已完成", many="{n} 张图片已完成", took="（用时 {d}）", failed="转换失败",
               failed_after="（{d} 后）", get_one="请在{where}中打开 imgcompress 获取结果。",
               get_many="请在{where}中打开 imgcompress 获取结果。", see_error="请在{where}中打开 imgcompress 查看出错原因。",
               where="你的 {platform} 上的 {browser}", where_unknown="你使用的浏览器",
               nouns={"Windows": "Windows 电脑", "Linux": "Linux 电脑", "Android": "Android 设备", "ChromeOS": "Chromebook"},
               link_expires="链接有效期至 {when}。", expires_when="{y}年{mon}{d}日 {hh}:{mm} UTC",
               s="{s} 秒", m="{m} 分 {s} 秒", h="{h} 小时 {m} 分"),
    "hi": dict(open_one="डाउनलोड करने के लिए यह लिंक खोलें:", open_many="डाउनलोड करने के लिए यह लिंक खोलें:", open_error="क्या गलत हुआ, देखने के लिए यह लिंक खोलें:",
               one="1 इमेज तैयार", many="{n} इमेज तैयार", took=" ({d} में)", failed="कन्वर्ज़न विफल",
               failed_after=" ({d} बाद)", get_one="अपना परिणाम पाने के लिए {where} imgcompress खोलें।",
               get_many="अपने परिणाम पाने के लिए {where} imgcompress खोलें।", see_error="क्या गलत हुआ, देखने के लिए {where} imgcompress खोलें।",
               where="अपने {platform} पर {browser} में", where_unknown="उसी ब्राउज़र में",
               nouns={"Windows": "Windows PC", "Linux": "Linux PC", "Android": "Android डिवाइस", "ChromeOS": "Chromebook"},
               link_expires="लिंक {when} तक मान्य है।", expires_when="{d} {mon} {y}, {hh}:{mm} UTC",
               s="{s} से.", m="{m} मि. {s} से.", h="{h} घं. {m} मि."),
    "hu": dict(open_one="Nyisd meg a linket a letöltéshez:", open_many="Nyisd meg a linket a letöltéshez:", open_error="Nyisd meg a linket, hogy lásd, mi történt:",
               one="1 kép kész", many="{n} kép kész", took=" ({d} alatt)", failed="Az átalakítás nem sikerült",
               failed_after=" ({d} után)", get_one="Nyisd meg az imgcompresst {where} az eredményért.",
               get_many="Nyisd meg az imgcompresst {where} az eredményekért.", see_error="Nyisd meg az imgcompresst {where}, hogy lásd, mi történt.",
               where="a(z) {platform} {browser} böngészőjében", where_unknown="abban a böngészőben, amit használtál",
               nouns={"Windows": "Windows PC", "Linux": "Linux PC", "Android": "Android eszköz", "ChromeOS": "Chromebook"},
               link_expires="A link {when}-ig érvényes.", expires_when="{y}. {mon} {d}. {hh}:{mm} UTC",
               s="{s} mp", m="{m} perc {s} mp", h="{h} óra {m} perc"),
    "ar": dict(open_one="افتح هذا الرابط للتنزيل:", open_many="افتح هذا الرابط للتنزيل:", open_error="افتح هذا الرابط لمعرفة ما حدث:",
               one="صورة واحدة جاهزة", many="{n} صور جاهزة", took=" خلال {d}", failed="فشل التحويل",
               failed_after=" بعد {d}", get_one="افتح imgcompress {where} للحصول على النتيجة.",
               get_many="افتح imgcompress {where} للحصول على النتائج.", see_error="افتح imgcompress {where} لمعرفة ما حدث.",
               where="في {browser} على {platform}", where_unknown="في المتصفح الذي استخدمته",
               nouns={"Windows": "حاسوب Windows", "Linux": "حاسوب Linux", "Android": "جهاز Android", "ChromeOS": "Chromebook"},
               link_expires="ينتهي الرابط في {when}.", expires_when="{d} {mon} {y}، {hh}:{mm} UTC",
               s="{s} ث", m="{m} د {s} ث", h="{h} س {m} د"),
}
DEFAULT_LANGUAGE = "en"

_MONTHS = {
    "en": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    "de": ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sep.", "Okt.", "Nov.", "Dez."],
    "fr": ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
    "es-MX": ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
    "pt-BR": ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
    "ru": ["янв.", "февр.", "мар.", "апр.", "мая", "июн.", "июл.", "авг.", "сент.", "окт.", "нояб.", "дек."],
    "ja": ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
    "zh-CN": ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
    "hi": ["जन", "फर", "मार्च", "अप्रै", "मई", "जून", "जुल", "अग", "सित", "अक्टू", "नव", "दिस"],
    "hu": ["jan.", "feb.", "már.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szep.", "okt.", "nov.", "dec."],
    "ar": ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
}


def resolve_language(value) -> str:
    """An app locale code ('de', 'pt-BR', 'zh-CN'), or English for anything else."""
    if not isinstance(value, str):
        return DEFAULT_LANGUAGE
    value = value.strip()
    if value in _TEXTS:
        return value
    lowered = {code.lower(): code for code in _TEXTS}
    return lowered.get(value.lower()) or lowered.get(value.split("-")[0].lower(), DEFAULT_LANGUAGE)

_URL_MAX_LENGTH = 500


def format_duration(seconds: float, language: str = DEFAULT_LANGUAGE) -> str:
    """'12 s', '47 min 35 s', '1 h 3 min': the same wording as the done sheet."""
    texts = _TEXTS[resolve_language(language)]
    total = max(1, round(seconds))
    hours, rest = divmod(total, 3600)
    minutes, secs = divmod(rest, 60)
    if hours:
        return texts["h"].format(h=hours, m=minutes)
    if minutes:
        return texts["m"].format(m=minutes, s=secs)
    return texts["s"].format(s=secs)



def format_link_expiry(when: datetime, language: str = DEFAULT_LANGUAGE) -> str:
    """Short UTC stamp for the share-link line, in the notify locale."""
    language = resolve_language(language)
    texts = _TEXTS[language]
    when = when.astimezone(timezone.utc)
    return texts["expires_when"].format(
        d=when.day,
        mon=_MONTHS[language][when.month - 1],
        y=when.year,
        hh=f"{when.hour:02d}",
        mm=f"{when.minute:02d}",
    )


def _where(device: str, texts: dict) -> str:
    """'in Safari on your iPhone', or a hint to use the same browser."""
    platform, _, browser = device.partition(" · ")
    if not browser:
        return texts["where_unknown"]
    return texts["where"].format(browser=browser, platform=texts["nouns"].get(platform, platform))


def build_message(
    *,
    done: bool,
    file_count: int,
    device: str,
    link: Optional[str],
    duration_seconds: Optional[float] = None,
    language: Optional[str] = None,
    link_ttl_seconds: Optional[int] = None,
    now: Optional[datetime] = None,
) -> tuple[str, str]:
    """
    With a share link the message says to open it (any device works) and
    stamps when that link is expected to expire (send time + retention).
    Without one, only the browser that started the job knows it, so the
    message says which browser to open. The text follows the UI language of
    that browser; unknown languages get English.
    """
    language = resolve_language(language)
    texts = _TEXTS[language]
    where = _where(device, texts)
    took = format_duration(duration_seconds, language) if duration_seconds is not None else None
    if done:
        title = texts["one"] if file_count == 1 else texts["many"].format(n=file_count)
        if took:
            title += texts["took"].format(d=took)
        if link:
            body = texts["open_one"] if file_count == 1 else texts["open_many"]
        else:
            body = (texts["get_one"] if file_count == 1 else texts["get_many"]).format(where=where)
    else:
        title = texts["failed"]
        if took:
            title += texts["failed_after"].format(d=took)
        body = texts["open_error"] if link else texts["see_error"].format(where=where)
    if link:
        body += f"\n{link}"
        if link_ttl_seconds is not None and link_ttl_seconds > 0:
            stamp = (now or datetime.now(timezone.utc)) + timedelta(seconds=link_ttl_seconds)
            body += "\n" + texts["link_expires"].format(when=format_link_expiry(stamp, language))
    return title, body


def share_link(base_url: Optional[str], job_id: str, share_token: str) -> Optional[str]:
    """'{PUBLIC_BASE_URL}/r/{job id}/{share token}', or None without a base URL."""
    base = clean_public_base_url(base_url)
    if base is None:
        return None
    return f"{base.rstrip('/')}/r/{job_id}/{share_token}"


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
    def __init__(
        self,
        url: Optional[str],
        base_url: Optional[str],
        logger,
        send=None,
        result_ttl_seconds: Optional[int] = None,
    ):
        self.url = (url or "").strip() or None
        self.logger = logger
        self.base_url = clean_public_base_url(base_url)
        self.result_ttl_seconds = (
            int(result_ttl_seconds) if isinstance(result_ttl_seconds, int) and result_ttl_seconds > 0 else None
        )
        if (base_url or "").strip() and self.base_url is None:
            # Not the value itself: keep logs free of whatever was pasted there.
            logger.log(
                "PUBLIC_BASE_URL is ignored: use a plain http:// or https:// address without user, password, ? or #.",
                "warning",
            )
        self._send = send or (_apprise_sender(self.url) if self.url else None)

    @classmethod
    def from_env(cls, logger, result_ttl_seconds: Optional[int] = None) -> "Notifier":
        return cls(
            os.environ.get(NOTIFY_URL_ENV),
            os.environ.get(PUBLIC_BASE_URL_ENV),
            logger,
            result_ttl_seconds=result_ttl_seconds,
        )

    @property
    def enabled(self) -> bool:
        return self.url is not None

    def notify(
        self,
        *,
        done: bool,
        file_count: int,
        device: str,
        duration_seconds: Optional[float] = None,
        language: Optional[str] = None,
        link: Optional[str] = None,
    ) -> bool:
        if not self.enabled or self._send is None:
            return False
        title, body = build_message(
            done=done, file_count=file_count, device=device, link=link,
            duration_seconds=duration_seconds, language=language,
            link_ttl_seconds=self.result_ttl_seconds if link else None,
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
