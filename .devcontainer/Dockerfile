# ------------------------------------------------------
# Base Image: Use dnd image and set up dependencies
# ------------------------------------------------------
    FROM docker:27.5.0-rc.1-dind

    # 1) Install Python and system dependencies
    RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
        libheif-dev \
        git \
        ca-certificates \
        curl \
        gnupg \
        wget \
        lsb-release \
        && rm -rf /var/lib/apt/lists/*
    
    # 2) Install Docker daemon (if needed)
    RUN mkdir -m 0755 -p /etc/apt/keyrings \
        && curl -fsSL https://download.docker.com/linux/debian/gpg \
           | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
        && echo \
           "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
           https://download.docker.com/linux/debian $(lsb_release -cs) stable" \
           | tee /etc/apt/sources.list.d/docker.list > /dev/null \
        && apt-get update && apt-get install -y --no-install-recommends docker-ce \
        && rm -rf /var/lib/apt/lists/*
    
    # 3) Install GitHub CLI (gh)
    RUN mkdir -p -m 755 /etc/apt/keyrings \
        && wget -nv -O /etc/apt/keyrings/githubcli-archive-keyring.gpg https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
        && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
           > /etc/apt/sources.list.d/github-cli.list \
        && apt-get update \
        && apt-get install -y gh \
        && rm -rf /var/lib/apt/lists/*
    
    # 4) Copy application code and install Python dependencies
    WORKDIR /usr/src/app
    COPY . .
    RUN python3 -m pip install --no-cache-dir -r requirements-dev.txt
    
    # 5) Default command
    CMD [ "python3", "imgcompress.py", "--help" ]
    