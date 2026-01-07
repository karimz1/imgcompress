---
title: Developer Guide - Building & Testing ImgCompress
description: Comprehensive guide for developers to build, run, and test ImgCompress locally. Includes commands for unit, integration, and E2E tests using Docker.
---

# 🛠️ Developer Guide

Welcome to the **ImgCompress** developer documentation. This guide is designed to help you set up your local development environment, build the Docker images, and run the automated test suite.

We use **Docker** heavily to ensure a consistent environment across all development stages.

---

## 🧪 Local Build & Run

To quickly build and run the application locally (simulating the production container), we provide a helper script. This is useful for verifying UI changes or environment variable configurations.

### Quick Start Script

Use `runLocalDockerBuildTester.sh` to build the `local-test` image and start the container.

```bash
./runLocalDockerBuildTester.sh
```

**What this does:**
1.  Builds the Docker image tagged as `karimz1/imgcompress:local-test`.
2.  Starts the container on **http://localhost:3001**.
3.  Sets default environment variables (e.g., `DISABLE_LOGO=false`).

### Customizing the Run

You can override environment variables at runtime. For example, to test the application with the **mascot hidden**:

```bash
DISABLE_LOGO=true ./runLocalDockerBuildTester.sh
```

> **Note:** The container is run with `--rm`, so it will be automatically removed when you stop it.

---

## 🏗️ Running Tests (CI Simulation)

We use a **Dev Container** approach to run tests, ensuring that your local tests match the CI pipeline (GitHub Actions).

### 1. Integration Tests

These tests verify the interaction between different components of the system.

```bash
# 1. Build the base and devcontainer images
cd .devcontainer/
docker build -f Dockerfile.base -t my-base-image .
docker build -t devcontainer:local-test .

# 2. Run the integration tests
cd ..
docker run --rm --entrypoint /bin/sh \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$(pwd):/app/" \
    -e IS_RUNNING_IN_GITHUB_ACTIONS=false \
    --name devcontainer \
    devcontainer:local-test /app/runIntegrationTests.sh
```

### 2. Unit Tests

Unit tests focus on individual functions and logic, primarily in the backend.

```bash
# 1. Build images (if not already done)
cd .devcontainer/
docker build -f Dockerfile.base -t my-base-image .
docker build -t devcontainer:local-test .

# 2. Run the unit tests
cd ..
docker run --rm --entrypoint /bin/sh \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$(pwd):/app/" \
    -e IS_RUNNING_IN_GITHUB_ACTIONS=false \
    --name devcontainer \
    devcontainer:local-test /app/runUnitTests.sh
```

### 3. End-to-End (E2E) Tests

E2E tests verify the full user flow using a real browser instance managed by Playwright.

**Step 1: Start the Application Container**
First, run the application in "web" mode on the host network (or accessible via specific networking).

```bash
docker run --rm -d \
    --network host \
    --name app \
    karimz1/imgcompress:local-test web
```

**Step 2: Run the E2E Test Suite**
Now launch the test runner.

```bash
docker run --rm \
    --entrypoint /bin/sh \
    --network host \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$(pwd):/app/" \
    -e IS_RUNNING_IN_GITHUB_ACTIONS=false \
    -e PLAYWRIGHT_BASE_URL=http://localhost:5000 \
    --name devcontainer_e2e \
    devcontainer:local-test -c "/app/run-e2e.sh"
```

---

## 🤝 Contribution

If you're ready to submit your changes, please verify that all tests pass. For general guidelines on contributing, please see our [Contribution Guide](contributing.md).
