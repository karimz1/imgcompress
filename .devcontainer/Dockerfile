FROM ubuntu:22.04

# Disable interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install system dependencies for Python, build tools, and required libraries
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    build-essential \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
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
    xvfb \
    tmux \
    apt-transport-https \
    gnupg2 \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

# Install NVM and Node.js v22
ENV NVM_DIR=/root/.nvm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.4/install.sh | bash && \
    . "$NVM_DIR/nvm.sh" && \
    nvm install 22 && \
    nvm alias default 22 && \
    \
    # Create symlinks so that node, npm, and npx are globally available
    ln -s "$NVM_DIR/versions/node/$(nvm version default)" /usr/local/node && \
    ln -s /usr/local/node/bin/node /usr/local/bin/node && \
    ln -s /usr/local/node/bin/npm /usr/local/bin/npm && \
    ln -s /usr/local/node/bin/npx /usr/local/bin/npx


RUN node --version

# install the Docker CLI if on supported architectures (amd64 or arm64)
RUN apt-get update && \
    if [ "$(dpkg --print-architecture)" = "amd64" ] || [ "$(dpkg --print-architecture)" = "arm64" ]; then \
      echo "Installing Docker CLI (docker.io)"; \
      apt-get install -y docker.io; \
    else \
      echo "Unsupported architecture for Docker CLI installation, skipping."; \
    fi

# Install Playwright globally and then install its browsers and required dependencies
RUN npm install -g playwright && \
    npx playwright install --with-deps


RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"

COPY requirements-dev.txt .
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements-dev.txt

COPY . .


ENTRYPOINT ["/bin/bash"]