#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

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

# Wait for Application to be Ready
echo "Waiting for the application to be ready on port 5000..."
for i in {1..30}; do
  if curl -s http://localhost:5000 > /dev/null; then
    echo "Application is up!"
    break
  fi
  sleep 1
done

# Run E2E Tests in Dev Container
echo "Running E2E Tests..."
cd frontend 
npm install && npm run test:e2e

# Cleanup: Stop App Container and Remove Network
echo "Cleaning up..."
docker stop app || true
docker network rm e2e-net || true

echo "E2E Tests completed successfully!"
