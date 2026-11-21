"""The 404 answer for unknown URLs: an HTML page for browsers, JSON for everyone else.

The page uses the look of /api/v1/docs (same header, logo, colours) plus the
mascot. Its files come from /api/v1/docs/<name>, which serves these few
page files in every mode (see api_access.PAGE_ASSETS), API_ONLY included.
Links are relative to the container, never localhost.
"""

from html import escape

from flask import Response, jsonify, request

from backend.image_converter.config import settings
from backend.image_converter.presentation.web.api_access import API_PREFIX

NOT_FOUND_MESSAGE = "The requested resource was not found."
API_ONLY_MESSAGE = (
    "This container is API only. The web UI is not served. "
    "The API is at /api/v1, docs at /api/v1/docs."
)


def prefers_html() -> bool:
    """True when the caller ranks text/html above JSON (a browser), not for curl's */*."""
    # JSON first: a tie (*/*, or no Accept at all) stays JSON.
    return request.accept_mimetypes.best_match(["application/json", "text/html"]) == "text/html"


def _page(web_ui: bool, docs: bool, api_only: bool) -> str:
    base = escape(request.script_root.rstrip("/"), quote=True)
    assets = f"{base}{API_PREFIX}/docs"
    actions = []
    if web_ui:
        actions.append(f'<a class="imgc-button" href="{base}/">Go to the start page</a>')
    if docs:
        css = "imgc-link" if web_ui else "imgc-button"
        actions.append(f'<a class="{css}" href="{base}{API_PREFIX}/docs">Open the API docs</a>')
    if api_only:
        text = "This container is API only, so there is no web UI here. The API docs list every endpoint."
    elif web_ui:
        text = "This page does not exist. Check the link, or start over from the start page."
    else:
        text = "This page does not exist."
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Page not found | imgcompress</title>
  <link rel="icon" href="{assets}/favicon.webp">
  <link rel="stylesheet" href="{assets}/imgcompress-docs.css">
</head>
<body>
  <header class="imgc-header">
    <img class="imgc-logo" src="{assets}/logo.webp" alt="imgcompress logo" width="64" height="52">
    <div class="imgc-brand">
      <span class="imgc-name">imgcompress</span>
      <span class="imgc-tagline">Your self-hosted image toolbox</span>
    </div>
  </header>
  <main class="imgc-404">
    <img class="imgc-mascot" src="{assets}/mascot.webp" alt="The imgcompress mascot" width="240" height="240">
    <p class="imgc-code">404</p>
    <h1>Page not found</h1>
    <p>{text}</p>
    <nav class="imgc-actions">{"".join(actions)}</nav>
  </main>
</body>
</html>
"""


def not_found_response(_error=None):
    """404 for any unknown URL, in the format the caller asked for."""
    api = settings.get().public_api
    if prefers_html():
        page = _page(web_ui=not api.api_only, docs=api.is_enabled, api_only=api.api_only)
        return Response(page, status=404, mimetype="text/html")
    is_api_path = request.path.startswith("/api/")
    message = API_ONLY_MESSAGE if api.api_only and not is_api_path else NOT_FOUND_MESSAGE
    return jsonify({"error": "Not Found", "message": message}), 404
