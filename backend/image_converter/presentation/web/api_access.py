"""Who may call /api/v1, decided per request before any route runs.

The web UI and the API share one origin. A browser marks every request with
where it comes from (Sec-Fetch-Site, else Origin); pages cannot fake these
headers. That is CSRF / cross-site protection, not authentication: a script
can send the same headers.

Three modes:

Default (ENABLE_PUBLIC_API off)
    No CORS headers, Swagger UI and the spec answer 404, and every request a
    browser marks as cross-site is refused with 403 (CSRF defense).
ENABLE_PUBLIC_API on, web UI served
    Swagger UI and the spec are served, and every answer allows any origin
    (``Access-Control-Allow-Origin: *``, never with credentials: the API
    uses no cookies). An optional PUBLIC_API_KEY is required of callers that
    are not the web UI, but it is not a security boundary: anyone who can
    open the UI can do the same. For public hosting use API_ONLY or proxy auth.
API_ONLY (implies the public API on; PUBLIC_API_KEY required)
    The web UI is not served and the CSRF exemption is off. Every /api/v1
    call except the health checks needs the key. This is a real boundary.
    Docs stay open so Swagger UI can load; then Try-it-out uses the key.
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
# Files of the docs page that the 404 page uses too, so they are served in every mode.
PAGE_ASSETS = frozenset({"imgcompress-docs.css", "logo.webp", "favicon.webp", "mascot.webp"})
# Container health checks (healthcheck.py, uptime monitors) work without the key.
OPEN_ENDPOINTS = DOC_ENDPOINTS | {"api_v1.health", "api_v1.health_internet", "api_legacy.health_backend"}

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
    is_page_asset = request.endpoint == "api_v1.swagger_asset" and (request.view_args or {}).get("name") in PAGE_ASSETS
    if request.endpoint in DOC_ENDPOINTS and not config.is_enabled and not is_page_asset:
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
    # SAME_ORIGIN is CSRF protection for the web UI, not authentication.
    # In API_ONLY the web UI is not served, so that exemption is off.
    if request.endpoint in OPEN_ENDPOINTS or (kind == SAME_ORIGIN and not config.api_only):
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


def startup_notices(config=None) -> list[tuple[str, str]]:
    """Log lines for process start: (message, level). Never includes the key itself."""
    api = (config or settings.get()).public_api
    notices: list[tuple[str, str]] = []
    if api.api_only:
        notices.append((
            "API only: the web UI is not served. Call /api/v1 with PUBLIC_API_KEY; "
            "docs at /api/v1/docs. Health checks stay open.",
            "info",
        ))
        return notices
    if api.is_enabled:
        if api.requires_key:
            notices.append((
                "Public API on: other websites may call /api/v1, docs at /api/v1/docs. "
                "PUBLIC_API_KEY is set.",
                "info",
            ))
        else:
            notices.append((
                "Public API on: other websites may call /api/v1, docs at /api/v1/docs. "
                "No PUBLIC_API_KEY: anyone who can reach the container can use the API.",
                "warning",
            ))
    if api.requires_key:
        notices.append((
            "PUBLIC_API_KEY is not a security boundary while the web UI is served: "
            "anyone who can open the UI can do the same. For public hosting use "
            "API_ONLY=true or put proxy auth (Authelia, Authentik, Basic Auth) in front.",
            "warning",
        ))
    return notices

