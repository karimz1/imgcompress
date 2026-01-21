import os
import shutil
import tempfile
import time
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, send_from_directory

from backend.image_converter.application.compress_images_usecase import CompressImagesUseCase
from backend.image_converter.application.payload_expander_factory import create_payload_expander
from backend.image_converter.core.factory.converter_factory import ImageConverterFactory
from backend.image_converter.core.internals.utilities import has_internet
from backend.image_converter.domain.image_resizer import ImageResizer
from backend.image_converter.infrastructure.local_storage import LocalStorage
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.presentation.web.parse_services import extract_form_data
from backend.image_converter.presentation.web.services.compression_service import CompressionService
from backend.image_converter.presentation.web.services.configuration_service import ConfigurationService
from backend.image_converter.presentation.web.services.storage_management_service import StorageManagementService
from backend.image_converter.presentation.web.services.temporary_folder_service import TemporaryFolderService

api_blueprint = Blueprint("api", __name__)

TEMP_DIR = tempfile.gettempdir()
EXPIRATION_TIME = 3600
logger = Logger(debug=False, json_output=False)

# Core Logic
resizer = ImageResizer()
storage = LocalStorage()
payload_expander = create_payload_expander(logger)
use_case = CompressImagesUseCase(logger, resizer, ImageConverterFactory, storage, payload_expander)

# Web Services
temp_folder_service = TemporaryFolderService(TEMP_DIR, EXPIRATION_TIME, logger)
compression_service = CompressionService(logger, use_case, temp_folder_service)
storage_management_service = StorageManagementService()
configuration_service = ConfigurationService()


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

    return jsonify({
        "status": "ok",
        **result.value
    }), 200


@api_blueprint.route("/download", methods=["GET"])
def download_file():
    temp_folder_service.cleanup()

    folder = request.args.get("folder")
    filename = request.args.get("file")
    if not folder or not filename:
        return jsonify({"error": "Folder and file params required"}), 400

    if not temp_folder_service.is_in_temp(folder):
        return jsonify({"error": "Invalid folder path."}), 400

    path = os.path.join(folder, filename)
    if not (os.path.exists(path) and os.path.isfile(path)):
        return jsonify({"error": "File does not exist."}), 404

    return send_from_directory(folder, filename, as_attachment=True)


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

    return jsonify(storage_management_service.get_disk_usage()), 200


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

    return jsonify(temp_folder_service.get_container_files()), 200

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
