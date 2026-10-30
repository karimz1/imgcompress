from datetime import datetime, timezone
import base64
import os
from io import BytesIO

from flask import Blueprint, Response, request, jsonify, send_file

from backend.image_converter.application.compress_images_usecase import CompressImagesUseCase
from backend.image_converter.application.payload_expander_factory import create_payload_expander
from backend.image_converter.config import settings
from backend.image_converter.core.factory.converter_factory import ImageConverterFactory
from backend.image_converter.core.internals.utilities import has_internet
from backend.image_converter.domain.image_resizer import ImageResizer
from backend.image_converter.infrastructure.ai_upscaler import AiUpscaler
from backend.image_converter.infrastructure.conversion_job_store import ConversionJobStore
from backend.image_converter.infrastructure.editor_asset_store import (
    EXPIRED_ERROR,
    SESSION_FULL_ERROR,
    EditorAssetStore,
)
from backend.image_converter.infrastructure.local_storage import LocalStorage
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.infrastructure.notifier import Notifier
from backend.image_converter.presentation.web.parse_services import extract_form_data
from backend.image_converter.presentation.web.services.backend_diagnostics_service import BackendDiagnosticsService
from backend.image_converter.presentation.web.services.compression_service import CompressionService
from backend.image_converter.presentation.web.services.configuration_service import ConfigurationService
from backend.image_converter.presentation.web.services.conversion_job_service import ConversionJobService
from backend.image_converter.presentation.web.services.crop_bitmap_request_service import CropBitmapRequestService
from backend.image_converter.presentation.web.services.crop_preview_service import CropPreviewService
from backend.image_converter.presentation.web.services.fit_preview_service import FitPreviewService
from backend.image_converter.presentation.web.services.storage_management_service import StorageManagementService
from backend.image_converter.presentation.web.services.temporary_folder_service import TemporaryFolderService

_config = settings.get()

api_blueprint = Blueprint("api", __name__)

TEMP_DIR = _config.temporary_storage.directory
EXPIRATION_TIME = _config.temporary_storage.max_age_seconds
_ZIP_DOWNLOAD_NAME = "compressed_images.zip"
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
    logger, compression_service, ConversionJobStore(TEMP_DIR), notifier=Notifier.from_env(logger)
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


def _storage_management_disabled_response():
    return jsonify({"error": "Storage management endpoints are disabled in this mode."}), 403


@api_blueprint.route("/compress", methods=["POST"])
def compress_images():
    temp_folder_service.cleanup()

    data_result = extract_form_data(request, logger)
    if not data_result.is_successful:
        return jsonify({"error": str(data_result.error)}), 400

    result = compression_service.compress(data_result.value)
    if not result.is_successful:
        return jsonify({"error": "Compression failed", "message": result.error}), 500

    return jsonify({"status": "ok", **result.value.to_json_dict()}), 200


@api_blueprint.route("/jobs", methods=["POST"])
def start_conversion_job():
    """Same form as /compress, but answers at once with a job to poll.

    The conversion keeps running when the browser goes away (an iPhone app
    switch, a reload, a proxy timeout); the page asks GET /jobs/<id> later.
    """
    temp_folder_service.cleanup()

    data_result = extract_form_data(request, logger)
    if not data_result.is_successful:
        return jsonify({"error": str(data_result.error)}), 400

    result = conversion_jobs.start(data_result.value, user_agent=request.headers.get("User-Agent"))
    if not result.is_successful:
        return jsonify({"error": "Compression failed", "message": result.error}), 400

    response = jsonify(result.value)
    response.headers["Location"] = f"{request.script_root}/api/jobs/{result.value['id']}"
    response.headers["Cache-Control"] = "no-store"
    return response, 202


# The job token travels in a header, never in the URL, so proxies and access
# logs do not record it. Unknown id, missing token and wrong token all get the
# same 404, so nobody can tell whether another user's job exists.
_JOB_TOKEN_HEADER = "X-Job-Token"


def _job_not_found():
    response = jsonify({"error": "Job not found. It may have expired."})
    response.headers["Cache-Control"] = "no-store"
    return response, 404


def _job_token():
    return request.headers.get(_JOB_TOKEN_HEADER)


@api_blueprint.route("/jobs/<job_id>", methods=["GET"])
def conversion_job_status(job_id: str):
    state = conversion_jobs.status(job_id, _job_token())
    if state is None:
        return _job_not_found()
    response = jsonify(state)
    response.headers["Cache-Control"] = "no-store"
    return response


@api_blueprint.route("/jobs/<job_id>/notify", methods=["POST"])
def conversion_job_notify(job_id: str):
    """Turns "notify me when done" on or off for this job; the tab may close afterwards."""
    if not conversion_jobs.notify_enabled:
        return jsonify({"error": "Notifications are not configured."}), 409
    body = request.get_json(silent=True) or {}
    enabled = body.get("enabled") is True
    # The browser's UI language for the message; anything unknown becomes English.
    if not conversion_jobs.set_notify(job_id, _job_token(), enabled, body.get("language")):
        return _job_not_found()
    return "", 204


@api_blueprint.route("/jobs/<job_id>/files/<path:file_name>", methods=["GET"])
def conversion_job_file(job_id: str, file_name: str):
    folder = conversion_jobs.result_folder(job_id, _job_token())
    target = temp_folder_service.resolve_download_target(folder, file_name) if folder else None
    if target is None:
        return _job_not_found()
    temp_folder_service.mark_activity(os.path.dirname(target.file_path))
    response = send_file(target.file_path, as_attachment=True, download_name=target.download_name)
    response.headers["Cache-Control"] = "no-store"
    return response


