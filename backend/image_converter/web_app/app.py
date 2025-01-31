import os
import time
import shutil
import tempfile
import logging
from flask import Flask, request, jsonify, send_from_directory, abort
from werkzeug.utils import secure_filename
from werkzeug.exceptions import RequestEntityTooLarge, HTTPException
from backend.image_converter.core.processor import ImageConversionProcessor
from backend.image_converter.core.args_namespace import ArgsNamespace
from typing import List

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='static_site', static_url_path='/')

app.config['MAX_FORM_MEMORY_SIZE'] = None

# Configuration Constants
TEMP_DIR = tempfile.gettempdir()
EXPIRATION_TIME = 3600  # 1 hour in seconds
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# Ensure TEMP_DIR exists
if not os.path.exists(TEMP_DIR):
    os.makedirs(TEMP_DIR)

# Error Handler for Payload Too Large
@app.errorhandler(RequestEntityTooLarge)
def handle_request_entity_too_large(e):
    logger.warning(f"Payload Too Large: exceeded.")
    return jsonify({
        "error": "Payload Too Large",
        "message": f"The uploaded files exceed the maximum allowed size."
    }), 413



# Global Error Handler for HTTP Exceptions
@app.errorhandler(HTTPException)
def handle_http_exception(e):
    logger.warning(f"HTTP Exception: {e}")
    response = e.get_response()
    response.data = jsonify({
        "error": e.name,
        "description": e.description,
        "code": e.code
    }).data
    response.content_type = "application/json"
    return response, e.code


# Global Error Handler for Unhandled Exceptions
@app.errorhandler(Exception)
def handle_exception(e):
    logger.error(f"Unhandled Exception: {e}", exc_info=True)
    return jsonify({
        "error": "Internal Server Error",
        "message": "An unexpected error occurred. Please try again later."
    }), 500


# Global Error Handler for Unhandled Exceptions
@app.errorhandler(Exception)
def handle_exception(e):
    logger.error(f"Unhandled Exception: {e}", exc_info=True)
    return jsonify({
        "error": "Internal Server Error",
        "message": "An unexpected error occurred. Please try again later."
    }), 500

def serve_static_file(filename: str):
    """
    Serve the static React frontend.
    All non-API routes will return the React app's index.html.
    """
    try:
        return send_from_directory(app.static_folder, filename)
    except Exception as e:
        logger.error(f"Error serving static file {filename}: {e}")
        return jsonify({
            "error": "File Not Found",
            "message": f"The requested file {filename} was not found on the server."
        }), 404

@app.route("/")
def serve_index():
    return serve_static_file("index.html")

@app.route("/_next/static/<path:path>")
def serve_next_static(path):
    return send_from_directory(os.path.join(app.static_folder, "_next/static"), path)

@app.route("/<path:path>")
def serve_out_files(path):
    """
    Serve any static files or fallback to index.html for SPA routing.
    """
    if path.startswith("api/"):
        abort(404)
    
    full_path = os.path.join(app.static_folder, path)
    if os.path.exists(full_path) and os.path.isfile(full_path):
        return send_from_directory(app.static_folder, path)
    return serve_static_file("index.html")

def is_file_allowed(filename: str) -> bool:
    """
    Check if the file has an allowed extension.
    """
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_form_data(request) -> dict:
    """
    Extract and validate form data from the request.
    """
    uploaded_files = request.files.getlist("files[]")
    quality_str = request.form.get("quality", "85")
    width_str = request.form.get("width", "")

    # Validate quality
    try:
        quality = int(quality_str)
        if not (1 <= quality <= 100):
            raise ValueError("Quality must be between 1 and 100.")
    except ValueError as ve:
        logger.warning(f"Invalid quality value: {quality_str}. Using default 85.")
        quality = 85  # Default quality

    # Validate width
    width = None
    if width_str.strip():
        try:
            width = int(width_str)
            if width <= 0:
                raise ValueError("Width must be a positive integer.")
        except ValueError as ve:
            logger.warning(f"Invalid width value: {width_str}. Width will not be set.")
            width = None

    # Filter allowed files
    allowed_files = [f for f in uploaded_files if is_file_allowed(f.filename)]
    if len(allowed_files) != len(uploaded_files):
        logger.warning("Some files were rejected due to unsupported file types.")

    return {
        "uploaded_files": allowed_files,
        "quality": quality,
        "width": width
    }

