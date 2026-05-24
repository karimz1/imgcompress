from datetime import datetime, timezone

from flask import Blueprint, Response, request, jsonify, send_file, send_from_directory

from backend.image_converter.application.compress_images_usecase import CompressImagesUseCase
from backend.image_converter.application.payload_expander_factory import create_payload_expander
from backend.image_converter.config import settings
from backend.image_converter.core.factory.converter_factory import ImageConverterFactory
from backend.image_converter.core.internals.utilities import has_internet
from backend.image_converter.domain.image_resizer import ImageResizer
from backend.image_converter.infrastructure.local_storage import LocalStorage
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.presentation.web.parse_services import extract_form_data
from backend.image_converter.presentation.web.services.backend_diagnostics_service import BackendDiagnosticsService
from backend.image_converter.presentation.web.services.compression_service import CompressionService
from backend.image_converter.presentation.web.services.configuration_service import ConfigurationService
from backend.image_converter.presentation.web.services.crop_bitmap_request_service import CropBitmapRequestService
from backend.image_converter.presentation.web.services.crop_preview_service import CropPreviewService
from backend.image_converter.presentation.web.services.storage_management_service import StorageManagementService
from backend.image_converter.presentation.web.services.temporary_folder_service import TemporaryFolderService

_config = settings.get()

api_blueprint = Blueprint("api", __name__)

TEMP_DIR = _config.temporary_storage.directory
EXPIRATION_TIME = _config.temporary_storage.max_age_seconds
logger = Logger(debug=False, json_output=False)

resizer = ImageResizer()
storage = LocalStorage(logger=logger)
payload_expander = create_payload_expander(logger)
use_case = CompressImagesUseCase(logger, resizer, ImageConverterFactory, storage, payload_expander)

temp_folder_service = TemporaryFolderService(TEMP_DIR, EXPIRATION_TIME, logger)
compression_service = CompressionService(logger, use_case, temp_folder_service)
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


@api_blueprint.route("/download", methods=["GET"])
def download_file():
    temp_folder_service.cleanup()

    target = temp_folder_service.resolve_download_target(
        request.args.get("folder"),
        request.args.get("file"),
    )
    if target is None:
        return jsonify({"error": "File not available."}), 404

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
    return send_from_directory(TEMP_DIR, result.value, as_attachment=True, mimetype="application/zip")


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


@api_blueprint.route("/crop_unsupported_formats", methods=["GET"])
def crop_unsupported_formats():
    return jsonify({
        "unsupported_formats": crop_preview_service.get_unsupported_extensions()
    }), 200


@api_blueprint.route("/crop/bitmap", methods=["POST"])
def crop_bitmap():
    result = crop_bitmap_request_service.build(request.files)
    if not result.is_successful:
        return jsonify({"error": result.error}), result.status_code

    return send_file(result.value, mimetype="image/png")


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
