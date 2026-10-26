#!/bin/bash

set -euo pipefail

# Build the Docker image once, then run the runtime feature-flags Playwright
# specs against flag combinations to prove DISABLE_LOGO,
# DISABLE_STORAGE_MANAGEMENT and MAX_UPLOAD_SIZE_MB propagate end-to-end
# (env -> runtime.json -> UI and server). The upload limit spec skips itself
# unless the limit is small.

IMAGE_NAME="${IMAGE_NAME:-karimz1/imgcompress:local-test-flags}"
BUILDX_BUILDER="${BUILDX_BUILDER:-imgcompress-builder}"
CONTAINER_NAME="${CONTAINER_NAME:-imgcompress-flags-tester}"
PORT_HOST="${PORT_HOST:-8080}"
PORT_CONTAINER=5000
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"
SPEC_PATHS=("tests/e2e/featureFlagsRuntime_Test.spec.ts" "tests/e2e/uploadLimitRuntime_Test.spec.ts")

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$APP_ROOT/frontend"

cleanup_container() {
    docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
    docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup_container EXIT

if ! command -v docker >/dev/null 2>&1; then
    echo "❌ docker is required but was not found in PATH" >&2
    exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
    echo "❌ pnpm is required but was not found in PATH" >&2
    echo "   Install pnpm or run from a shell that has it on PATH." >&2
    exit 1
fi

"$SCRIPT_DIR/ensureBuildxBuilder.sh" "$BUILDX_BUILDER"

echo "🚧 Building Docker image: $IMAGE_NAME"
docker buildx build \
    --builder "$BUILDX_BUILDER" \
    --load \
    --pull \
    -t "$IMAGE_NAME" \
    "$APP_ROOT"

# (DISABLE_LOGO, DISABLE_STORAGE_MANAGEMENT, MAX_UPLOAD_SIZE_MB; "-" = default) combinations
COMBOS=(
    "false false -"
    "true  false -"
    "false true  -"
    "true  true  -"
    "false false 5"
)

FAILURES=()

for combo in "${COMBOS[@]}"; do
    # shellcheck disable=SC2086
    set -- $combo
    DL="$1"
    DSM="$2"
    MAX_MB="$3"
    [ "$MAX_MB" = "-" ] && MAX_MB=""

    echo
    echo "==========================================================="
    echo "▶ Combo: DISABLE_LOGO=$DL DISABLE_STORAGE_MANAGEMENT=$DSM MAX_UPLOAD_SIZE_MB=${MAX_MB:-default}"
    echo "==========================================================="

    cleanup_container

    docker run -d \
        --name "$CONTAINER_NAME" \
        -p "$PORT_HOST:$PORT_CONTAINER" \
        -e DISABLE_LOGO="$DL" \
        -e DISABLE_STORAGE_MANAGEMENT="$DSM" \
        -e MAX_UPLOAD_SIZE_MB="$MAX_MB" \
        "$IMAGE_NAME" >/dev/null

    echo "⏳ Waiting for http://localhost:$PORT_HOST/api/health/backend ..."
    HEALTHY=0
    SECONDS=0
    while (( SECONDS < HEALTH_TIMEOUT )); do
        if curl -fsS "http://localhost:$PORT_HOST/api/health/backend" >/dev/null 2>&1; then
            HEALTHY=1
            break
        fi
        sleep 2
    done

    if (( HEALTHY != 1 )); then
        echo "❌ Backend did not become healthy within ${HEALTH_TIMEOUT}s"
        docker logs --tail 100 "$CONTAINER_NAME" || true
        FAILURES+=("DISABLE_LOGO=$DL DISABLE_STORAGE_MANAGEMENT=$DSM MAX_UPLOAD_SIZE_MB=${MAX_MB:-default} (health timeout)")
        cleanup_container
        continue
    fi

    echo "✅ Backend up. Running specs: ${SPEC_PATHS[*]}"
    if (
        cd "$FRONTEND_DIR" && \
        CI=true \
        PLAYWRIGHT_BASE_URL="http://localhost:$PORT_HOST" \
        pnpm exec playwright test "${SPEC_PATHS[@]}"
    ); then
        echo "✅ Spec passed for DISABLE_LOGO=$DL DISABLE_STORAGE_MANAGEMENT=$DSM MAX_UPLOAD_SIZE_MB=${MAX_MB:-default}"
    else
        echo "❌ Spec failed for DISABLE_LOGO=$DL DISABLE_STORAGE_MANAGEMENT=$DSM MAX_UPLOAD_SIZE_MB=${MAX_MB:-default}"
        FAILURES+=("DISABLE_LOGO=$DL DISABLE_STORAGE_MANAGEMENT=$DSM MAX_UPLOAD_SIZE_MB=${MAX_MB:-default} (spec failed)")
    fi

    cleanup_container
done

echo
echo "==========================================================="
if (( ${#FAILURES[@]} == 0 )); then
    echo "✅ All ${#COMBOS[@]} flag combinations passed"
    exit 0
fi

echo "❌ Failures:"
for f in "${FAILURES[@]}"; do
    echo "   - $f"
done
exit 1
