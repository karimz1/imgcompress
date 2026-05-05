#!/bin/bash

set -e

CONFIG_DIR="/container/backend/image_converter/presentation/web/static_site/config"

mkdir -p "$CONFIG_DIR"

cat <<EOF > "$CONFIG_DIR/runtime.json"
{
  "DISABLE_LOGO": "${DISABLE_LOGO:-false}",
  "DISABLE_STORAGE_MANAGEMENT": "${DISABLE_STORAGE_MANAGEMENT:-false}",
  "DEV_MODE": "${DEV_MODE:-false}"
}
EOF

exec python -m backend.image_converter.bootstraper "$@"
