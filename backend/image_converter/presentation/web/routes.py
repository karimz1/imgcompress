from datetime import datetime, timezone
import base64
import json
import os
from io import BytesIO
from typing import Optional

from flask import Blueprint, Response, abort, current_app, jsonify, request, send_file, send_from_directory

from backend.image_converter.application.compress_images_usecase import CompressImagesUseCase
from backend.image_converter.application.payload_expander_factory import create_payload_expander
from backend.image_converter.config import settings
from backend.image_converter.core.factory.converter_factory import ImageConverterFactory
from backend.image_converter.core.internals.utilities import has_internet
from backend.image_converter.domain.image_resizer import ImageResizer
from backend.image_converter.infrastructure.ai_upscaler import AiUpscaler
from backend.image_converter.infrastructure.conversion_job_store import ConversionJobStore
from backend.image_converter.application import conversion_options as options
from backend.image_converter.infrastructure.editor_asset_store import (
    EXPIRED_ERROR,
    EditorAssetStore,
    error_status as editor_error_status,
)
from backend.image_converter.infrastructure.local_storage import LocalStorage
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.infrastructure.notifier import Notifier
from backend.image_converter.presentation.web import api_access, openapi
from backend.image_converter.presentation.web.api_errors import error
from backend.image_converter.presentation.web.parse_services import (
    parse_compression_form,
    unsupported_file_names,
    uploaded_files,
)
from backend.image_converter.presentation.web.services.backend_diagnostics_service import BackendDiagnosticsService
from backend.image_converter.presentation.web.services.compression_service import (
    ZIP_DOWNLOAD_NAME,
    CompressionService,
)
from backend.image_converter.presentation.web.services.configuration_service import ConfigurationService
from backend.image_converter.presentation.web.services.conversion_job_service import ConversionJobService
from backend.image_converter.presentation.web.services.crop_bitmap_request_service import CropBitmapRequestService
from backend.image_converter.presentation.web.services.crop_preview_service import CropPreviewService
from backend.image_converter.presentation.web.services.fit_preview_service import FitPreviewService
from backend.image_converter.presentation.web.services.storage_management_service import StorageManagementService
from backend.image_converter.presentation.web.services.temporary_folder_service import TemporaryFolderService

_config = settings.get()

# The one HTTP API, served at /api/v1: the web UI uses it, and so can other
# apps when ENABLE_PUBLIC_API is on (see api_access). Routes only translate
# HTTP to the services below and back; the OpenAPI spec (openapi.py) documents
# every one of them.
api_blueprint = Blueprint("api_v1", __name__)
api_blueprint.before_request(api_access.check_access)
api_blueprint.after_request(api_access.add_cors_headers)

# Pre-v1 monitors used /api/health/backend. The route is added after health()
# so it can reuse that handler; registered in server.py at prefix /api.
legacy_blueprint = Blueprint("api_legacy", __name__)
legacy_blueprint.before_request(api_access.check_access)
legacy_blueprint.after_request(api_access.add_cors_headers)

TEMP_DIR = _config.temporary_storage.directory
EXPIRATION_TIME = _config.temporary_storage.max_age_seconds
logger = Logger(debug=False, json_output=False)

resizer = ImageResizer()
storage = LocalStorage(logger=logger)
payload_expander = create_payload_expander(logger)
upscaler = AiUpscaler(
    logger,
    threads=_config.upscaling.threads,
    max_output_megapixels=_config.upscaling.max_output_megapixels,
)
use_case = CompressImagesUseCase(
    logger, resizer, ImageConverterFactory, storage, payload_expander, upscaler=upscaler
)

temp_folder_service = TemporaryFolderService(TEMP_DIR, EXPIRATION_TIME, logger)
compression_service = CompressionService(logger, use_case, temp_folder_service)
conversion_jobs = ConversionJobService(
    logger,
    compression_service,
    ConversionJobStore(TEMP_DIR),
    notifier=Notifier.from_env(logger, result_ttl_seconds=EXPIRATION_TIME),
)
storage_management_service = StorageManagementService(
    is_enabled=_config.features.is_storage_management_enabled,
)
configuration_service = ConfigurationService(rembg_model_name=_config.rembg.model_name)
crop_preview_service = CropPreviewService(
    logger,
    payload_expander,
    unsupported_extensions=_config.crop_preview.unsupported_input_extensions,
    max_attempts=_config.crop_preview.max_retry_attempts,
)
crop_bitmap_request_service = CropBitmapRequestService(crop_preview_service, TEMP_DIR)
fit_preview_service = FitPreviewService()
editor_assets = EditorAssetStore(TEMP_DIR)
backend_diagnostics_service = BackendDiagnosticsService(
    logger,
    TEMP_DIR,
    storage_management_service,
)


