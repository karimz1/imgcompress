#!/bin/bash

set -e

# Path where the frontend static site is served from
CONFIG_DIR="/container/backend/image_converter/presentation/web/static_site/config"

# Make sure the directory exists
mkdir -p "$CONFIG_DIR"

# Generate runtime.json dynamically using ENV
cat <<EOF > "$CONFIG_DIR/runtime.json"
{
  "DISABLE_LOGO": "${DISABLE_LOGO:-false}"
}
EOF

# Optionally log the written config (for debugging)
echo "Generated runtime config:"
cat "$CONFIG_DIR/runtime.json"

# Run your app
exec image-converter "$@"
