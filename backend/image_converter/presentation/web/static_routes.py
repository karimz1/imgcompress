import os
import re

from flask import Blueprint, jsonify, request, send_from_directory, abort, current_app
from werkzeug.security import safe_join

from backend.image_converter.config import settings
from backend.image_converter.infrastructure.notifier import NOTIFY_URL_ENV
from backend.image_converter.presentation.web.not_found_page import API_ONLY_MESSAGE, not_found_response

static_blueprint = Blueprint("static_blueprint", __name__)

_API_ONLY_MESSAGE = API_ONLY_MESSAGE
# Notification links /r/<job_id>/<share_token> open the web UI, which reads the path
# (frontend/src/lib/conversionJob.ts SHARE_PATH). Any other unknown path is a 404.
_SHARE_LINK = re.compile(r"^(?:.*/)?r/[A-Za-z0-9_-]{22}/[A-Za-z0-9_-]{16,128}/?$")


def install_api_only_web_ui_gate(app):
    """Hide every non-API path when API_ONLY is on, including Flask's /static.

    Flask serves `static_folder` at `/static` on the app itself, not on this
    blueprint, so a blueprint hook would still leak the web UI there.
    """

    @app.before_request
    def hide_web_ui_when_api_only():
        if not settings.get().public_api.api_only:
            return None
        if request.path.startswith("/api/"):
            return None
        if request.path in ("/", ""):
            return jsonify({"message": _API_ONLY_MESSAGE}), 200
        return not_found_response()


def _flag(value: bool) -> str:
    return str(value).lower()


@static_blueprint.route("/config/runtime.json")
def serve_runtime_config():
    config = settings.get()
    features = config.features
    return jsonify({
        "DISABLE_LOGO": _flag(not features.is_logo_enabled),
        "DISABLE_STORAGE_MANAGEMENT": _flag(not features.is_storage_management_enabled),
        "DEV_MODE": _flag(features.is_dev_mode_enabled),
        "DISABLE_UPDATE_CHECK": _flag(not features.is_update_check_enabled),
        "MAX_UPLOAD_SIZE_MB": str(config.uploads.max_file_size_mebibytes),
        "MAX_OUTPUT_MEGAPIXELS": str(config.upscaling.max_output_megapixels),
        # Only whether it is on; the URL often holds a secret token.
        "NOTIFY_ENABLED": _flag(bool(os.environ.get(NOTIFY_URL_ENV, "").strip())),
    })


def serve_static_file(filename: str):
    """
    Serve a file from the Flask app's configured static_folder.
    current_app.static_folder is set by your main Flask app.
    """
    try:
        return send_from_directory(current_app.static_folder, filename)
    except Exception as e:
        current_app.logger.error(f"Error serving static file {filename}: {e}")
        return jsonify({
            "error": "File Not Found",
            "message": f"The requested file {filename} was not found on the server."
        }), 404


@static_blueprint.errorhandler(404)
def not_found_handler(error):
    """Unknown paths get the 404 page (browsers) or JSON (scripts), never the web UI."""
    return not_found_response(error)


@static_blueprint.route("/")
def serve_index():
    """
    Serve the main index.html at the root URL.
    """
    return serve_static_file("index.html")


@static_blueprint.route("/_next/static/<path:path>")
def serve_next_static(path):
    """
    Serve files from the Next.js .next/static folder.
    """
    return send_from_directory(
        os.path.join(current_app.static_folder, "_next", "static"),
        path
    )


@static_blueprint.route("/<path:path>")
def serve_out_files(path):
    """
    Catch-all route for non-API paths:
      1) If it starts with 'api/', abort(404): the 404 page or JSON, never the web UI.
      2) Else, serve the file if it exists.
      3) A notification link /r/<job_id>/<share_token> gets index.html; the web UI reads the path.
      4) Anything else is a 404.
    """
    if path.startswith("api/"):
        abort(404)

    full_path = safe_join(current_app.static_folder, path)
    if full_path is not None and os.path.isfile(full_path):
        return send_from_directory(current_app.static_folder, path)

    if _SHARE_LINK.match(path):
        return serve_static_file("index.html")
    abort(404)
