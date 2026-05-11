#!/bin/bash
set -euo pipefail

LOG_FILE=$(python -c "from backend.image_converter.config import settings; print(settings.backend_log_file())")
export IMGCOMPRESS_EXTERNAL_STDOUT_TEE="true"
: > "$LOG_FILE"

python -m backend.image_converter.bootstraper web 2>&1 | tee -a "$LOG_FILE"
