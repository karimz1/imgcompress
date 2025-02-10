FROM debian:bookworm-slim

WORKDIR /app

# Install dependencies for Python, Node.js, and Playwright
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

# Install Docker CLI
RUN apt-get update && \
    ARCH=$(dpkg --print-architecture) && \
    if [ "$ARCH" = "amd64" ] || [ "$ARCH" = "arm64" ]; then \
      echo "Installing Docker CLI (docker.io) for $ARCH"; \
      apt-get install -y docker.io; \
    elif [ "$ARCH" = "armhf" ] || [ "$ARCH" = "armv7l" ]; then \
      echo "Installing Docker CE for $ARCH using Docker's official script"; \
      apt-get install -y curl && \
      curl -fsSL https://get.docker.com -o get-docker.sh && \
      sh get-docker.sh; \
    else \
      echo "Unsupported architecture for Docker CLI installation, skipping."; \
    fi

# Conditionally install Playwright (skip on ARMv7/armhf)
RUN ARCH=$(dpkg --print-architecture) && \
    if [ "$ARCH" = "armv7l" ] || [ "$ARCH" = "armhf" ]; then \
      echo "Skipping Playwright installation on $ARCH (not officially supported)"; \
    else \
      npm install -g playwright && \
      npx playwright install --with-deps; \
    fi

# Create and activate a Python virtual environment
RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"

# Copy Python dependencies and install them
COPY requirements-dev.txt .
RUN pip install --upgrade pip && pip install -r requirements-dev.txt

# Copy application files
COPY . .

# Debugging: Show Playwright installations (if installed)
RUN ls -la /root/.cache/ms-playwright

# Set the entrypoint
ENTRYPOINT ["/bin/sh"]
