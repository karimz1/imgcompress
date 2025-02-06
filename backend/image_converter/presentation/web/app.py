import os
import tempfile
from flask import Flask,  send_from_directory, abort
from apscheduler.schedulers.background import BackgroundScheduler

from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.infrastructure.cleanup_service import CleanupService
from backend.image_converter.presentation.web.routes import api_blueprint
from backend.image_converter.presentation.web.error_handlers import (
    handle_request_entity_too_large,
    handle_http_exception,
    handle_exception,
    not_found
)

TEMP_DIR = tempfile.gettempdir()
EXPIRATION_TIME = 3600  # 1 hour in seconds

app = Flask(__name__, static_folder='static_site', static_url_path='/static')
app.config['MAX_FORM_MEMORY_SIZE'] = None

# Create a logger
app_logger = Logger(debug=False, json_output=False)

# Register blueprint with "/api" prefix
app.register_blueprint(api_blueprint, url_prefix="/api")

# Register error handlers
app.register_error_handler(413, handle_request_entity_too_large)
app.register_error_handler(Exception, handle_exception)
app.register_error_handler(404, not_found)
# For all other HTTP exceptions
app.register_error_handler(400, handle_http_exception)
app.register_error_handler(401, handle_http_exception)
app.register_error_handler(403, handle_http_exception)
app.register_error_handler(405, handle_http_exception)
app.register_error_handler(500, handle_http_exception)

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


def start_scheduler():
    """
    Start a background job to periodically clean up old temp folders.
    """
    cleanup_service = CleanupService(TEMP_DIR, EXPIRATION_TIME, app_logger)
    scheduler = BackgroundScheduler()
    scheduler.add_job(func=cleanup_service.cleanup_temp_folders, trigger="interval", seconds=EXPIRATION_TIME)
    scheduler.start()
    app_logger.log("Scheduler started for periodic temp folder cleanup.", "info")
