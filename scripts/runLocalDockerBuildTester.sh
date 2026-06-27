#!/bin/bash

set -euo pipefail

IMAGE_NAME="karimz1/imgcompress:local-test"
BUILDX_BUILDER="${BUILDX_BUILDER:-imgcompress-builder}"
PORT_CONTAINER=5000
PORT_HOST=${PORT_HOST:-80}
DISABLE_LOGO=${DISABLE_LOGO:-false}
DISABLE_STORAGE_MANAGEMENT=${DISABLE_STORAGE_MANAGEMENT:-false}
DEV_MODE=${DEV_MODE:-false}

"$(dirname "$0")/ensureBuildxBuilder.sh" "$BUILDX_BUILDER"

echo "🚧 Building Docker image: $IMAGE_NAME"
docker buildx build \
  --builder "$BUILDX_BUILDER" \
  --load \
  --pull \
  --no-cache \
  -t "$IMAGE_NAME" \
  .

echo "🚀 Running container on http://localhost:$PORT_HOST with DISABLE_LOGO=$DISABLE_LOGO DEV_MODE=$DEV_MODE"
docker run --rm \
  --name imgcompress-local-tester \
  -p "$PORT_HOST:$PORT_CONTAINER" \
  -e DISABLE_LOGO="$DISABLE_LOGO" \
  -e DISABLE_STORAGE_MANAGEMENT="$DISABLE_STORAGE_MANAGEMENT" \
  -e DEV_MODE="$DEV_MODE" \
  "$IMAGE_NAME"
