#!/bin/bash

set -euo pipefail

IMAGE_NAME="karimz1/imgcompress:local-test"
PORT_CONTAINER=5000
PORT_HOST=${PORT_HOST:-80}

echo "🚧 Building Docker image: $IMAGE_NAME"
docker buildx build --pull --no-cache -t "$IMAGE_NAME" .

echo "🚀 Running container on http://localhost:$PORT_HOST"
echo "    (feature flags come from backend/image_converter/config/app.json baked into the image)"
docker run --rm \
  --name imgcompress-local-tester \
  -p "$PORT_HOST:$PORT_CONTAINER" \
  "$IMAGE_NAME"
