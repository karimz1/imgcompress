FROM python:3.9-slim-bullseye

# ------------------------------------------------------
# 1) Install system dependencies for HEIC support, Git,
#    plus any prerequisites to install Docker CLI
# ------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
    libheif-dev \
    git \
    ca-certificates \
    curl \
    gnupg \
    wget \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------
# 2) Install the Docker CLI (not the full Docker daemon)
#    (instructions adapted from https://docs.docker.com/engine/install/debian/)
# ------------------------------------------------------
RUN mkdir -m 0755 -p /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg \
       | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && echo \
       "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
       https://download.docker.com/linux/debian $(lsb_release -cs) stable" \
       | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update && apt-get install -y --no-install-recommends docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------
# 3) Install GitHub CLI (gh) - NO sudo
# ------------------------------------------------------
RUN (type -p wget >/dev/null || (apt-get update && apt-get install -y wget)) \
    && mkdir -p -m 755 /etc/apt/keyrings \
    && out=$(mktemp) \
    && wget -nv -O "$out" https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    && cat "$out" > /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
       > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------
# 4) Copy application code and install Python dependencies
# ------------------------------------------------------
WORKDIR /usr/src/app
COPY . .


# Conditionally copy tests/ if include_tests is true
ARG include_tests
RUN if [ "$include_tests" = "true" ]; then \
    echo "Including tests/ for development"; \
    cp -r ./tests/ /usr/src/app/tests/; \
  fi

RUN pip install pytest
RUN pip install --no-cache-dir -r requirements.txt
RUN chmod +755 ./tests/run_imagecompressor_docker.sh

# 5) Default command
# ------------------------------------------------------
CMD [ "python", "imgcompress.py", "--help" ]
