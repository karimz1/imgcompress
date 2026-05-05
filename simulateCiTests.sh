#!/usr/bin/env sh
set -eu

APP_CONTAINER="app"

cleanup() {
  echo ""
  echo "Cleaning up..."
  docker rm -f "$APP_CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

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
    echo "❌ Stage failed: $stage_name"
    echo "Exit code: $status"
    echo "Command:"
    printf '  %s\n' "$*"
    exit "$status"
  fi
}

run_stage "Build devcontainer" \
  docker buildx build -t devcontainer:local-test .devcontainer/

run_stage "Run unit tests" \
  docker run --rm \
    --entrypoint /bin/sh \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$(pwd):/app/" \
    -e IS_RUNNING_IN_GITHUB_ACTIONS=true \
    --name devcontainer \
    devcontainer:local-test /app/runUnitTests.sh

run_stage "Run integration tests" \
  docker run --rm \
    --entrypoint /bin/sh \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$(pwd):/app/" \
    -e IS_RUNNING_IN_GITHUB_ACTIONS=true \
    --name devcontainer \
    devcontainer:local-test /app/runIntegrationTests.sh

run_stage "Build app image" \
  docker buildx build -t karimz1/imgcompress:local-test .

run_stage "Start app container" \
  docker run --rm -d \
    --network host \
    --name "$APP_CONTAINER" \
    karimz1/imgcompress:local-test web

run_stage "Run e2e tests" \
  docker run --rm \
    --entrypoint /bin/sh \
    --network host \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$(pwd):/app/" \
    -e IS_RUNNING_IN_GITHUB_ACTIONS=true \
    -e PLAYWRIGHT_BASE_URL=http://localhost:5000 \
    --name devcontainer_e2e \
    devcontainer:local-test -c "/app/run-e2e.sh"

echo ""
echo "✅ All stages passed successfully!"