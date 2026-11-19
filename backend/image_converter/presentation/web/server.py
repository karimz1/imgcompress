import traceback

import pillow_heif
from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException

from backend.image_converter.config import settings
from backend.image_converter.infrastructure.cleanup_service import (
    CleanupService,
    cleanup_interval_seconds,
)
from backend.image_converter.infrastructure.logger import Logger
from backend.image_converter.presentation.web.error_handlers import (
    handle_http_exception,
    handle_request_entity_too_large,
)
from backend.image_converter.presentation.web.api_access import API_PREFIX, startup_notices
from backend.image_converter.presentation.web.routes import api_blueprint, legacy_blueprint
from backend.image_converter.presentation.web.not_found_page import not_found_response
from backend.image_converter.presentation.web.static_routes import (
    install_api_only_web_ui_gate,
    static_blueprint,
)


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

# Never the key itself, only whether one is set and which mode this is.
for message, level in startup_notices(_config):
    app_logger.log(message, level)

# One API for the web UI and other apps; see api_access for who may call it.
app.register_blueprint(api_blueprint, url_prefix=API_PREFIX)
# Deprecated alias of /api/v1/health (removed in 2.0).
app.register_blueprint(legacy_blueprint, url_prefix="/api")
app.register_blueprint(static_blueprint, url_prefix="/")
install_api_only_web_ui_gate(app)

app.register_error_handler(413, handle_request_entity_too_large)
app.register_error_handler(404, not_found_response)
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
        "message": "An unexpected error occurred. See the container logs for details.",
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
        seconds=cleanup_interval_seconds(EXPIRATION_TIME),
    )
    scheduler.start()
    app_logger.log("Scheduler started for periodic temp folder cleanup.", "info")


if __name__ == "__main__":
    start_scheduler()
    app.run(host=_config.web.host, port=_config.web.port, threaded=True)
