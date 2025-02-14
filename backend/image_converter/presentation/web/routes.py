from datetime import datetime, timezone
import os
import time
import shutil
import tempfile
import traceback
from typing import Optional
from flask import Blueprint, request, jsonify, send_from_directory, abort
from werkzeug.utils import secure_filename

from backend.image_converter.core.internals.utls import Result
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
    3) Save uploaded files
    4) Convert images using the result pattern
    5) Return JSON response
    """
    # Clean up old files
    cleanup_service.cleanup_temp_folders()
    
    # Extract data from the form
    data = extract_form_data(request, logger)
    uploaded_files = data["uploaded_files"]
    quality = data["quality"]
    width = data["width"]
    output_format_str = data["format"]

    if not uploaded_files:
        return jsonify({"error": "No valid files uploaded."}), 400

    # Convert string to ImageFormat enum using the result pattern
    format_result = ImageFormat.from_string_result(output_format_str)
    if not format_result.is_successful:
        logger.log(f"Invalid image format: {format_result.error}", "error")
        return jsonify({"error": format_result.error}), 400
    image_format = format_result.value

    # Create temporary source and destination folders
    source_folder = tempfile.mkdtemp(prefix="source_")
    dest_folder = tempfile.mkdtemp(prefix="converted_")

    # Save uploaded files using the result pattern.
    save_result = _save_uploaded_files(uploaded_files, source_folder)
    if not save_result.is_successful:
        logger.log(f"Error saving uploaded files: {save_result.error}", "error")
        shutil.rmtree(source_folder, ignore_errors=True)
        return jsonify({"error": "Failed to save uploaded files", "message": save_result.error}), 500

    # Process and convert images using the result pattern.
    process_result = _process_images(source_folder, dest_folder, image_format, quality, width)
    
    # Clean up the source folder regardless of processing outcome.
    shutil.rmtree(source_folder, ignore_errors=True)
    logger.log(f"Deleted source folder: {source_folder}", "info")

    if not process_result.is_successful:
        logger.log(f"Error processing images: {process_result.error}", "error")
        return jsonify({"error": "Image processing failed", "message": process_result.error}), 500

    # Gather list of converted files.
    converted_files = os.listdir(dest_folder)
    if not converted_files:
        logger.log("No files were converted", "error")
        return jsonify({"error": "No files were converted"}), 500

    return jsonify({
        "status": "ok",
        "converted_files": converted_files,
        "dest_folder": dest_folder,
        "process_summary": process_result.value
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
    force_result = cleanup_service.cleanup_temp_folders(force=True)
    if not force_result.is_successful:
        return jsonify({"error": "Forced cleanup failed", "message": force_result.error}), 500
    return jsonify({"status": "ok", "message": "Forced cleanup completed."}), 200

@api_blueprint.route("/container_files", methods=["GET"])
def container_files():
    data = cleanup_service.get_container_files()
    return jsonify(data), 200

@api_blueprint.route("/health/live", methods=["GET"])
def health_live():
    now_utc = datetime.now(timezone.utc)
    response = {
        "status": "live",
        "UTC_Time": now_utc.isoformat()
    }
    return jsonify(response), 200

# ----------------------------
# INTERNAL HELPERS
# ----------------------------

def _save_uploaded_files(uploaded_files, source_folder: str) -> Result[None]:
    """
    Save the user's uploaded files to disk.
    Returns a Result; on failure, the error includes the traceback.
    """
    try:
        for file in uploaded_files:
            filename = secure_filename(file.filename)
            file_path = os.path.join(source_folder, filename)
            with open(file_path, "wb") as f:
                while True:
                    chunk = file.stream.read(8192)
                    if not chunk:
                        break
                    f.write(chunk)
            logger.log(f"Saved file: {file_path}", "info")
        return Result.success(None)
    except Exception as e:
        tb = traceback.format_exc()
        logger.log(f"Failed to save file {filename}: {tb}", "error")
        return Result.failure(tb)

def _process_images(source_folder: str, 
                    dest_folder: str,
                    image_format: ImageFormat, 
                    quality: int, 
                    width: Optional[int]) -> Result:
    """
    For each file in 'source_folder':
      1) Read bytes
      2) Optionally resize
      3) Use ImageConverterFactory to convert and save the file
    Returns a Result that contains a summary of processed files and errors.
    """
    logger.log(
        f"Processing images from {source_folder} -> {dest_folder} (format={image_format.value}, quality={quality}, width={width})",
        "info"
    )

    converter = ImageConverterFactory.create_converter(image_format, quality, logger)
    new_ext = image_format.get_file_extension()

    conversion_errors = []
    processed_files = []

    for filename in os.listdir(source_folder):
        src_file_path = os.path.join(source_folder, filename)
        if not os.path.isfile(src_file_path):
            continue

        try:
            with open(src_file_path, "rb") as f:
                original_data = f.read()
        except Exception as e:
            error_msg = f"Failed to read file {filename}: {e}"
            logger.log(error_msg, "error")
            conversion_errors.append(error_msg)
            continue

        # Optionally resize the image if width is specified.
        if width and width > 0:
            try:
                resized_data = resizer.resize_image(original_data, width)
            except Exception as e:
                error_msg = f"Failed to resize {filename}: {e}"
                logger.log(error_msg, "error")
                conversion_errors.append(error_msg)
                continue
        else:
            resized_data = original_data

        base, _ = os.path.splitext(filename)
        dest_path = os.path.join(dest_folder, base + new_ext)

        conv_result: Result = converter.convert(
            image_data=resized_data,
            source_path=src_file_path,
            dest_path=dest_path
        )

        if not conv_result.is_successful:
            error_msg = f"Conversion failed for {filename}: {conv_result.error}"
            logger.log(error_msg, "error")
            conversion_errors.append(error_msg)
        else:
            processed_files.append(filename)

    if len(processed_files) == 0:
        return Result.failure("No files processed successfully. Errors: " + "; ".join(conversion_errors))
    else:
        logger.log(f"Processed {len(processed_files)} files successfully.", "info")
        summary = {"processed_files": processed_files, "errors": conversion_errors}
        return Result.success(summary)

