FROM debian:bookworm-slim

# Install essential system packages needed for both Python and Node.js
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv python3-dev \
    build-essential \
    curl \
    libnss3 \
    libatk1.0-0 \
    libgbm1 \
    libasound2 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgtk-3-0 \
    libpango-1.0-0 \
    libxshmfence1 \
    ca-certificates \
    xvfb \
    nodejs npm \
    tmux \
    apt-transport-https \
    gnupg2 \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

# If we're on amd64 or arm64, install the Docker CLI (docker.io).
# Otherwise, skip this step since it's not supported on other architectures.
RUN apt-get update && \
    if [ "$(dpkg --print-architecture)" = "amd64" ] || [ "$(dpkg --print-architecture)" = "arm64" ]; then \
      echo "Installing Docker CLI (docker.io) for $(dpkg --print-architecture)."; \
      apt-get install -y --no-install-recommends docker.io; \
    else \
      echo "Skipping Docker CLI installation on unsupported architecture."; \
    fi

WORKDIR /app

# Create and activate a Python virtual environment
RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"

# Copy in Python requirements and install them
COPY requirements-dev.txt .
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements-dev.txt

# Move into the frontend folder and install Node.js dependencies
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm ci

# Install Playwright browsers to match the locally installed Playwright version
RUN npx playwright install --with-deps

# Return to /app, then copy the rest of the files to complete the build context
WORKDIR /app
COPY . .   

ENTRYPOINT ["/bin/sh"]
