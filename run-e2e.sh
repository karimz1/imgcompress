#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

# Use PLAYWRIGHT_BASE_URL if provided; default to http://localhost:5000
BASE_URL=${PLAYWRIGHT_BASE_URL:-http://localhost:5000}
echo "Using base URL: ${BASE_URL}"

# Run E2E Tests in Dev Container
echo "Running E2E Tests..."
cd frontend 
npm install && npm run test:e2e

# Cleanup: Stop App Container and Remove Network
echo "Cleaning up..."
docker stop app || true
docker network rm e2e-net || true

echo "E2E Tests completed successfully!"