# --- helpers ------------------------------------------------------------------

_JOB_TOKEN_HEADER = "X-Job-Token"
_SWAGGER_DIR = os.path.join(os.path.dirname(__file__), "swagger_ui")
# swagger-ui-dist files copied into the image at build (no CDN); the init script is ours.
_SWAGGER_FILES = frozenset({"swagger-ui.css", "swagger-ui-bundle.js", "swagger-ui-init.js"})


def _no_store(response):
    response.headers["Cache-Control"] = "no-store"
    return response


def _storage_management_disabled():
    return error(403, "Storage management is disabled on this container (DISABLE_STORAGE_MANAGEMENT).")


def _parsed_upload():
    """(form data, None) or (None, error response) for /convert and /jobs."""
    files = uploaded_files(request.files)
    if not files:
        return None, error(400, "Upload at least one image in the 'files[]' (or 'file') field.")
    unsupported = unsupported_file_names(files)
    if unsupported:
        return None, error(
            415, f"Unsupported file types: {', '.join(unsupported)}. GET /api/v1/formats lists the supported ones."
        )
    problem = options.strict_error(request.form, options.CONVERSION_OPTIONS + (options.OUTPUT,))
    if problem:
        return None, error(400, problem)
    parsed = parse_compression_form(files, request.form, logger)
    if not parsed.is_successful:
        return None, error(400, str(parsed.error))
    return parsed.value, None


# --- docs ---------------------------------------------------------------------

@api_blueprint.route("/docs", methods=["GET"])
def swagger_ui():
    return Response(openapi.swagger_page(request.script_root), mimetype="text/html")


@api_blueprint.route("/docs/<name>", methods=["GET"])
def swagger_asset(name: str):
    if name not in _SWAGGER_FILES:
        abort(404)
    return send_from_directory(_SWAGGER_DIR, name)


@api_blueprint.route("/openapi.json", methods=["GET"])
def openapi_spec():
    return jsonify(openapi.build_spec(script_root=request.script_root))


# --- health and info ----------------------------------------------------------

@api_blueprint.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "running",
        "api_version": openapi.API_VERSION,
        "utc_time": datetime.now(timezone.utc).isoformat(),
    }), 200


legacy_blueprint.add_url_rule("/health/backend", "health_backend", view_func=health, methods=["GET"])


@api_blueprint.route("/health/internet", methods=["GET"])
def health_internet():
    return jsonify({
        "internet": has_internet(),
        "utc_time": datetime.now(timezone.utc).isoformat(),
    }), 200


def _app_version() -> Optional[str]:
    try:
        with open(os.path.join(current_app.static_folder, "build-info.json"), encoding="utf-8") as f:
            version = json.load(f).get("version")
        return version if isinstance(version, str) else None
    except (OSError, ValueError, TypeError, AttributeError):
        return None


@api_blueprint.route("/info", methods=["GET"])
def info():
    config = settings.get()
    return jsonify({
        "api_version": openapi.API_VERSION,
        "app_version": _app_version(),
        "public_api_enabled": config.public_api.is_enabled,
        "auth_required": config.public_api.requires_key,
        "storage_management_enabled": storage_management_service.is_storage_management_enabled(),
        "notifications_enabled": conversion_jobs.notify_enabled,
        "limits": {
            "max_upload_size_mb": config.uploads.max_file_size_mebibytes,
            "max_output_megapixels": config.upscaling.max_output_megapixels,
            "max_fit_dimension": options.FIT_WIDTH.maximum,
            "result_retention_seconds": EXPIRATION_TIME,
        },
    }), 200


@api_blueprint.route("/formats", methods=["GET"])
def formats():
    return jsonify({
        "supported_formats": configuration_service.get_supported_formats(),
        "verified_formats": configuration_service.get_verified_formats(),
        "preview_unsupported_formats": crop_preview_service.get_unsupported_extensions(),
        "output_formats": list(options.FORMAT.choices),
    }), 200


@api_blueprint.route("/models/remove-background", methods=["GET"])
def remove_background_model():
    return jsonify({"model_name": configuration_service.get_rembg_model_name()}), 200


@api_blueprint.route("/models/upscale", methods=["GET"])
def upscale_models():
    return jsonify(configuration_service.get_upscale_model_status()), 200


# --- convert ------------------------------------------------------------------

