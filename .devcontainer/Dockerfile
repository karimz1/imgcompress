FROM ghcr.io/karimz1/devcontainer-image-only-for-devs:2026-05
#FROM my-base-image

# Install Python dependencies
COPY requirements-dev.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements-dev.txt
ENTRYPOINT ["/bin/sh"]
