import os
import time
import shutil
import tempfile
from typing import List, Optional

from flask import Blueprint, request, jsonify, send_from_directory, abort
from werkzeug.utils import secure_filename

from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.infrastructure.cleanup_service import CleanupService
from backend.image_converter.domain.image_conversion_service import ImageConversionService
from backend.image_converter.domain.image_resizer import ImageResizer
from backend.image_converter.presentation.web.parse_services import (
    extract_form_data, 
    ALLOWED_EXTENSIONS  # if needed
)

api_blueprint = Blueprint("api", __name__)

TEMP_DIR = tempfile.gettempdir()
EXPIRATION_TIME = 3600
logger = Logger(debug=False, json_output=False)
cleanup_service = CleanupService(TEMP_DIR, EXPIRATION_TIME, logger)

resizer = ImageResizer()
conversion_service = ImageConversionService(resizer=resizer)

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
    output_format = data["format"]

    if not uploaded_files:
        return jsonify({"error": "No valid files uploaded."}), 400

    source_folder = tempfile.mkdtemp(prefix="source_")
    dest_folder = tempfile.mkdtemp(prefix="converted_")

    try:
        _save_uploaded_files(uploaded_files, source_folder)
        _process_images(source_folder, dest_folder, quality, width, output_format)
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


# ----------------------------
# INTERNAL HELPERS
# ----------------------------

def _save_uploaded_files(uploaded_files, source_folder: str):
    """
    save user upload to fileystem 
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

def _process_images(source_folder: str, dest_folder: str, quality: int, width: Optional[int], output_format: str):
    """
    uses the domain-level ImageConversionService to do real conversion.
    """
    logger.log(
        f"Processing images from {source_folder} -> {dest_folder} (quality={quality}, width={width}, format={output_format})",
        "info"
    )

    for filename in os.listdir(source_folder):
        src_file_path = os.path.join(source_folder, filename)
        if not os.path.isfile(src_file_path):
            continue

        # Read bytes
        with open(src_file_path, "rb") as f:
            original_data = f.read()

        # Convert via domain service
        try:
            converted_data = conversion_service.convert_image(
                image_data=original_data,
                output_format=output_format,
                quality=quality,
                width=width
            )
        except Exception as e:
            logger.log(f"Error converting {filename}: {e}", "error")
            raise

        # Save to destination with new extension if needed
        base, _ext = os.path.splitext(filename)
        new_ext = ".png" if output_format.lower() == "png" else ".jpg"
        new_name = base + new_ext
        dest_path = os.path.join(dest_folder, new_name)
        with open(dest_path, "wb") as f:
            f.write(converted_data)

    logger.log(f"Processed images from {source_folder} to {dest_folder}", "info")
