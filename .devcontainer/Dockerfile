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
 
# Docker CLI if on amd64/arm64 
RUN apt-get update && \ 
    if [ "$(dpkg --print-architecture)" = "amd64" ] || [ "$(dpkg --print-architecture)" = "arm64" ]; then \ 
      echo "Installing Docker CLI (docker.io) for $(dpkg --print-architecture)."; \ 
      apt-get install -y --no-install-recommends docker.io; \ 
    else \ 
      echo "Skipping Docker CLI on unsupported architecture."; \ 
    fi 

# install pnpm
RUN npm i pnpm -g

# Python virtual environment 
WORKDIR /app 
RUN python3 -m venv /venv 
ENV PATH="/venv/bin:$PATH" 
 
# Install Python dependencies 
COPY requirements-dev.txt . 
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements-dev.txt 
 
 
ENTRYPOINT ["/bin/sh"]