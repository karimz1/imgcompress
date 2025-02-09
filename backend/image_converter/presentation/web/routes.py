from datetime import datetime
import os
import time
import shutil
import tempfile
from typing import Optional
from flask import Blueprint, request, jsonify, send_from_directory, abort
from werkzeug.utils import secure_filename
from datetime import datetime,timezone

from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.infrastructure.cleanup_service import CleanupService
from backend.image_converter.domain.image_resizer import ImageResizer

from backend.image_converter.core.factory.converter_factory import ImageConverterFactory
from backend.image_converter.core.enums.image_format import ImageFormat

from backend.image_converter.presentation.web.parse_services import (
    extract_form_data,
    ALLOWED_EXTENSIONS
)

api_blueprint = Blueprint("api", __name__)

TEMP_DIR = tempfile.gettempdir()
EXPIRATION_TIME = 3600
logger = Logger(debug=False, json_output=False)
cleanup_service = CleanupService(TEMP_DIR, EXPIRATION_TIME, logger)
resizer = ImageResizer()

@api_blueprint.route("/compress", methods=["POST"])
def compress_images():
    """
    1) Clean old temp folders
    2) Extract form data 
    3) Convert images
    4) Return JSON response
    """
    cleanup_service.cleanup_temp_folders()
    data = extract_form_data(request, logger)
    uploaded_files = data["uploaded_files"]
    quality = data["quality"]
    width = data["width"]
    output_format_str = data["format"]  # "jpeg" or "png" from form

    if not uploaded_files:
        return jsonify({"error": "No valid files uploaded."}), 400

    # Derive the enum
    image_format = ImageFormat.from_string(output_format_str)
    source_folder = tempfile.mkdtemp(prefix="source_")
    dest_folder = tempfile.mkdtemp(prefix="converted_")

    try:
        _save_uploaded_files(uploaded_files, source_folder)
        _process_images(source_folder, dest_folder, image_format, quality, width)
        converted_files = os.listdir(dest_folder)
        if not converted_files:
            raise ValueError("No files were converted.")
    except Exception as e:
        logger.log(f"Error during image processing: {e}", "error")
        return jsonify({"error": "Processing failed", "message": str(e)}), 500
    finally:
        shutil.rmtree(source_folder, ignore_errors=True)
        logger.log(f"Deleted source folder: {source_folder}", "info")

    return jsonify({
        "status": "ok",
        "converted_files": converted_files,
        "dest_folder": dest_folder
    }), 200

@api_blueprint.route("/download", methods=["GET"])
def download_file():
    cleanup_service.cleanup_temp_folders()

    folder = request.args.get("folder")
    filename = request.args.get("file")
    if not folder or not filename:
        return jsonify({"error": "Folder and file params required"}), 400

    folder_abs = os.path.abspath(folder)
    if not folder_abs.startswith(TEMP_DIR):
        return jsonify({"error": "Invalid folder path."}), 400

    file_path = os.path.join(folder_abs, filename)
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({"error": "File does not exist."}), 404

    return send_from_directory(folder_abs, filename, as_attachment=True)

@api_blueprint.route("/download_all", methods=["GET"])
def download_all():
    cleanup_service.cleanup_temp_folders()

    folder = request.args.get("folder")
    if not folder or not os.path.isdir(folder):
        return jsonify({"error": "Invalid folder."}), 400

    try:
        timestamp = int(time.time())
        zip_filename = f"converted_{timestamp}.zip"
        zip_path = os.path.join(TEMP_DIR, zip_filename)
        shutil.make_archive(zip_path[:-4], 'zip', root_dir=folder)
        logger.log(f"Created ZIP archive: {zip_path}", "info")

        return send_from_directory(TEMP_DIR, zip_filename, as_attachment=True, mimetype='application/zip')
    except Exception as e:
        logger.log(f"Error creating ZIP archive: {e}", "error")
        return jsonify({"error": "Failed to create ZIP archive.", "message": str(e)}), 500

@api_blueprint.route("/storage_info", methods=["GET"])
def storage_info():
    total, used, free = shutil.disk_usage("/")
    total_mb = round(total / (1024 * 1024), 2)
    used_mb = round(used / (1024 * 1024), 2)
    free_mb = round(free / (1024 * 1024), 2)
    return jsonify({
        "total_storage_mb": total_mb,
        "used_storage_mb": used_mb,
        "available_storage_mb": free_mb
    }), 200

@api_blueprint.route("/force_cleanup", methods=["POST"])
def force_cleanup():
    try:
        cleanup_service.cleanup_temp_folders(force=True)
        return jsonify({"status": "ok", "message": "Forced cleanup completed."}), 200
    except Exception as e:
        return jsonify({"error": "Cleanup failed", "message": str(e)}), 500

@api_blueprint.route("/container_files", methods=["GET"])
def container_files():
    data = cleanup_service.get_container_files()
    return jsonify(data), 200

@api_blueprint.route("/health/live", methods=["GET"])
def health_live():
    now_utc = datetime.now(timezone.utc)
    response = {
        "status": "live",
        "UTC_Time": now_utc
    }
    return jsonify(response), 200

# ----------------------------
# INTERNAL HELPERS
# ----------------------------

def _save_uploaded_files(uploaded_files, source_folder: str):
    """
    Save the user's uploaded files to disk.
    """
    for file in uploaded_files:
        filename = secure_filename(file.filename)
        file_path = os.path.join(source_folder, filename)
        try:
            with open(file_path, "wb") as f:
                while True:
                    chunk = file.stream.read(8192)
                    if not chunk:
                        break
                    f.write(chunk)
            logger.log(f"Saved file: {file_path}", "info")
        except Exception as e:
            logger.log(f"Failed to save file {filename}: {e}", "error")
            raise

def _process_images(source_folder: str, 
                    dest_folder: str,
                    image_format: ImageFormat, 
                    quality: int, 
                    width: Optional[int]) -> None:
    """
    For each file in 'source_folder':
      1) Read bytes
      2) Optionally resize
      3) Use 'ImageConverterFactory' to create a converter
      4) Convert & save final file
    """
    logger.log(
        f"Processing images {source_folder} -> {dest_folder} (format={image_format.value}, quality={quality}, width={width})",
        "info"
    )

    converter = ImageConverterFactory.create_converter(image_format, quality, logger)
    new_ext = image_format.get_file_extension()

    for filename in os.listdir(source_folder):
        src_file_path = os.path.join(source_folder, filename)
        if not os.path.isfile(src_file_path):
            continue

        with open(src_file_path, "rb") as f:
            original_data = f.read()

        # 1) Maybe resize
        if width and width > 0:
            resized_data = resizer.resize_image(original_data, width)
        else:
            resized_data = original_data

        # 2) Final path
        base, _ext = os.path.splitext(filename)
        dest_path = os.path.join(dest_folder, base + new_ext)

        # 3) Convert using the factory-chosen converter
        try:
            result = converter.convert(
                image_data=resized_data,
                source_path=src_file_path,
                dest_path=dest_path
            )
            if not result["is_successful"]:
                logger.log(f"Conversion failed for {filename}: {result['error']}", "error")
        except Exception as e:
            logger.log(f"Error converting {filename}: {e}", "error")
            raise

    logger.log(f"Processed images from {source_folder} to {dest_folder}", "info")
    
