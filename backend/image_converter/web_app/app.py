import os
import time
import shutil
import tempfile
from typing import List, Optional

from flask import Flask, request, jsonify, send_from_directory, abort
from werkzeug.utils import secure_filename
from werkzeug.exceptions import RequestEntityTooLarge, HTTPException

from apscheduler.schedulers.background import BackgroundScheduler

from backend.image_converter.core.processor import ImageConversionProcessor
from backend.image_converter.core.args_namespace import ArgsNamespace
from backend.image_converter.infrastructure.logger import Logger

app_logger = Logger(debug=False, json_output=False)

# Set static_url_path to "/static" so API endpoints aren't masked.
app = Flask(__name__, static_folder='static_site', static_url_path='/static')
app.config['MAX_FORM_MEMORY_SIZE'] = None

# Configuration Constants
TEMP_DIR = tempfile.gettempdir()
EXPIRATION_TIME = 3600  # 1 hour in seconds
ALLOWED_EXTENSIONS = {
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp',
    'heic', 'heif', 'svg', 'ico', 'raw', 'cr2', 'nef', 'arw',
    'dng', 'orf', 'rw2', 'sr2', 'apng', 'jp2', 'j2k', 'jpf',
    'jpx', 'jpm', 'mj2', 'psd', 'pdf', 'emf', 'exr', 'avif'
}

if not os.path.exists(TEMP_DIR):
    os.makedirs(TEMP_DIR)

# ----------------------------
# ERROR HANDLERS
# ----------------------------
@app.errorhandler(RequestEntityTooLarge)
def handle_request_entity_too_large(e):
    app_logger.log("Payload Too Large: exceeded.", level="warning")
    return jsonify({
        "error": "Payload Too Large",
        "message": "The uploaded files exceed the maximum allowed size."
    }), 413

@app.errorhandler(HTTPException)
def handle_http_exception(e):
    app_logger.log(f"HTTP Exception: {e}", level="warning")
    response = e.get_response()
    response.data = jsonify({
        "error": e.name,
        "description": e.description,
        "code": e.code
    }).data
    response.content_type = "application/json"
    return response, e.code

@app.errorhandler(Exception)
def handle_exception(e):
    app_logger.log(f"Unhandled Exception: {e}", level="error")
    return jsonify({
        "error": "Internal Server Error",
        "message": "An unexpected error occurred. Please try again later."
    }), 500