@api_blueprint.route("/convert", methods=["POST"])
def convert():
    """Converts while the request waits and answers with the file itself."""
    temp_folder_service.cleanup()
    form_data, failure = _parsed_upload()
    if failure:
        return failure
    always_zip = (request.form.get(options.OUTPUT.name) or "").strip().lower() == "zip"
    outcome = compression_service.convert_for_download(form_data, always_zip=always_zip)
    if outcome.download is None:
        return error(400 if outcome.invalid else 422, str(outcome.error))
    download = outcome.download
    response = send_file(
        download.stream, as_attachment=True, download_name=download.download_name, mimetype=download.mimetype
    )
    response.headers["X-Converted-Count"] = str(len(download.summary.processed_files))
    response.headers["X-Failed-Count"] = str(len(download.summary.errors))
    return _no_store(response)


# --- jobs ---------------------------------------------------------------------
# The job token travels in a header, never in the URL, so proxies and access
# logs do not record it. Unknown id, missing token and wrong token all get the
# same 404, so nobody can tell whether another user's job exists.

def _job_token():
    return request.headers.get(_JOB_TOKEN_HEADER)


def _job_not_found():
    return error(404, "Job not found. It may have expired, or the X-Job-Token is wrong.")


@api_blueprint.route("/jobs", methods=["POST"])
def start_conversion_job():
    """Same form as /convert, but answers at once with a job to poll.

    The conversion keeps running when the caller goes away (an iPhone app
    switch, a reload, a proxy timeout); GET /jobs/<id> tells how far it is.
    """
    temp_folder_service.cleanup()
    form_data, failure = _parsed_upload()
    if failure:
        return failure
    result = conversion_jobs.start(form_data, user_agent=request.headers.get("User-Agent"))
    if not result.is_successful:
        return error(400, str(result.error))
    response = _no_store(jsonify(result.value))
    response.headers["Location"] = f"{request.script_root}{api_access.API_PREFIX}/jobs/{result.value['id']}"
    return response, 202


@api_blueprint.route("/jobs/<job_id>", methods=["GET"])
def conversion_job_status(job_id: str):
    state = conversion_jobs.status(job_id, _job_token())
    if state is None:
        return _job_not_found()
    return _no_store(jsonify(state))


@api_blueprint.route("/jobs/<job_id>/notify", methods=["POST"])
def conversion_job_notify(job_id: str):
    """Turns "notify me when done" on or off for this job; the caller may leave afterwards."""
    if not conversion_jobs.notify_enabled:
        return error(409, "Notifications are not configured (NOTIFY_URL).")
    body = request.get_json(silent=True) or {}
    enabled = body.get("enabled") is True
    # The UI language for the message; anything unknown becomes English.
    if not conversion_jobs.set_notify(job_id, _job_token(), enabled, body.get("language")):
        return _job_not_found()
    return "", 204


@api_blueprint.route("/jobs/<job_id>/cancel", methods=["POST"])
def conversion_job_cancel(job_id: str):
    """Stops a running job for its own token. Wrong token and unknown id look the same."""
    result = conversion_jobs.cancel(job_id, _job_token())
    if result is None:
        return _job_not_found()
    if result == "finished":
        return error(409, "Job already finished.")
    return "", 204


@api_blueprint.route("/jobs/<job_id>/claim", methods=["POST"])
def conversion_job_claim(job_id: str):
    """Opens a job from the notification's share link on another device.

    The share token comes in the body, not the URL, and is traded for a job
    token of this device's own, which then works with X-Job-Token as usual.
    """
    body = request.get_json(silent=True) or {}
    claimed = conversion_jobs.claim(job_id, body.get("share_token"))
    if claimed is None:
        return _job_not_found()
    return _no_store(jsonify(claimed))


@api_blueprint.route("/jobs/<job_id>/files/<path:file_name>", methods=["GET"])
def conversion_job_file(job_id: str, file_name: str):
    target = conversion_jobs.result_file(job_id, _job_token(), file_name)
    if target is None:
        return _job_not_found()
    return _no_store(send_file(target.file_path, as_attachment=True, download_name=target.download_name))


@api_blueprint.route("/jobs/<job_id>/zip", methods=["GET"])
def conversion_job_zip(job_id: str):
    archive = conversion_jobs.result_zip(job_id, _job_token())
    if archive is None:
        return _job_not_found()
    return _no_store(send_file(
        archive, as_attachment=True, download_name=ZIP_DOWNLOAD_NAME, mimetype="application/zip"
    ))


