from http.client import HTTPException
import tempfile
import traceback
from flask import Flask, jsonify
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

from backend.image_converter.presentation.web.static_routes import static_blueprint

TEMP_DIR = tempfile.gettempdir()
EXPIRATION_TIME = 3600  # 1 hour

app = Flask(
    __name__,
    static_folder="static_site",
    static_url_path="/static"
)
app.config["MAX_FORM_MEMORY_SIZE"] = None
app_logger = Logger(debug=False, json_output=False)

app.register_blueprint(api_blueprint, url_prefix="/api")
app.register_blueprint(static_blueprint, url_prefix="/")


# -----------------------------------
# Register Error Handlers for the API
# -----------------------------------
app.register_error_handler(413, handle_request_entity_too_large)
app.register_error_handler(Exception, handle_exception)
app.register_error_handler(404, not_found)  
app.register_error_handler(400, handle_http_exception)
app.register_error_handler(401, handle_http_exception)
app.register_error_handler(403, handle_http_exception)
app.register_error_handler(405, handle_http_exception)
app.register_error_handler(500, handle_http_exception)

@app.errorhandler(Exception)
def handle_exception(e):
    """
    Return JSON instead of HTML for any errors.
    """
    if isinstance(e, HTTPException):
        response = {
            "error": e.name,
            "message": e.description
        }
        return jsonify(response), e.code

    # For non-HTTP exceptions, provide a generic message.
    response = {
        "error": type(e).__name__,
        "message": str(e)
    }

    response["stacktrace"] = traceback.format_exc()
    return jsonify(response), 500

def start_scheduler():
    """
    Start a background job to periodically clean up old temp folders.
    """
    cleanup_service = CleanupService(TEMP_DIR, EXPIRATION_TIME, app_logger)
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        func=cleanup_service.cleanup_temp_folders,
        trigger="interval",
        seconds=EXPIRATION_TIME
    )
    scheduler.start()
    app_logger.log("Scheduler started for periodic temp folder cleanup.", "info")

