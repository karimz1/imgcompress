FROM ghcr.io/karimz1/devcontainer-image-only-for-devs:2026-05
#FROM my-base-image

# Ensure the docker compose plugin is present. The published base image at the
# pinned tag predates the Dockerfile.base update that adds it, so install it
# here until that base is rebuilt + published.
RUN apt-get update && \
    apt-get install -y --no-install-recommends docker-compose-plugin && \
    rm -rf /var/lib/apt/lists/*

# Python virtual environment
WORKDIR /app
RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"

# Install Python dependencies
COPY requirements-dev.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements-dev.txt
ENTRYPOINT ["/bin/sh"]