# --- editor -------------------------------------------------------------------

@api_blueprint.route("/preview", methods=["POST"])
def preview():
    """A PNG of any supported input (PSD, HEIC, RAW, PDF page 1, ...), to show or crop it."""
    result = crop_bitmap_request_service.build(request.files)
    if not result.is_successful:
        return error(result.status_code, str(result.error))
    response = send_file(result.value, mimetype="image/png")
    if result.source_size:
        response.headers["X-Image-Width"] = str(result.source_size[0])
        response.headers["X-Image-Height"] = str(result.source_size[1])
    return response


@api_blueprint.route("/edit", methods=["POST"])
def edit():
    """The editor: crop, fit to size, backgrounds, text and picture layers."""
    render = request.form.get("render") == "true"
    with_preview = request.form.get("preview") != "false"
    result = fit_preview_service.build(
        request.files.get("file"),
        request.form,
        full_size=render,
        with_image=render or with_preview,
        background=request.files.get("fit_background"),
        assets=editor_assets,
    )
    if not result.is_successful:
        # 410: the editor session expired; upload the pictures again.
        return error(410 if result.error == EXPIRED_ERROR else 400, str(result.error))
    crop, png = result.value
    if render:
        return send_file(BytesIO(png), mimetype="image/png")
    if not with_preview:
        return jsonify({"crop": crop})
    return jsonify({"crop": crop, "preview": "data:image/png;base64," + base64.b64encode(png).decode("ascii")})


@api_blueprint.route("/editor/assets", methods=["POST"])
def upload_editor_asset():
    """Stores a background or layer picture once for this editor session."""
    temp_folder_service.cleanup()
    session = request.form.get("session") or None
    result = editor_assets.add(session, request.files.get("file"))
    if not result.is_successful:
        # 410 and 409 tell the editor to start a new session and upload again.
        return error(editor_error_status(result.error), str(result.error))
    session, asset = result.value
    return _no_store(jsonify({
        "session": session,
        "asset": asset.asset_id,
        "width": asset.width,
        "height": asset.height,
    }))


# --- storage management (off with DISABLE_STORAGE_MANAGEMENT) -------------------

@api_blueprint.route("/storage", methods=["GET"])
def storage_info():
    if not storage_management_service.is_storage_management_enabled():
        return _storage_management_disabled()
    inventory = temp_folder_service.get_container_files()
    summary = storage_management_service.get_storage_summary(TEMP_DIR, inventory.total_size_mb)
    return jsonify(summary.to_json_dict()), 200


@api_blueprint.route("/storage/files", methods=["GET"])
def container_files():
    if not storage_management_service.is_storage_management_enabled():
        return _storage_management_disabled()
    inventory = temp_folder_service.get_container_files()
    return jsonify(inventory.to_json_dict()), 200


@api_blueprint.route("/storage/files/download", methods=["GET"])
def download_file():
    if not storage_management_service.is_storage_management_enabled():
        return _storage_management_disabled()
    temp_folder_service.cleanup()
    target = temp_folder_service.resolve_download_target(request.args.get("folder"), request.args.get("file"))
    if target is None:
        return error(404, "File not available.")
    temp_folder_service.mark_activity(target.folder_path)
    return send_file(target.file_path, as_attachment=True, download_name=target.download_name)


@api_blueprint.route("/storage/folders/download", methods=["GET"])
def download_all():
    if not storage_management_service.is_storage_management_enabled():
        return _storage_management_disabled()
    temp_folder_service.cleanup()
    result = compression_service.create_all_files_zip(request.args.get("folder"))
    if not result.is_successful:
        return error(400, str(result.error))
    return send_file(result.value, as_attachment=True, download_name=ZIP_DOWNLOAD_NAME, mimetype="application/zip")


@api_blueprint.route("/storage/cleanup", methods=["POST"])
def force_cleanup():
    if not storage_management_service.is_storage_management_enabled():
        return _storage_management_disabled()
    res = temp_folder_service.cleanup(force=True)
    if not res.is_successful:
        return error(500, f"Forced cleanup failed: {res.error}")
    return jsonify({"status": "ok", "message": "Forced cleanup completed."}), 200


@api_blueprint.route("/logs", methods=["GET"])
def backend_logs():
    if not storage_management_service.is_storage_management_enabled():
        return _storage_management_disabled()
    document = backend_diagnostics_service.build_log_document()
    response = Response(document.body, mimetype=document.mimetype)
    response.headers["Content-Disposition"] = f'attachment; filename="{document.filename}"'
    return response
