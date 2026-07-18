#!/bin/bash
#
# Local repro of the CI "rembg model matrix" e2e: build the full image (all
# models baked in), run the container, then POST the sample photo to
# /api/compress for every selectable model and assert each returns a real
# transparent cutout. Runs fully offline against the baked models.
#
# Requires: docker, plus a local python with pytest + Pillow on PATH (the test
# itself only talks HTTP to the container; it does not run rembg locally).
#
# Usage:
#   scripts/runRembgModelMatrix.sh

set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-karimz1/imgcompress:local-test-rembg}"
BUILDX_BUILDER="${BUILDX_BUILDER:-imgcompress-builder}"
CONTAINER_NAME="${CONTAINER_NAME:-imgcompress-rembg-matrix}"
PORT_HOST="${PORT_HOST:-8090}"
PORT_CONTAINER=5000
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cleanup_container() {
    docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
    docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup_container EXIT

command -v docker >/dev/null 2>&1 || { echo "docker is required but was not found in PATH" >&2; exit 1; }

"$SCRIPT_DIR/ensureBuildxBuilder.sh" "$BUILDX_BUILDER"

echo "Building full image (all models): $IMAGE_NAME"
docker buildx build --builder "$BUILDX_BUILDER" --load --pull -t "$IMAGE_NAME" "$APP_ROOT"

cleanup_container
echo "Running container on http://localhost:$PORT_HOST"
docker run -d --name "$CONTAINER_NAME" -p "$PORT_HOST:$PORT_CONTAINER" "$IMAGE_NAME" >/dev/null

echo "Waiting for /api/health/backend ..."
SECONDS=0
until curl -fsS "http://localhost:$PORT_HOST/api/health/backend" >/dev/null 2>&1; do
    if (( SECONDS >= HEALTH_TIMEOUT )); then
        echo "Backend did not become healthy within ${HEALTH_TIMEOUT}s" >&2
        docker logs --tail 100 "$CONTAINER_NAME" || true
        exit 1
    fi
    sleep 2
done

echo "Backend up. Running the model matrix against the baked models."
cd "$APP_ROOT"
IMGCOMPRESS_API_BASE="http://localhost:$PORT_HOST" \
    python -m pytest tests/integration/test_rembg_models_api.py -v "$@"
