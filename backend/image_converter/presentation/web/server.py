import traceback

import pillow_heif
from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException

from backend.image_converter.config import settings
from backend.image_converter.infrastructure.cleanup_service import CleanupService
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.presentation.web.error_handlers import (
    handle_http_exception,
    handle_request_entity_too_large,
    not_found,
)
from backend.image_converter.presentation.web.routes import api_blueprint
from backend.image_converter.presentation.web.static_routes import static_blueprint


pillow_heif.register_heif_opener()

_config = settings.get()

TEMP_DIR = _config.temporary_storage.directory
EXPIRATION_TIME = _config.temporary_storage.max_age_seconds

app = Flask(
    __name__,
    static_folder="static_site",
    static_url_path="/static",
)
app.config["MAX_FORM_MEMORY_SIZE"] = None
app.config["MAX_CONTENT_LENGTH"] = _config.uploads.max_file_size_bytes

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

    app_logger.log(f"Exception occurred: {traceback.format_exc()}", "error")
    response = {
        "error": type(e).__name__,
        "message": "An unexpected error occurred. See server logs for details.",
    }
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
        seconds=EXPIRATION_TIME,
    )
    scheduler.start()
    app_logger.log("Scheduler started for periodic temp folder cleanup.", "info")


if __name__ == "__main__":
    start_scheduler()
    app.run(host=_config.web.host, port=_config.web.port, threaded=True)
