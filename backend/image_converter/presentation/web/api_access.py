"""Who may call /api/v1, decided per request before any route runs.

The web UI and the API share one origin. A browser marks every request with
where it comes from (Sec-Fetch-Site, else Origin); pages cannot fake these
headers, so a request a browser marks as same-origin really comes from the
web UI (or a URL the user typed). Scripts send neither header.

ENABLE_PUBLIC_API off (default)
    No CORS headers, Swagger UI and the spec answer 404, and every request a
    browser marks as cross-site is refused with 403 (CSRF protection).
ENABLE_PUBLIC_API on
    Swagger UI and the spec are served, and every answer allows any origin
    (``Access-Control-Allow-Origin: *``, never with credentials: the API
    uses no cookies).
API_KEY set (either mode)
    Everything except the web UI (same-origin browser requests) and the
    health checks needs ``Authorization: Bearer <key>`` or ``X-API-Key``.

Limits: Sec-Fetch-Site and Origin only bind browsers. A script can send
"Sec-Fetch-Site: same-origin" too and then counts as the web UI, which anyone
who can open the web UI can use anyway. To keep a container private, limit
who reaches it (network, VPN, reverse proxy with auth); API_KEY guards the
API for other websites and casual scripts, not the web UI itself.
"""

import os
from typing import Iterable, Optional
from urllib.parse import urlsplit

from flask import Response, abort, request

from backend.image_converter.config import settings
from backend.image_converter.infrastructure.notifier import PUBLIC_BASE_URL_ENV, clean_public_base_url
from backend.image_converter.presentation.web.api_auth import API_KEY_HEADER, is_authorized
from backend.image_converter.presentation.web.api_errors import error
from backend.image_converter.presentation.web.error_handlers import drop_refused_body

API_PREFIX = "/api/v1"

SAME_ORIGIN = "same-origin"
CROSS_SITE = "cross-site"
NO_BROWSER = "no-browser"

_SAME_ORIGIN_FETCH_SITES = frozenset({"same-origin", "none"})
# Docs and spec exist only with the public API on; they never need the key.
DOC_ENDPOINTS = frozenset({"api_v1.swagger_ui", "api_v1.swagger_asset", "api_v1.openapi_spec"})
# Container health checks (healthcheck.py, uptime monitors) work without the key.
OPEN_ENDPOINTS = DOC_ENDPOINTS | {"api_v1.health", "api_v1.health_internet"}

CORS_ALLOW_HEADERS = f"Authorization, {API_KEY_HEADER}, X-Job-Token, Content-Type"
CORS_EXPOSE_HEADERS = (
    "Content-Disposition, Location, X-Converted-Count, X-Failed-Count, X-Image-Width, X-Image-Height"
)


def _netloc(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    try:
        parts = urlsplit(url)
        host, port = parts.hostname, parts.port
    except ValueError:
        return None
    if not host:
        return None
    default_port = {"http": 80, "https": 443}.get(parts.scheme.lower())
    return host.lower() if port in (None, default_port) else f"{host.lower()}:{port}"


def _host_netlocs(values: Iterable[str]) -> set[str]:
    hosts = set()
    for value in values:
        for item in value.split(","):
            netloc = _netloc(f"http://{item.strip()}") if item.strip() else None
            if netloc:
                hosts.add(netloc)
                # The scheme is not compared (TLS often ends at the proxy), so
                # host:80 and host:443 also stand for the bare host.
                if netloc.endswith((":80", ":443")):
                    hosts.add(netloc.rsplit(":", 1)[0])
    return hosts


def _own_hosts() -> set[str]:
    # X-Forwarded-Host is not a header a page may send cross-site without a
    # preflight, and preflights from other sites are refused while the public
    # API is off, so trusting it here does not open a hole.
    hosts = _host_netlocs([request.host or "", *request.headers.getlist("X-Forwarded-Host")])
    base = _netloc(clean_public_base_url(os.environ.get(PUBLIC_BASE_URL_ENV)))
    if base:
        hosts.add(base)
    return hosts


def request_origin_kind() -> str:
    """SAME_ORIGIN (the web UI), CROSS_SITE (another website) or NO_BROWSER."""
    fetch_site = (request.headers.get("Sec-Fetch-Site") or "").strip().lower()
    if fetch_site:
        return SAME_ORIGIN if fetch_site in _SAME_ORIGIN_FETCH_SITES else CROSS_SITE
    origin = request.headers.get("Origin")
    if origin is None:
        return NO_BROWSER
    netloc = _netloc(origin.strip())
    # "null" (sandboxed frames, file://) counts as foreign.
    if netloc is not None and netloc in _own_hosts():
        return SAME_ORIGIN
    return CROSS_SITE


def _refuse(status: int, message: str, headers: Optional[dict] = None):
    drop_refused_body()
    return error(status, message, headers=headers)


def check_access():
    """``before_request`` of the API blueprint."""
    config = settings.get().public_api
    if request.endpoint in DOC_ENDPOINTS and not config.is_enabled:
        abort(404)

    kind = request_origin_kind()
    if kind == CROSS_SITE and not config.is_enabled:
        return _refuse(
            403,
            "This container does not accept requests from other websites. "
            "Set ENABLE_PUBLIC_API=true to allow them.",
        )
    if request.method == "OPTIONS":
        # A CORS preflight: never carries the key, answered with the CORS headers.
        return Response(status=204)
    if request.endpoint in OPEN_ENDPOINTS or kind == SAME_ORIGIN:
        return None
    if not is_authorized(request, config.api_key):
        return _refuse(
            401,
            f"Send the API key as 'Authorization: Bearer <key>' or '{API_KEY_HEADER}: <key>'.",
            {"WWW-Authenticate": 'Bearer realm="imgcompress"'},
        )
    return None


def add_cors_headers(response):
    """``after_request``: only the public API answers other origins."""
    if settings.get().public_api.is_enabled:
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = CORS_ALLOW_HEADERS
        response.headers["Access-Control-Expose-Headers"] = CORS_EXPOSE_HEADERS
        response.headers["Access-Control-Max-Age"] = "600"
    return response
