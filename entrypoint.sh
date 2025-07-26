#!/bin/bash

set -e

CONFIG_DIR="/container/backend/image_converter/presentation/web/static_site/config"

mkdir -p "$CONFIG_DIR"

# Generate runtime.json dynamically using ENV
cat <<EOF > "$CONFIG_DIR/runtime.json"
{
  "DISABLE_LOGO": "${DISABLE_LOGO:-false}"
}
EOF

echo "Generated runtime config:"
cat "$CONFIG_DIR/runtime.json"

exec image-converter "$@"
