#!/bin/bash

set -euo pipefail

IMAGE_NAME="karimz1/imgcompress:local-test"
BUILDX_BUILDER="${BUILDX_BUILDER:-imgcompress-builder}"
# VARIANT=balanced bakes the default low-memory set: u2net, isnet-anime,
# isnet-general-use. This is the safest default for 8 GB hosts.
# VARIANT=slim bakes only the default u2net model.
# VARIANT=full bakes every rembg model, including high-memory BiRefNet models.
VARIANT="${VARIANT:-balanced}"
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
  echo "NO_CACHE=true: clean build (no layer cache, re-pulling base images)"
  BUILD_FLAGS+=(--no-cache --pull)
else
  echo "Incremental build (reusing BuildKit cache). Set NO_CACHE=true for a clean build."
fi

case "$VARIANT" in
  slim)
    echo "VARIANT=slim: baking only the u2net model"
    BUILD_FLAGS+=(--build-arg "REMBG_MODELS=u2net")
    ;;
  balanced)
    echo "VARIANT=balanced: baking low-memory models: u2net, isnet-anime, isnet-general-use"
    BUILD_FLAGS+=(--build-arg "REMBG_MODELS=u2net isnet-anime isnet-general-use")
    ;;
  full)
    echo "VARIANT=full: baking all rembg models, including high-memory BiRefNet models"
    BUILD_FLAGS+=(--build-arg "REMBG_MODELS=u2net isnet-anime isnet-general-use birefnet-portrait birefnet-general-lite birefnet-general")
    ;;
  *)
    echo "Unknown VARIANT=$VARIANT. Expected slim, balanced, or full." >&2
    exit 1
    ;;
esac

echo "Building Docker image: $IMAGE_NAME"
docker buildx build \
  "${BUILD_FLAGS[@]}" \
  -t "$IMAGE_NAME" \
  .

echo "Running container on http://localhost:$PORT_HOST with DISABLE_LOGO=$DISABLE_LOGO DEV_MODE=$DEV_MODE"
docker run --rm \
  --name imgcompress-local-tester \
  -p "$PORT_HOST:$PORT_CONTAINER" \
  -e DISABLE_LOGO="$DISABLE_LOGO" \
  -e DISABLE_STORAGE_MANAGEMENT="$DISABLE_STORAGE_MANAGEMENT" \
  -e DEV_MODE="$DEV_MODE" \
  "$IMAGE_NAME"
