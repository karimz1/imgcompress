# Developer Guide

Welcome to the **ImgCompress** developer documentation. This guide explains how to run tests and builds to ensure your contributions meet my quality standards. Also this documentation explains how to simulate the CI/CD pipeline locally to ensure that your changes will pass the GitHub Actions workflow.

---

## 1. VS Code Dev Container

The easiest way to set up a consistent development environment is to use the **VS Code Dev Container**. This provides a pre-configured Docker environment with all dependencies (Python, Node.js, Docker) and VS Code extensions installed.

### How to use
1.  Open the project in **VS Code**.
2.  Install the **[Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)** extension.
3.  Click the prompts to "Reopen in Container" (or run the command `Dev Containers: Reopen in Container`).

### What you get
*   **Pre-installed Tools**: Python 3.10+, Node.js, pnpm, and Docker CLI.
*   **Extensions**: Python, Docker, ESLint, Playwright, and more.
*   **Port Forwarding**: Automatically forwards port `3001` (app) and `5000` (backend).
*   **Docker-in-Docker**: You can build and run Docker containers *inside* the dev container (required for running the integration/e2e tests).

---

## 2. Local Development (Scripts)

For rapid development, I provide helper scripts that run the tests directly in your local environment.

### Prerequisites
*   **Python 3.10+** (with `venv` support)
*   **Node.js & pnpm** (for frontend/E2E)
*   **Docker** (for integration tests)

### 🧪 Unit & Integration Tests

```bash
# Run Unit Tests (Backend)
./runUnitTests.sh

# Run Integration Tests
./runIntegrationTests.sh
```

### 🎭 End-to-End (E2E) Tests

Running E2E tests locally is a 3-step process. You need to start the backend and frontend services before running the test suite.

**Step 1: Start the Backend**
Open a new terminal and run:
```bash
./runStartLocalBackend.sh
```

**Step 2: Start the Frontend**
Open a second terminal and run:
```bash
./runStartLocalFrontend.sh
```

**Step 3: Run the E2E Tests**
In a third terminal, execute the test runner:
```bash
./run-e2e.sh
```

---

## 3. CI Simulation (Docker)

To strictly replicate the GitHub Actions CI environment, use the following Docker commands. This ensures that what works locally will also work in the cloud.

### Backend Unit Tests
Matches the `test-backend` job in CI.

```bash
# 1. Build the Dev Container
docker build -t devcontainer:local-test .devcontainer/

# 2. Run Unit Tests
docker run --rm \
  --entrypoint /bin/sh \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$(pwd):/app/" \
  -e IS_RUNNING_IN_GITHUB_ACTIONS=true \
  --name devcontainer \
  devcontainer:local-test /app/runUnitTests.sh
```

### Backend Integration Tests

```bash
docker run --rm \
  --entrypoint /bin/sh \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$(pwd):/app/" \
  -e IS_RUNNING_IN_GITHUB_ACTIONS=true \
  --name devcontainer \
  devcontainer:local-test /app/runIntegrationTests.sh
```

### End-to-End (E2E) Tests
Matches the `test-e2e` job in CI.

**Step 1: Build & Run Application**
```bash
# Build the App Image
docker build -t karimz1/imgcompress:local-test .

# Run the App (Host Networking)
docker run --rm -d \
  --network host \
  --name app \
  karimz1/imgcompress:local-test web
```

**Step 2: Run E2E Tests**
```bash
docker run --rm \
  --entrypoint /bin/sh \
  --network host \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$(pwd):/app/" \
  -e IS_RUNNING_IN_GITHUB_ACTIONS=true \
  -e PLAYWRIGHT_BASE_URL=http://localhost:5000 \
  --name devcontainer_e2e \
  devcontainer:local-test -c "/app/run-e2e.sh"
```
