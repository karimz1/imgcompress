from http.client import HTTPException
import tempfile
import traceback
from flask import Flask, jsonify
from apscheduler.schedulers.background import BackgroundScheduler
import pillow_heif

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

pillow_heif.register_heif_opener()

TEMP_DIR = tempfile.gettempdir()
EXPIRATION_TIME = 3600  # 1 hour

app = Flask(
    __name__,
    static_folder="static_site",
    static_url_path="/static"
)
app.config["MAX_FORM_MEMORY_SIZE"] = None

# Instantiate the app logger
app_logger = Logger(debug=False, json_output=False)

# Register blueprints for API and static routes.
app.register_blueprint(api_blueprint, url_prefix="/api")
app.register_blueprint(static_blueprint, url_prefix="/")

# -----------------------------------
# Register Error Handlers for the API
# -----------------------------------
app.register_error_handler(413, handle_request_entity_too_large)
app.register_error_handler(404, not_found)
app.register_error_handler(400, handle_http_exception)
app.register_error_handler(401, handle_http_exception)
app.register_error_handler(403, handle_http_exception)
app.register_error_handler(405, handle_http_exception)
app.register_error_handler(500, handle_http_exception)

# Global error handler for exceptions.
@app.errorhandler(Exception)
def global_handle_exception(e):
    if isinstance(e, HTTPException):
        response = {
            "error": e.name,
            "message": e.description
        }
        return jsonify(response), e.code

    response = {
        "error": type(e).__name__,
        "message": str(e),
        "stacktrace": traceback.format_exc()
    }
    # Log the error using our app_logger.
    app_logger.log(f"Exception occurred: {traceback.format_exc()}", "error")
    return jsonify(response), 500

def start_scheduler():
    """
    Start a background job to periodically clean up old temp folders.
    Uses the result pattern from CleanupService to log any errors.
    """
    cleanup_service = CleanupService(TEMP_DIR, EXPIRATION_TIME, app_logger)

    def scheduled_cleanup():
        # Call the cleanup method, which returns a Result.
        result = cleanup_service.cleanup_temp_folders()
        if not result.is_successful:
            app_logger.log(f"Cleanup error: {result.error}", "error")
        else:
            app_logger.log("Scheduled cleanup completed successfully.", "info")

    scheduler = BackgroundScheduler()
    scheduler.add_job(
        func=scheduled_cleanup,
        trigger="interval",
        seconds=EXPIRATION_TIME
    )
    scheduler.start()
    app_logger.log("Scheduler started for periodic temp folder cleanup.", "info")

# Optionally, you can start the scheduler when the app starts.
if __name__ == "__main__":
    start_scheduler()
    app.run(host="0.0.0.0", port=5000)
