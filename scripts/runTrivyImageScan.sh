#!/usr/bin/env bash
set -euo pipefail

IMAGE_REF="${IMAGE_REF:-docker.io/karimz1/imgcompress:latest}"
SCAN_OUTPUT="${SCAN_OUTPUT:-scan-result.log}"
TRIVY_IMAGE="${TRIVY_IMAGE:-aquasec/trivy:0.70.0@sha256:be1190afcb28352bfddc4ddeb71470835d16462af68d310f9f4bca710961a41e}"

# SCAN_OUTPUT is written inside the container's /work mount, so it must be a path
# relative to the repository root. Absolute host paths will not resolve.
# Overridable so the nightly scan can ask for SARIF without duplicating this file.
TRIVY_FORMAT="${TRIVY_FORMAT:-table}"
TRIVY_SEVERITY="${TRIVY_SEVERITY:-HIGH,CRITICAL}"
TRIVY_EXIT_CODE="${TRIVY_EXIT_CODE:-1}"

if ! docker image inspect "$IMAGE_REF" >/dev/null 2>&1; then
  echo "Image '$IMAGE_REF' is not loaded locally. Run the Docker build step first." >&2
  exit 1
fi

mkdir -p "$(dirname "$SCAN_OUTPUT")"
mkdir -p .trivy-cache

docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$PWD:/work" \
  -v "$PWD/.trivy-cache:/root/.cache/trivy" \
  -w /work \
  "$TRIVY_IMAGE" \
  image \
  --scanners vuln \
  --severity "$TRIVY_SEVERITY" \
  --ignore-unfixed \
  --exit-code "$TRIVY_EXIT_CODE" \
  --format "$TRIVY_FORMAT" \
  --output "/work/$SCAN_OUTPUT" \
  "$IMAGE_REF"

echo "Trivy scan written to $SCAN_OUTPUT"