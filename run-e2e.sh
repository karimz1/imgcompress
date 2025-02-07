#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

# Use PLAYWRIGHT_BASE_URL if provided; default to http://localhost:5000
BASE_URL=${PLAYWRIGHT_BASE_URL:-http://localhost:5000}
echo "Using base URL: ${BASE_URL}"

# Create Docker Network
echo "Creating Docker Network..."
docker network create e2e-net || true  # Avoid error if it already exists

# Build and Run Application Container
echo "Building and Running Application Container..."
docker build --no-cache -t karimz1/imgcompress:local-test .
docker run --rm -d \
  --network e2e-net \
  --name app \
  -p 5000:5000 \
  karimz1/imgcompress:local-test web

echo "Waiting for the application to be ready on ${BASE_URL}..."
max_attempts=30
attempt_num=1

until curl -s --fail "$BASE_URL" > /dev/null; do
  if (( attempt_num == max_attempts )); then
    echo "Application failed to start after $max_attempts attempts."
    exit -1
  fi
  echo "Waiting for app... attempt $attempt_num"
  attempt_num=$((attempt_num+1))
  sleep 1
done

echo "Application is up! Continuing..."

# Run E2E Tests in Dev Container
echo "Running E2E Tests..."
cd frontend 
npm install && npm run test:e2e

# Cleanup: Stop App Container and Remove Network
echo "Cleaning up..."
docker stop app || true
docker network rm e2e-net || true

echo "E2E Tests completed successfully!"
