#!/bin/bash
set -euo pipefail

echo "=== Clearing Docker config to avoid credential helper issues ==="
# Remove any existing Docker configuration that might refer to unavailable credential helpers.
rm -rf "$HOME/.docker"
mkdir -p "$HOME/.docker"
echo '{}' > "$HOME/.docker/config.json"

echo "=== Building Application Docker Image ==="
docker build --no-cache -t karimz1/imgcompress:local-test .

NETWORK="e2e-net"

echo "=== Creating Docker Network: ${NETWORK} ==="
# Create the network; ignore error if it already exists.
docker network create "${NETWORK}" || true

echo "=== Starting Application Container ==="
docker run --rm -d \
  --network "${NETWORK}" \
  --name app \
  -p 5000:5000 \
  karimz1/imgcompress:local-test web

echo "=== Waiting for the Application to be Ready on Port 5000 ==="
max_attempts=30
attempt=1
until curl -s http://localhost:5000 > /dev/null; do
  if [ $attempt -ge $max_attempts ]; then
    echo "Application did not start in time."
    docker stop app || true
    docker network rm "${NETWORK}" || true
    exit 1
  fi
  echo "Attempt $attempt: waiting..."
  attempt=$((attempt+1))
  sleep 1
done
echo "Application is up!"

echo "=== Running E2E Tests in Dev Container ==="
docker run --rm \
  --network "${NETWORK}" \
  -v "$(pwd):/workspaces/imgcompress" \
  -w /workspaces/imgcompress/frontend \
  -e PLAYWRIGHT_BASE_URL=http://app:5000 \
  devcontainer:local-test npm run test:e2e

echo "=== Cleaning up: Stopping Application Container and Removing Network ==="
docker stop app || true
docker network rm "${NETWORK}" || true

echo "=== E2E Tests Completed Successfully ==="