def save_uploaded_files(uploaded_files: List, source_folder: str):
    """
    Save uploaded files to the source folder using streaming to handle large files.
    """
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
            logger.info(f"Saved file: {file_path}")
        except Exception as e:
            logger.error(f"Failed to save file {filename}: {e}")
            raise

def process_images(source_folder: str, dest_folder: str, quality: int, width: int):
    """
    Process images using the ImageConversionProcessor.
    """
    args = ArgsNamespace(
        source=source_folder,
        destination=dest_folder,
        quality=quality,
        width=width,
        debug=False,
        json_output=True
    )
    processor = ImageConversionProcessor(args)
    processor.run()
    logger.info(f"Processed images from {source_folder} to {dest_folder}")

def cleanup_temp_folders():
    """
    Delete temporary folders older than EXPIRATION_TIME.
    """
    current_time = time.time()
    for folder in os.listdir(TEMP_DIR):
        folder_path = os.path.join(TEMP_DIR, folder)
        if os.path.isdir(folder_path):
            try:
                creation_time = os.path.getctime(folder_path)
                folder_age = current_time - creation_time
                if folder_age > EXPIRATION_TIME:
                    shutil.rmtree(folder_path, ignore_errors=True)
                    logger.info(f"Deleted old temp folder: {folder_path}")
            except Exception as e:
                logger.error(f"Error deleting folder {folder_path}: {e}")

@app.route("/api/compress", methods=["POST"])
def compress_images():
    """
    Endpoint to handle image compression.
    """
    cleanup_temp_folders()

    data = extract_form_data(request)
    uploaded_files = data["uploaded_files"]
    quality = data["quality"]
    width = data["width"]

    if not uploaded_files:
        return jsonify({
            "error": "No valid files uploaded. Please upload PNG, JPG, JPEG, or GIF files."
        }), 400

    # Create unique temporary directories for source and destination
    source_folder = tempfile.mkdtemp(prefix="source_")
    dest_folder = tempfile.mkdtemp(prefix="converted_")

    try:
        # Save uploaded files using streaming
        save_uploaded_files(uploaded_files, source_folder)

        # Process images
        process_images(source_folder, dest_folder, quality, width)

        # List converted files
        converted_files = os.listdir(dest_folder)
        if not converted_files:
            raise ValueError("No files were converted. Please check the uploaded files.")

    except Exception as e:
        logger.error(f"Error during image processing: {e}")
        return jsonify({
            "error": "Processing failed",
            "message": str(e)
        }), 500
    finally:
        # Clean up source folder after processing
        shutil.rmtree(source_folder, ignore_errors=True)
        logger.info(f"Deleted source folder: {source_folder}")

    return jsonify({
        "status": "ok",
        "converted_files": converted_files,
        "dest_folder": dest_folder
    }), 200

@app.route("/api/download", methods=["GET"])
def download_file():
    """
    Endpoint to download a single compressed file.
    """
    cleanup_temp_folders()

    folder = request.args.get("folder")
    filename = request.args.get("file")

    if not folder or not filename:
        return jsonify({
            "error": "Folder and file parameters are required."
        }), 400

    # Security check to prevent directory traversal
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
    """
    Endpoint to download all compressed files as a ZIP archive.
    """
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
        logger.info(f"Created ZIP archive: {zip_path}")

        return send_from_directory(TEMP_DIR, zip_filename, as_attachment=True, mimetype='application/zip')
    except Exception as e:
        logger.error(f"Error creating ZIP archive: {e}")
        return jsonify({
            "error": "Failed to create ZIP archive.",
            "message": str(e)
        }), 500

# Override default 404 to serve index.html for SPA routing
@app.errorhandler(404)
def not_found(error):
    return serve_static_file("index.html")

if __name__ == "__main__":
    logger.info("Starting Flask server...")
    app.run(host="0.0.0.0", port=5000, debug=True)
