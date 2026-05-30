#!/usr/bin/env sh
# Mirrors the GitHub Actions CI locally: builds the devcontainer, runs unit +
# integration tests inside it, builds the app image, runs E2E. Shares the
# host's Docker config with the devcontainer so registry pulls (incl. dhi.io)
# work the same way they do in CI.
set -eu

cd "$(dirname "$0")/.."

APP_CONTAINER="app"
HOST_DOCKER_CONFIG="${DOCKER_CONFIG:-$HOME/.docker}/config.json"
# Docker Desktop on macOS refuses to share ~/.docker even when the parent
# directory is in File Sharing. Stage a copy of the config inside the project
# (which IS shared via the $(pwd):/app/ mount) and use that as the source.
SHARED_DOCKER_CONFIG_DIR=".docker-share"
SHARED_DOCKER_CONFIG="$SHARED_DOCKER_CONFIG_DIR/config.json"

cleanup() {
  docker rm -f "$APP_CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$SHARED_DOCKER_CONFIG_DIR"
}
trap cleanup EXIT INT TERM

mkdir -p "$SHARED_DOCKER_CONFIG_DIR"
# Stage an inline-auth copy of the host config. macOS Keychain / pass /
# secretservice credential helpers don't exist in the Linux devcontainer, so
# we resolve any credsStore entries on the host once and bake inline `auth`
# tokens into the staged file. Linux hosts with already-inline auths just
# round-trip unchanged.
python3 - "$HOST_DOCKER_CONFIG" "$SHARED_DOCKER_CONFIG" <<'PY'
import base64, json, subprocess, sys
src, dst = sys.argv[1], sys.argv[2]
cfg = json.load(open(src))
helper = cfg.get("credsStore", "")
helpers = cfg.get("credHelpers") or {}
auths = {**(cfg.get("auths") or {})}

def resolve(reg, helper_name):
    bin_name = f"docker-credential-{helper_name}"
    try:
        out = subprocess.run(
            [bin_name, "get"], input=reg, capture_output=True, text=True, check=True
        ).stdout
    except (FileNotFoundError, subprocess.CalledProcessError):
        return None
    try:
        cred = json.loads(out)
    except json.JSONDecodeError:
        return None
    user, secret = cred.get("Username"), cred.get("Secret")
    if not user or not secret:
        return None
    return base64.b64encode(f"{user}:{secret}".encode()).decode()

for reg, entry in list(auths.items()):
    if entry.get("auth"):
        continue
    per_reg_helper = helpers.get(reg) or helper
    if not per_reg_helper:
        continue
    token = resolve(reg, per_reg_helper)
    if token:
        auths[reg] = {"auth": token}

with open(dst, "w") as fh:
    json.dump({"auths": auths}, fh)
PY

run_stage() {
  stage_name="$1"
  shift
  echo ""
  echo "=== $stage_name ==="
  if "$@"; then
    echo "✅ $stage_name"
  else
    status=$?
    echo "❌ $stage_name (exit $status)"
    exit "$status"
  fi
}

devcontainer_run() {
  docker run --rm \
    --entrypoint /bin/sh \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$(pwd)/$SHARED_DOCKER_CONFIG:/root/.docker/config.json:ro" \
    -v "$(pwd):/app/" \
    -e IS_RUNNING_IN_GITHUB_ACTIONS=true \
    "$@"
}

run_stage "Build devcontainer" \
  docker buildx build -t devcontainer:local-test .devcontainer/

run_stage "Run Python lint" \
  devcontainer_run --name devcontainer_lint \
    devcontainer:local-test /app/scripts/runPythonLint.sh

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
echo "✅ All stages passed"
