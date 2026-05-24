#!/usr/bin/env sh
# Mirrors the GitHub Actions CI: builds the devcontainer, runs unit +
# integration tests inside it, builds the app image, runs E2E. Shares the
# host's Docker credentials with the devcontainer so dhi.io pulls work the
# same way they do in CI.
set -eu

cd "$(dirname "$0")/.."

APP_CONTAINER="app"
DHI_REGISTRY="dhi.io"
HOST_DOCKER_CONFIG="${DOCKER_CONFIG:-$HOME/.docker}/config.json"

cleanup() {
  echo ""
  echo "Cleaning up..."
  docker rm -f "$APP_CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

check_dhi_login() {
  if [ ! -f "$HOST_DOCKER_CONFIG" ]; then
    echo "❌ $HOST_DOCKER_CONFIG not found. Run: docker login $DHI_REGISTRY" >&2
    exit 1
  fi

  # The devcontainer is Linux and cannot execute macOS / pass / secretservice
  # credential helpers. If creds for dhi.io live in a helper, the mounted
  # config.json reads as empty inside the container and pulls 401. Force the
  # user to either store creds inline or override DOCKER_CONFIG.
  if python3 - "$HOST_DOCKER_CONFIG" "$DHI_REGISTRY" <<'PY'
import json, sys
cfg = json.load(open(sys.argv[1]))
registry = sys.argv[2]
inline = (cfg.get("auths") or {}).get(registry, {}).get("auth")
helper = (cfg.get("credHelpers") or {}).get(registry) or cfg.get("credsStore")
sys.exit(0 if (not inline and helper) else 1)
PY
  then
    cat >&2 <<EOF
❌ Your $HOST_DOCKER_CONFIG stores $DHI_REGISTRY credentials in a credential
helper (e.g. macOS Keychain via "credsStore": "desktop"). Linux containers
can't run that helper, so the mounted config reads as empty and the build
401s.

One-time fix:
  1. Edit ~/.docker/config.json, remove the "credsStore" key (or set it to "").
  2. docker logout $DHI_REGISTRY
  3. docker login $DHI_REGISTRY -u <docker-hub-username>
     (paste your Docker Hub PAT as the password)
  4. Re-run this script.
EOF
    exit 1
  fi
}

run_stage() {
  stage_name="$1"
  shift

  echo ""
  echo "========================================"
  echo "Running stage: $stage_name"
  echo "========================================"

  if "$@"; then
    echo "✅ Stage passed: $stage_name"
  else
    status=$?
    echo ""
    echo "❌ Stage failed: $stage_name (exit $status)"
    printf '  %s\n' "$*"
    exit "$status"
  fi
}

devcontainer_run() {
  docker run --rm \
    --entrypoint /bin/sh \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$HOST_DOCKER_CONFIG:/root/.docker/config.json:ro" \
    -v "$(pwd):/app/" \
    -e IS_RUNNING_IN_GITHUB_ACTIONS=true \
    "$@"
}

run_stage "Verify $DHI_REGISTRY login" check_dhi_login

run_stage "Build devcontainer" \
  docker buildx build -t devcontainer:local-test .devcontainer/

run_stage "Run unit tests" \
  devcontainer_run --name devcontainer \
    devcontainer:local-test /app/scripts/runUnitTests.sh

run_stage "Run integration tests" \
  devcontainer_run --name devcontainer \
    devcontainer:local-test /app/scripts/runIntegrationTests.sh

run_stage "Build app image" \
  docker buildx build -t karimz1/imgcompress:local-test .

run_stage "Start app container" \
  docker run --rm -d \
    --network host \
    --name "$APP_CONTAINER" \
    karimz1/imgcompress:local-test web

run_stage "Run e2e tests" \
  devcontainer_run \
    --network host \
    -e PLAYWRIGHT_BASE_URL=http://localhost:5000 \
    --name devcontainer_e2e \
    devcontainer:local-test -c "/app/scripts/run-e2e.sh"

echo ""
echo "✅ All stages passed successfully!"
