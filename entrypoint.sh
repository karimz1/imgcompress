#!/bin/bash

# Write the config file dynamically
cat <<EOF > /container/backend/image_converter/presentation/web/static_site/config/runtime.json
{
  "DISABLE_LOGO": "${DISABLE_LOGO:-false}"
}
EOF

# Start the actual backend
exec image-converter