# ----------------------------
# HELPER FUNCTIONS
# ----------------------------
def is_file_allowed(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def _parse_quality(quality_str: str) -> int:
    try:
        quality = int(quality_str)
        if not (1 <= quality <= 100):
            raise ValueError
        return quality
    except ValueError:
        app_logger.log(f"Invalid quality value: {quality_str}. Using default 85.", level="warning")
        return 85

def _parse_width(width_str: str) -> Optional[int]:
    if width_str.strip():
        try:
            width = int(width_str)
            if width <= 0:
                raise ValueError
            return width
        except ValueError:
            app_logger.log(f"Invalid width value: {width_str}. Width will not be set.", level="warning")
            return None
    return None

def extract_form_data(request) -> dict:
    uploaded_files = request.files.getlist("files[]")
    quality = _parse_quality(request.form.get("quality", "85"))
    width = _parse_width(request.form.get("width", ""))
    output_format = request.form.get("format", "jpeg").lower()
    if output_format not in ("jpeg", "png"):
        app_logger.log(f"Invalid format '{output_format}' provided. Falling back to 'jpeg'.", level="warning")
        output_format = "jpeg"

    allowed_files = [f for f in uploaded_files if is_file_allowed(f.filename)]
    if len(allowed_files) != len(uploaded_files):
        app_logger.log("Some files were rejected due to unsupported file types.", level="warning")
    
    return {
        "uploaded_files": allowed_files,
        "quality": quality,
        "width": width,
        "format": output_format
    }

def save_uploaded_files(uploaded_files: List, source_folder: str):
    for file in uploaded_files:
        filename = secure_filename(file.filename)
        file_path = os.path.join(source_folder, filename)
        try:
            with open(file_path, 'wb') as f:
                while True:
                    chunk = file.stream.read(8192)
                    if not chunk:
                        break
                    f.write(chunk)
            app_logger.log(f"Saved file: {file_path}", level="info")
        except Exception as e:
            app_logger.log(f"Failed to save file {filename}: {e}", level="error")
            raise

def process_images(source_folder: str, dest_folder: str, quality: int, width: Optional[int], output_format: str):
    width_msg = f"with width={width}" if width is not None else "without width resizing"
    app_logger.log(f"Processing images from {source_folder} to {dest_folder} with quality={quality} {width_msg} and format={output_format}", level="info")
    
    args = ArgsNamespace(
        source=source_folder,
        destination=dest_folder,
        quality=quality,
        width=width,
        format=output_format,
        debug=False,
        json_output=True
    )
    processor = ImageConversionProcessor(args)
    processor.run()
    app_logger.log(f"Processed images from {source_folder} to {dest_folder}", level="info")

def cleanup_temp_folders(force: bool = False):
    """
    Delete temp subfolders that are older than EXPIRATION_TIME.
    If force is True, delete ALL folders (that follow our naming conventions),
    except for ZIP files.
    """
    current_time = time.time()
    for folder in os.listdir(TEMP_DIR):
        folder_path = os.path.join(TEMP_DIR, folder)
        
        # Skip if this is a file and it's a ZIP file.
        if os.path.isfile(folder_path) and folder.endswith(".zip"):
            continue
        
        # Optionally only cleanup folders we created (starting with "source_" or "converted_")
        if os.path.isdir(folder_path) and (folder.startswith("source_") or folder.startswith("converted_")):
            try:
                creation_time = os.path.getctime(folder_path)
                if force or (current_time - creation_time > EXPIRATION_TIME):
                    shutil.rmtree(folder_path, ignore_errors=True)
                    app_logger.log(f"Deleted temp folder: {folder_path}", level="info")
            except Exception as e:
                app_logger.log(f"Error deleting folder {folder_path}: {e}", level="error")


def get_container_files() -> dict:
    """
    Scan TEMP_DIR for folders we created (starting with "converted_")
    and also for ZIP files (named like "converted_*.zip") and return a list
    of files with sizes (in MB) and overall totals.
    """
    files_list = []
    total_size = 0
    total_count = 0

    app_logger.log(f"Scanning TEMP_DIR: {TEMP_DIR}", level="info")
    
    # Scan directories (non-ZIP files)
    for folder in os.listdir(TEMP_DIR):
        folder_path = os.path.join(TEMP_DIR, folder)
        if os.path.isdir(folder_path) and folder.startswith("converted_"):
            app_logger.log(f"Found converted folder: {folder}", level="info")
            for fname in os.listdir(folder_path):
                file_path = os.path.join(folder_path, fname)
                if os.path.isfile(file_path):
                    size_bytes = os.path.getsize(file_path)
                    size_mb = round(size_bytes / (1024 * 1024), 2)
                    files_list.append({
                        "folder": folder,
                        "filename": fname,
                        "size_mb": size_mb
                    })
                    total_size += size_mb
                    total_count += 1

    # Scan for ZIP files directly in TEMP_DIR
    for fname in os.listdir(TEMP_DIR):
        if fname.startswith("converted_") and fname.endswith(".zip"):
            file_path = os.path.join(TEMP_DIR, fname)
            if os.path.isfile(file_path):
                app_logger.log(f"Found ZIP file: {fname}", level="info")
                size_bytes = os.path.getsize(file_path)
                size_mb = round(size_bytes / (1024 * 1024), 2)
                files_list.append({
                    "folder": "zip",  # Label these as ZIP files
                    "filename": fname,
                    "size_mb": size_mb
                })
                total_size += size_mb
                total_count += 1

    app_logger.log(f"Total files found: {total_count}, total size: {total_size} MB", level="info")
    return {"files": files_list, "total_size_mb": round(total_size, 2), "total_count": total_count}


# ----------------------------
# API ENDPOINTS
# ----------------------------
@app.route("/api/compress", methods=["POST"])
def compress_images():
    cleanup_temp_folders()
    data = extract_form_data(request)
    uploaded_files = data["uploaded_files"]
    quality = data["quality"]
    width = data["width"]
    output_format = data["format"]

    if not uploaded_files:
        return jsonify({
            "error": "No valid files uploaded. Please upload files with allowed extensions."
        }), 400

    # Create unique temporary directories for source and destination
    source_folder = tempfile.mkdtemp(prefix="source_")
    dest_folder = tempfile.mkdtemp(prefix="converted_")

    try:
        save_uploaded_files(uploaded_files, source_folder)
        process_images(source_folder, dest_folder, quality, width, output_format)
        converted_files = os.listdir(dest_folder)
        if not converted_files:
            raise ValueError("No files were converted. Please check the uploaded files.")
    except Exception as e:
        app_logger.log(f"Error during image processing: {e}", level="error")
        return jsonify({
            "error": "Processing failed",
            "message": str(e)
        }), 500
    finally:
        shutil.rmtree(source_folder, ignore_errors=True)
        app_logger.log(f"Deleted source folder: {source_folder}", level="info")

    return jsonify({
        "status": "ok",
        "converted_files": converted_files,
        "dest_folder": dest_folder
    }), 200

@app.route("/api/download", methods=["GET"])
def download_file():
    cleanup_temp_folders()

    folder = request.args.get("folder")
    filename = request.args.get("file")
    if not folder or not filename:
        return jsonify({
            "error": "Folder and file parameters are required."
        }), 400

    folder_abs = os.path.abspath(folder)
    if not folder_abs.startswith(TEMP_DIR):
        return jsonify({
            "error": "Invalid folder path."
        }), 400

    file_path = os.path.join(folder_abs, filename)
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({
            "error": "File does not exist."
        }), 404

    return send_from_directory(folder_abs, filename, as_attachment=True)

@app.route("/api/download_all", methods=["GET"])
def download_all():
    cleanup_temp_folders()

    folder = request.args.get("folder")
    if not folder or not os.path.isdir(folder):
        return jsonify({
            "error": "Invalid folder."
        }), 400

    try:
        timestamp = int(time.time())
        zip_filename = f"converted_{timestamp}.zip"
        zip_path = os.path.join(TEMP_DIR, zip_filename)
        shutil.make_archive(zip_path[:-4], 'zip', root_dir=folder)
        app_logger.log(f"Created ZIP archive: {zip_path}", level="info")

        return send_from_directory(TEMP_DIR, zip_filename, as_attachment=True, mimetype='application/zip')
    except Exception as e:
        app_logger.log(f"Error creating ZIP archive: {e}", level="error")
        return jsonify({
            "error": "Failed to create ZIP archive.",
            "message": str(e)
        }), 500

@app.route("/api/storage_info", methods=["GET"])
def storage_info():
    # Use the root ("/") for disk usage; adjust if needed.
    total, used, free = shutil.disk_usage("/")
    # Convert bytes to MB
    total_mb = round(total / (1024 * 1024), 2)
    used_mb = round(used / (1024 * 1024), 2)
    free_mb = round(free / (1024 * 1024), 2)
    return jsonify({
        "total_storage_mb": total_mb,
        "used_storage_mb": used_mb,
        "available_storage_mb": free_mb
    }), 200

@app.route("/api/force_cleanup", methods=["POST"])
def force_cleanup():
    try:
        cleanup_temp_folders(force=True)
        return jsonify({"status": "ok", "message": "Forced cleanup completed."}), 200
    except Exception as e:
        return jsonify({"error": "Cleanup failed", "message": str(e)}), 500

@app.route("/api/container_files", methods=["GET"])
def container_files():
    data = get_container_files()
    return jsonify(data), 200

# ----------------------------
# STATIC FILE SERVING
# ----------------------------
def serve_static_file(filename: str):
    try:
        return send_from_directory(app.static_folder, filename)
    except Exception as e:
        app_logger.log(f"Error serving static file {filename}: {e}", level="error")
        return jsonify({
            "error": "File Not Found",
            "message": f"The requested file {filename} was not found on the server."
        }), 404

@app.errorhandler(404)
def not_found(error):
    # If a route is not found, serve index.html.
    return serve_static_file("index.html")

@app.route("/")
def serve_index():
    return serve_static_file("index.html")

@app.route("/_next/static/<path:path>")
def serve_next_static(path):
    return send_from_directory(os.path.join(app.static_folder, "_next/static"), path)

@app.route("/<path:path>")
def serve_out_files(path):
    # Avoid intercepting API calls.
    if path.startswith("api/"):
        abort(404)
    
    full_path = os.path.join(app.static_folder, path)
    if os.path.exists(full_path) and os.path.isfile(full_path):
        return send_from_directory(app.static_folder, path)
    
    return serve_static_file("index.html")

# ----------------------------
# SCHEDULER SETUP
# ----------------------------
def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(func=cleanup_temp_folders, trigger="interval", seconds=EXPIRATION_TIME)
    scheduler.start()
    app_logger.log("Scheduler started for periodic temp folder cleanup.", level="info")

if __name__ == "__main__":
    start_scheduler()  # Start the APScheduler background job
    app_logger.log("Starting Flask server...", level="info")
    app.run(host="0.0.0.0", port=6000, debug=False)
