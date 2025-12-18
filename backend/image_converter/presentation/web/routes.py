from datetime import datetime, timezone
import os
import time
import shutil
import tempfile
import traceback
from typing import Optional

from flask import Blueprint, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename

from backend.image_converter.core.internals.utls import Result, supported_extensions,  has_internet
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.infrastructure.cleanup_service import CleanupService
from backend.image_converter.domain.image_resizer import ImageResizer
from backend.image_converter.core.factory.converter_factory import ImageConverterFactory
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.presentation.web.parse_services import extract_form_data

from backend.image_converter.application.compress_images_usecase import CompressImagesUseCase
from backend.image_converter.application.dtos import CompressRequest
from backend.image_converter.domain.units import TargetSize, to_bytes
from backend.image_converter.infrastructure.local_storage import LocalStorage
from backend.image_converter.application.payload_expander_factory import create_payload_expander

api_blueprint = Blueprint("api", __name__)

TEMP_DIR = tempfile.gettempdir()
EXPIRATION_TIME = 3600
logger = Logger(debug=False, json_output=False)
cleanup_service = CleanupService(TEMP_DIR, EXPIRATION_TIME, logger)
resizer = ImageResizer()
storage = LocalStorage()
payload_expander = create_payload_expander(logger)
use_case = CompressImagesUseCase(logger, resizer, ImageConverterFactory, storage, payload_expander)


def _storage_management_enabled() -> bool:
    return os.environ.get("DISABLE_STORAGE_MANAGEMENT", "false").lower() != "true"


def _storage_management_disabled_response():
    return jsonify({"error": "Storage management endpoints are disabled in this mode."}), 403


def _save_uploaded_files(files, folder: str) -> Result[None]:
    try:
        os.makedirs(folder, exist_ok=True)
        for file in files:
            name = secure_filename(file.filename or "upload")
            if not name:
                continue
            path = os.path.join(folder, name)
            with open(path, "wb") as f:
                while True:
                    chunk = file.stream.read(8192)
                    if not chunk:
                        break
                    f.write(chunk)
            logger.log(f"Saved file: {path}", "info")
        return Result.success(None)
    except Exception:
        tb = traceback.format_exc()
        logger.log(f"Failed saving upload: {tb}", "error")
        return Result.failure(tb)


def _in_temp(path: str) -> bool:
    return os.path.abspath(path).startswith(os.path.abspath(TEMP_DIR))


@api_blueprint.route("/compress", methods=["POST"])
def compress_images():
    cleanup_service.cleanup_temp_folders()

    dataResult = extract_form_data(request, logger)
    if dataResult.is_successful == False:
         return jsonify({"error": str(dataResult.error)}), 400
   
    data = dataResult.value
    files = data["uploaded_files"]
    if not files:
        return jsonify({"error": "No valid files uploaded."}), 400

    fmt_res = ImageFormat.from_string_result(data["format"])
    if not fmt_res.is_successful:
        return jsonify({"error": fmt_res.error}), 400
    fmt = fmt_res.value

    src = tempfile.mkdtemp(prefix="source_")
    dst = tempfile.mkdtemp(prefix="converted_")

    save_res = _save_uploaded_files(files, src)
    if not save_res.is_successful:
        shutil.rmtree(src, ignore_errors=True)
        return jsonify({"error": "Failed to save uploaded files", "message": save_res.error}), 500

    target: Optional[TargetSize] = None
    if data.get("target_size_kb"):
        target = TargetSize(bytes=to_bytes(float(data["target_size_kb"]), unit="KB", system="IEC"))

    req = CompressRequest(
        source_folder=src,
        dest_folder=dst,
        image_format=fmt,
        quality=data["quality"],
        width=data["width"],
        target_size=target,
    )

    result = use_case.execute(req)

    shutil.rmtree(src, ignore_errors=True)

    if not result.processed_files:
        return jsonify({"error": "Image processing failed", "message": "; ".join(result.errors)}), 500

    converted = [f for f in os.listdir(dst) if os.path.isfile(os.path.join(dst, f))]
    if not converted:
        return jsonify({"error": "No files were converted"}), 500

    return jsonify({
        "status": "ok",
        "converted_files": converted,
        "dest_folder": dst,
        "process_summary": result.to_summary(),
    }), 200


@api_blueprint.route("/download", methods=["GET"])
def download_file():
    cleanup_service.cleanup_temp_folders()

    folder = request.args.get("folder")
    filename = request.args.get("file")
    if not folder or not filename:
        return jsonify({"error": "Folder and file params required"}), 400

    if not _in_temp(folder):
        return jsonify({"error": "Invalid folder path."}), 400

    path = os.path.join(folder, filename)
    if not (os.path.exists(path) and os.path.isfile(path)):
        return jsonify({"error": "File does not exist."}), 404

    return send_from_directory(folder, filename, as_attachment=True)


@api_blueprint.route("/download_all", methods=["GET"])
def download_all():
    cleanup_service.cleanup_temp_folders()

    folder = request.args.get("folder")
    if not folder or not _in_temp(folder) or not os.path.isdir(folder):
        return jsonify({"error": "Invalid folder."}), 400

    try:
        zip_name = f"converted_{int(time.time())}.zip"
        zip_path = os.path.join(TEMP_DIR, zip_name)
        shutil.make_archive(zip_path[:-4], "zip", root_dir=folder)
        return send_from_directory(TEMP_DIR, zip_name, as_attachment=True, mimetype="application/zip")
    except Exception as e:
        logger.log(f"ZIP error: {e}", "error")
        return jsonify({"error": "Failed to create ZIP archive.", "message": str(e)}), 500


@api_blueprint.route("/storage_info", methods=["GET"])
def storage_info():
    if not _storage_management_enabled():
        return _storage_management_disabled_response()

    total, used, free = shutil.disk_usage("/")
    mib = 1024 * 1024
    return jsonify({
        "total_storage_mb": round(total / mib, 2),
        "used_storage_mb": round(used / mib, 2),
        "available_storage_mb": round(free / mib, 2),
    }), 200


@api_blueprint.route("/force_cleanup", methods=["POST"])
def force_cleanup():
    if not _storage_management_enabled():
        return _storage_management_disabled_response()

    res = cleanup_service.cleanup_temp_folders(force=True)
    if not res.is_successful:
        return jsonify({"error": "Forced cleanup failed", "message": res.error}), 500
    return jsonify({"status": "ok", "message": "Forced cleanup completed."}), 200


@api_blueprint.route("/container_files", methods=["GET"])
def container_files():
    if not _storage_management_enabled():
        return _storage_management_disabled_response()

    return jsonify(cleanup_service.get_container_files()), 200

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
    return jsonify({"supported_formats": supported_extensions}), 200


@api_blueprint.route("/images_verified", methods=["GET"])
def verified_image_formats():
    """Return the list of test-verified image extensions.

    This is a subset of /images_supported that is covered by tests.
    """
    verified = [
        ".heic",
        ".heif",
        ".png",
        ".jpg",
        ".jpeg",
        ".ico",
        ".eps",
        ".psd",
        ".pdf"
    ]
    return jsonify({"verified_formats": verified}), 200
