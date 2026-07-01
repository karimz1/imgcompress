#!/bin/bash

set -euo pipefail

IMAGE_NAME="karimz1/imgcompress:local-test"
BUILDX_BUILDER="${BUILDX_BUILDER:-imgcompress-builder}"
PORT_CONTAINER=5000
PORT_HOST=${PORT_HOST:-80}
DISABLE_LOGO=${DISABLE_LOGO:-false}
DISABLE_STORAGE_MANAGEMENT=${DISABLE_STORAGE_MANAGEMENT:-false}
DEV_MODE=${DEV_MODE:-false}
# Local dev iteration is cache-friendly by default so small code changes reuse
# the BuildKit layer cache instead of rebuilding the frontend, pip install, and
# apt layers every time. Set NO_CACHE=true for a clean, from-scratch build that
# also re-pulls the (digest-pinned) base images.
NO_CACHE=${NO_CACHE:-true}

"$(dirname "$0")/ensureBuildxBuilder.sh" "$BUILDX_BUILDER"

BUILD_FLAGS=(--builder "$BUILDX_BUILDER" --load)
if [ "$NO_CACHE" = "true" ]; then
  echo "🧼 NO_CACHE=true → clean build (no layer cache, re-pulling base images)"
  BUILD_FLAGS+=(--no-cache --pull)
else
  echo "⚡ Incremental build (reusing BuildKit cache). Set NO_CACHE=true for a clean build."
fi

echo "🚧 Building Docker image: $IMAGE_NAME"
docker buildx build \
  "${BUILD_FLAGS[@]}" \
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
