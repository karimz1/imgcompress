import os
import json
import sys

# Create runtime configuration file for frontend at runtime
config_dir = "/container/backend/image_converter/presentation/web/static_site/config"
os.makedirs(config_dir, exist_ok=True)

runtime_config = {
    "DISABLE_LOGO": os.environ.get("DISABLE_LOGO", "false"),
    "DISABLE_STORAGE_MANAGEMENT": os.environ.get("DISABLE_STORAGE_MANAGEMENT", "false"),
    "DEV_MODE": os.environ.get("DEV_MODE", "false"),
    # Empty means the app.json default; the backend serves the resolved value.
    "MAX_UPLOAD_SIZE_MB": os.environ.get("MAX_UPLOAD_SIZE_MB", ""),
    # Set in app.json only; empty means the default, the backend serves the resolved value.
    "MAX_OUTPUT_MEGAPIXELS": "",
}

with open(os.path.join(config_dir, "runtime.json"), "w", encoding="utf-8") as f:
    json.dump(runtime_config, f)

# Execute the main application
os.execvp("python", ["python", "-m", "backend.image_converter.bootstraper"] + sys.argv[1:])