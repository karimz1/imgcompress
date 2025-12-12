#!/bin/bash

set -e

IMAGE_NAME="karimz1/imgcompress:local-test"
PORT_LOCAL=3001
PORT_CONTAINER=5000
DISABLE_LOGO=${DISABLE_LOGO:-false}
DISABLE_STORAGE_MANAGEMENT=${DISABLE_STORAGE_MANAGEMENT:-true}

echo "🚧 Building Docker image: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" .

echo "🚀 Running container on http://localhost:$PORT_LOCAL with DISABLE_LOGO=$DISABLE_LOGO"
docker run --rm \
  -p "$PORT_LOCAL:$PORT_CONTAINER" \
  -e DISABLE_LOGO="$DISABLE_LOGO" \
  -e DISABLE_STORAGE_MANAGEMENT="$DISABLE_STORAGE_MANAGEMENT" \
  "$IMAGE_NAME" web
