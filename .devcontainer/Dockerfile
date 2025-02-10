# Use Ubuntu 22.04 as the base image
FROM ubuntu:22.04

# Disable interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install system dependencies including build tools, sudo, and libraries for pyenv/HEIC support
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    build-essential \
    sudo \
    git \
    wget \
    libssl-dev \
    zlib1g-dev \
    libbz2-dev \
    libreadline-dev \
    libsqlite3-dev \
    llvm \
    libncurses5-dev \
    libncursesw5-dev \
    xz-utils \
    tk-dev \
    libffi-dev \
    liblzma-dev \
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

# -----------------------------------------------------------
# Install NVM and Node.js v22 as root
# -----------------------------------------------------------
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

# Verify Node.js installation
RUN node --version

# -----------------------------------------------------------
# Install Docker CLI if on supported architectures (amd64/arm64)
# -----------------------------------------------------------
RUN apt-get update && \
    if [ "$(dpkg --print-architecture)" = "amd64" ] || [ "$(dpkg --print-architecture)" = "arm64" ]; then \
      echo "Installing Docker CLI (docker.io)"; \
      apt-get install -y docker.io; \
    else \
      echo "Unsupported architecture for Docker CLI installation, skipping."; \
    fi

# -----------------------------------------------------------
# Install Playwright globally and its browsers/dependencies
# -----------------------------------------------------------
RUN npm install -g playwright && \
    npx playwright install --with-deps

# -----------------------------------------------------------
# Create a non-root user (devuser) with passwordless sudo privileges
# -----------------------------------------------------------
RUN useradd -ms /bin/bash devuser && \
    echo "devuser ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Switch to the non-root user from this point onward
USER devuser
ENV HOME=/home/devuser
WORKDIR /app

# -----------------------------------------------------------
# Install pyenv (Python version manager) for devuser and install Python 3.9.16
# -----------------------------------------------------------
# The following RUN command installs pyenv, then uses it to install and set Python 3.9.16 as the global version.
RUN curl https://pyenv.run | bash && \
    export PYENV_ROOT="$HOME/.pyenv" && \
    export PATH="$PYENV_ROOT/bin:$PATH" && \
    eval "$(pyenv init --path)" && \
    eval "$(pyenv init -)" && \
    pyenv install 3.9.16 && \
    pyenv global 3.9.16

# Ensure that pyenv and its shims are in the PATH for subsequent commands
ENV PYENV_ROOT=/home/devuser/.pyenv
ENV PATH="$PYENV_ROOT/bin:$PYENV_ROOT/shims:$PATH"

# -----------------------------------------------------------
# Create a Python virtual environment using the pyenv-managed Python
# -----------------------------------------------------------
RUN python -m venv /venv
ENV PATH="/venv/bin:$PATH"

# -----------------------------------------------------------
# Install Python dependencies from requirements-dev.txt without caching
# -----------------------------------------------------------
COPY --chown=devuser:devuser requirements-dev.txt .
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements-dev.txt

# Copy the rest of your application files into the container
COPY --chown=devuser:devuser . .

# Set the default entrypoint to bash
ENTRYPOINT ["/bin/bash"]
