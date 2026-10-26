FROM ghcr.io/karimz1/devcontainer-image-only-for-devs:2026-09
#FROM my-base-image

# Install Python dependencies
RUN apt-get update && apt-get install -y --no-install-recommends libcairo2 && \
    rm -rf /var/lib/apt/lists/*
COPY requirements-dev.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements-dev.txt
ENTRYPOINT ["/bin/sh"]
