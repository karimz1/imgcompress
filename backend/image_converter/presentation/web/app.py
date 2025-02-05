# file: backend/image_converter/presentation/web/app.py

import os
import tempfile
from flask import Flask
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

def start_scheduler():
    """
    Start a background job to periodically clean up old temp folders.
    """
    cleanup_service = CleanupService(TEMP_DIR, EXPIRATION_TIME, app_logger)
    scheduler = BackgroundScheduler()
    scheduler.add_job(func=cleanup_service.cleanup_temp_folders, trigger="interval", seconds=EXPIRATION_TIME)
    scheduler.start()
    app_logger.log("Scheduler started for periodic temp folder cleanup.", "info")