@api_blueprint.route("/jobs/<job_id>/zip", methods=["GET"])
def conversion_job_zip(job_id: str):
    folder = conversion_jobs.result_folder(job_id, _job_token())
    result = compression_service.create_all_files_zip(folder) if folder else None
    if result is None or not result.is_successful:
        return _job_not_found()
    response = send_file(
        result.value, as_attachment=True, download_name=_ZIP_DOWNLOAD_NAME, mimetype="application/zip"
    )
    response.headers["Cache-Control"] = "no-store"
    return response


@api_blueprint.route("/download", methods=["GET"])
def download_file():
    temp_folder_service.cleanup()

    target = temp_folder_service.resolve_download_target(
        request.args.get("folder"),
        request.args.get("file"),
    )
    if target is None:
        return jsonify({"error": "File not available."}), 404

    temp_folder_service.mark_activity(os.path.dirname(target.file_path))
    return send_file(
        target.file_path,
        as_attachment=True,
        download_name=target.download_name,
    )


@api_blueprint.route("/download_all", methods=["GET"])
def download_all():
    temp_folder_service.cleanup()
    folder_param = request.args.get("folder")

    result = compression_service.create_all_files_zip(folder_param)

    if not result.is_successful:
        return jsonify({"error": result.error}), 400
    return send_file(
        result.value,
        as_attachment=True,
        download_name=_ZIP_DOWNLOAD_NAME,
        mimetype="application/zip",
    )


@api_blueprint.route("/storage_info", methods=["GET"])
def storage_info():
    if not storage_management_service.is_storage_management_enabled():
        return _storage_management_disabled_response()

    inventory = temp_folder_service.get_container_files()
    summary = storage_management_service.get_storage_summary(TEMP_DIR, inventory.total_size_mb)
    return jsonify(summary.to_json_dict()), 200


@api_blueprint.route("/force_cleanup", methods=["POST"])
def force_cleanup():
    if not storage_management_service.is_storage_management_enabled():
        return _storage_management_disabled_response()

    res = temp_folder_service.cleanup(force=True)
    if not res.is_successful:
        return jsonify({"error": "Forced cleanup failed", "message": res.error}), 500
    return jsonify({"status": "ok", "message": "Forced cleanup completed."}), 200


@api_blueprint.route("/container_files", methods=["GET"])
def container_files():
    if not storage_management_service.is_storage_management_enabled():
        return _storage_management_disabled_response()

    inventory = temp_folder_service.get_container_files()
    return jsonify(inventory.to_json_dict()), 200

@api_blueprint.route("/health/internet", methods=["GET"])
def health_internet():
    return jsonify({
        "internet": has_internet(),
        "utc_time": datetime.now(timezone.utc).isoformat()
    }), 200


@api_blueprint.route("/health/backend", methods=["GET"])
def health_live():
    return jsonify({
        "status": "running",
        "utc_time": datetime.now(timezone.utc).isoformat()
    }), 200


@api_blueprint.route("/images_supported", methods=["GET"])
def supported_image_formats():
    return jsonify({"supported_formats": configuration_service.get_supported_formats()}), 200


@api_blueprint.route("/images_verified", methods=["GET"])
def verified_image_formats():
    return jsonify({"verified_formats": configuration_service.get_verified_formats()}), 200


@api_blueprint.route("/rembg_model", methods=["GET"])
def rembg_model():
    return jsonify({"model_name": configuration_service.get_rembg_model_name()}), 200


@api_blueprint.route("/upscale_model", methods=["GET"])
def upscale_model():
    return jsonify(configuration_service.get_upscale_model_status()), 200


@api_blueprint.route("/crop_unsupported_formats", methods=["GET"])
def crop_unsupported_formats():
    return jsonify({
        "unsupported_formats": crop_preview_service.get_unsupported_extensions()
    }), 200


@api_blueprint.route("/crop/fit", methods=["POST"])
def fit_editor_bitmap():
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
        # 410: the editor session expired; the editor uploads its pictures again.
        status = 410 if result.error == EXPIRED_ERROR else 400
        return jsonify({"error": result.error}), status
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
        status = {EXPIRED_ERROR: 410, SESSION_FULL_ERROR: 409}.get(result.error, 400)
        return jsonify({"error": result.error}), status
    session, asset = result.value
    response = jsonify({
        "session": session,
        "asset": asset.asset_id,
        "width": asset.width,
        "height": asset.height,
    })
    response.headers["Cache-Control"] = "no-store"
    return response


@api_blueprint.route("/crop/bitmap", methods=["POST"])
def crop_bitmap():
    result = crop_bitmap_request_service.build(request.files)
    if not result.is_successful:
        return jsonify({"error": result.error}), result.status_code

    response = send_file(result.value, mimetype="image/png")
    if result.source_size:
        response.headers["X-Image-Width"] = str(result.source_size[0])
        response.headers["X-Image-Height"] = str(result.source_size[1])
    return response


@api_blueprint.route("/logs/backend", methods=["GET"])
def backend_logs():
    if not storage_management_service.is_storage_management_enabled():
        return _storage_management_disabled_response()

    document = backend_diagnostics_service.build_log_document()
    response = Response(document.body, mimetype=document.mimetype)
    response.headers["Content-Disposition"] = (
        f'attachment; filename="{document.filename}"'
    )
    return response
