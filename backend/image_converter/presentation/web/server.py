from werkzeug.exceptions import HTTPException
import traceback
from flask import Flask, jsonify
from apscheduler.schedulers.background import BackgroundScheduler
import pillow_heif

from backend.image_converter.config import settings
from backend.image_converter.infrastructure.logger import Logger, install_stdout_stderr_capture
from backend.image_converter.infrastructure.cleanup_service import CleanupService
from backend.image_converter.presentation.web.routes import api_blueprint
from backend.image_converter.presentation.web.error_handlers import (
    handle_request_entity_too_large,
    handle_http_exception,
    not_found
)
from backend.image_converter.presentation.web.static_routes import static_blueprint

install_stdout_stderr_capture()
pillow_heif.register_heif_opener()

TEMP_DIR = settings.temp_dir()
EXPIRATION_TIME = settings.temp_expiration_seconds()

app = Flask(
    __name__,
    static_folder="static_site",
    static_url_path="/static"
)
app.config["MAX_FORM_MEMORY_SIZE"] = None
app.config["MAX_CONTENT_LENGTH"] = settings.max_upload_bytes()

app_logger = Logger(debug=False, json_output=False)

app.register_blueprint(api_blueprint, url_prefix="/api")
app.register_blueprint(static_blueprint, url_prefix="/")

app.register_error_handler(413, handle_request_entity_too_large)
app.register_error_handler(404, not_found)
app.register_error_handler(400, handle_http_exception)
app.register_error_handler(401, handle_http_exception)
app.register_error_handler(403, handle_http_exception)
app.register_error_handler(405, handle_http_exception)
app.register_error_handler(500, handle_http_exception)


@app.errorhandler(Exception)
def global_handle_exception(e):
    if isinstance(e, HTTPException):
        return handle_http_exception(e)

    response = {
        "error": type(e).__name__,
        "message": str(e),
        "stacktrace": traceback.format_exc()
    }
    app_logger.log(f"Exception occurred: {traceback.format_exc()}", "error")
    return jsonify(response), 500


def start_scheduler():
    cleanup_service = CleanupService(TEMP_DIR, EXPIRATION_TIME, app_logger)

    def scheduled_cleanup():
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


if __name__ == "__main__":
    start_scheduler()
    app.run(host=settings.web_host(), port=settings.web_port(), threaded=True)
