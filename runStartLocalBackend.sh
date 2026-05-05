#!/bin/bash
set -euo pipefail

# Use the bootstraper so local runs match production server settings.
export IMGCOMPRESS_BACKEND_LOG_FILE="${IMGCOMPRESS_BACKEND_LOG_FILE:-/tmp/imgcompress-backend.log}"
export IMGCOMPRESS_EXTERNAL_STDOUT_TEE="true"
: > "$IMGCOMPRESS_BACKEND_LOG_FILE"

python -m backend.image_converter.bootstraper web 2>&1 | tee -a "$IMGCOMPRESS_BACKEND_LOG_FILE"
