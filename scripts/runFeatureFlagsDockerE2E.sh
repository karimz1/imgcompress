#!/bin/bash

set -euo pipefail

# Build the Docker image once, then run the runtime feature-flags Playwright
# spec against four flag combinations to prove DISABLE_LOGO and
# DISABLE_STORAGE_MANAGEMENT propagate end-to-end (env -> runtime.json -> UI).

IMAGE_NAME="${IMAGE_NAME:-karimz1/imgcompress:local-test-flags}"
CONTAINER_NAME="${CONTAINER_NAME:-imgcompress-flags-tester}"
PORT_HOST="${PORT_HOST:-8080}"
PORT_CONTAINER=5000
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"
SPEC_PATH="tests/e2e/featureFlagsRuntime_Test.spec.ts"

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

echo "🚧 Building Docker image: $IMAGE_NAME"
docker buildx build --pull -t "$IMAGE_NAME" "$APP_ROOT"

# (DISABLE_LOGO, DISABLE_STORAGE_MANAGEMENT) combinations
COMBOS=(
    "false false"
    "true  false"
    "false true"
    "true  true"
)

FAILURES=()

for combo in "${COMBOS[@]}"; do
    # shellcheck disable=SC2086
    set -- $combo
    DL="$1"
    DSM="$2"

    echo
    echo "==========================================================="
    echo "▶ Combo: DISABLE_LOGO=$DL DISABLE_STORAGE_MANAGEMENT=$DSM"
    echo "==========================================================="

    cleanup_container

    docker run -d \
        --name "$CONTAINER_NAME" \
        -p "$PORT_HOST:$PORT_CONTAINER" \
        -e DISABLE_LOGO="$DL" \
        -e DISABLE_STORAGE_MANAGEMENT="$DSM" \
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
        FAILURES+=("DISABLE_LOGO=$DL DISABLE_STORAGE_MANAGEMENT=$DSM (health timeout)")
        cleanup_container
        continue
    fi

    echo "✅ Backend up. Running spec: $SPEC_PATH"
    if (
        cd "$FRONTEND_DIR" && \
        CI=true \
        PLAYWRIGHT_BASE_URL="http://localhost:$PORT_HOST" \
        pnpm exec playwright test "$SPEC_PATH"
    ); then
        echo "✅ Spec passed for DISABLE_LOGO=$DL DISABLE_STORAGE_MANAGEMENT=$DSM"
    else
        echo "❌ Spec failed for DISABLE_LOGO=$DL DISABLE_STORAGE_MANAGEMENT=$DSM"
        FAILURES+=("DISABLE_LOGO=$DL DISABLE_STORAGE_MANAGEMENT=$DSM (spec failed)")
    fi

    cleanup_container
done

echo
echo "==========================================================="
if (( ${#FAILURES[@]} == 0 )); then
    echo "✅ All 4 flag combinations passed"
    exit 0
fi

echo "❌ Failures:"
for f in "${FAILURES[@]}"; do
    echo "   - $f"
done
exit 1
