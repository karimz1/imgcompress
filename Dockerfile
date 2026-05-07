# Stage 1: FRONTEND BUILD
# ------------------------------------------------------------------------------------------
# Use Docker Hardened Image to ensure the build tools and environment is secure.
# For more details, visit https://hub.docker.com/hardened-images/catalog/dhi/node
#
# The image is Debian 13 and comes with Socket Firewall Free preinstalled and configured.
# Socket Firewall Free is a lightweight tool that protects build machines in real time, 
# blocking malicious dependencies before they reach your build system.
# For more details, visit https://github.com/SocketDev/sfw-free.
#
# Attention required: Node 25 is not a LTS version. Should use Node 24 instead.
# (supported by Docker Hardened Image catalog until 2027).
# For more details, visit https://hub.docker.com/hardened-images/catalog/dhi/node
FROM dhi.io/node:24-debian13-sfw-dev AS frontend-build-stage

ENV NODE_ENV=production

WORKDIR /app
# Copy the frontend code
COPY frontend/ ./frontend

WORKDIR /app/frontend
# Install dependencies and build the static site.
# Note: This hardened node image already has pnpm so no need to install it.
RUN CI=true pnpm install --frozen-lockfile
RUN pnpm run build

# The built static files are in /app/frontend/out/


# Stage 2: PYTHON BACKEND BUILD
# -------------------------------------------------------------
FROM dhi.io/python:3.11-debian13-sfw-dev AS backend-build-stage

# Copy uv from dhi.io/uv, a faster and smarter package manager for Python.
# Heavily recommend the usage of uv instead of pip.
# For more details, visit https://github.com/astral-sh/uv
COPY --from=dhi.io/uv:0-debian13-dev /uv /uvx /bin/

# 🧩 Install system dependencies required for full Pillow image format support
# 
# This layer installs libraries that enable reading/writing many image formats:
#   - libjpeg, libpng, libtiff, libwebp, libopenjp2: common raster formats (JPEG, PNG, TIFF, WebP, JPEG2000)
#   - libimagequant: high-quality PNG quantization
#   - libheif: enables HEIF / HEIC / AVIF image decoding
#   - ghostscript: enables reading vector formats like .EPS, .PS, and .PDF
#   - liblcms2, libfreetype, libharfbuzz, libfribidi: color management + advanced text rendering
#   - libxcb, zlib, libgif: core compression and GIF/X11 support
#
# Together, these libraries ensure Pillow (PIL) can handle nearly every major image type used in production.
# But I haven't tested all in CI, yet.
#
# The dev OS deps were changed to runtime OS deps,
# We can use Ubuntu Chisel (work on Debian packages) to further reduce the deps size.
# About Ubuntu Chisel: https://documentation.ubuntu.com/chisel/latest/tutorial/getting-started/
#
# Or use docker-slim, but it only works if we have strong code coverage.
# For now, I will keep all the packages for backward compatibility.
#
# Feature: Docker cache mounts for faster builds
# (apt doesn't need to resolve metadata again after first successful run)
RUN rm -f /etc/apt/apt.conf.d/docker-clean; \
    echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    set -eux; \
    apt-get update -o Acquire::Retries=5 -o Acquire::http::Timeout=30 && \
    apt-get install -y \
    libjpeg62-turbo libpng16-16 libtiff6 libwebp7 libopenjp2-7 \
    libimagequant0 libheif1 liblcms2-2 \
    libfreetype6  libharfbuzz0b libfribidi0 \
    libxcb1 zlib1g libgif7 \
    ghostscript dumb-init

# Create container directory and set permissions for "non-root" user.
# This user is already created in the Python Docker Hardened Image
# and has UID/GID 65532:65532.
RUN mkdir -p /container && \
    chown -R nonroot:nonroot /container

# Switch to non-root user
USER nonroot

# prevents Python from writing .pyc files, saving disk space and improving load times
# ensures Python output (logs) is sent straight to stdout/stderr without buffering
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set up uv virtual environment
ENV VIRTUAL_ENV=/container/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Use the exact Python from the hardened image to avoid uv downloading a Python version that may have CVEs
RUN uv venv --python /opt/python/bin/python $VIRTUAL_ENV

# Main directory to deploy the application.
WORKDIR /container

# Copy requirements and setup files first to leverage layer caching for dependencies
COPY --chown=nonroot:nonroot requirements.txt .
COPY --chown=nonroot:nonroot setup.py .

# Feat: Docker cache mounts for faster builds (preserve uv cache between builds)
RUN --mount=type=cache,target=/home/nonroot/.cache/uv,uid=65532,gid=65532 \
    uv pip install -r requirements.txt

# Copy backend code
COPY --chown=nonroot:nonroot backend/ ./backend

# Install the backend code itself
RUN --mount=type=cache,target=/home/nonroot/.cache/uv,uid=65532,gid=65532 \
    uv pip install .

# Pre-download rembg model so background removal feature 
# doesn't need to download it at runtime.
ENV U2NET_HOME=/container/.u2net
RUN python - <<'PY'
import json
from rembg import new_session
with open("backend/image_converter/config/rembg.json", "r", encoding="utf-8") as f:
    model_name = json.load(f).get("model_name", "u2net")
new_session(model_name)
print(f"rembg model cached: {model_name}")
PY

# Copy entrypoint and healthcheck scripts
COPY --chown=nonroot:nonroot entrypoint.py ./entrypoint.py
COPY --chown=nonroot:nonroot healthcheck.py ./healthcheck.py

# Create the directory where the static frontend will be placed.
# Since we are nonroot, we need to ensure the parent directories exist and we have permissions.
# The backend folder was copied earlier, so we just need to create the nested structure.
RUN mkdir -p /container/backend/image_converter/presentation/web/static_site

## ---------------------------------------------------------------------------------
## Final stage (use the same tag as backend build stage but without the -dev suffix)
FROM dhi.io/python:3.11-debian13 AS final-stage

# Metadata labels
LABEL org.opencontainers.image.authors="Karim Zouine <mails.karimzouine@gmail.com>"
LABEL org.opencontainers.image.vendor="Karim Zouine"
LABEL org.opencontainers.image.title="imgcompress - High Performance Image Compression & Background Removal"
LABEL org.opencontainers.image.description="Self-hosted, privacy-first tool for image compression, conversion (HEIC/WebP/PDF), and background removal using local AI. Supports 70+ formats."
LABEL org.opencontainers.image.url="https://github.com/karimz1/imgcompress"
LABEL org.opencontainers.image.source="https://github.com/karimz1/imgcompress"
LABEL org.opencontainers.image.documentation="https://github.com/karimz1/imgcompress"
LABEL org.opencontainers.image.licenses="GPL-3.0-or-later"

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Set up uv virtual environment
ENV VIRTUAL_ENV=/container/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
ENV U2NET_HOME=/container/.u2net

WORKDIR /container

# Copy OS deps required from backend builder stage
COPY --from=backend-build-stage /usr/lib/x86_64-linux-gnu/ /usr/lib/x86_64-linux-gnu/
COPY --from=backend-build-stage --chown=65532:65532 /usr/bin/dumb-init /usr/bin/dumb-init

# Copy Virtual Environment compiled from backend builder stage
COPY --from=backend-build-stage --chown=65532:65532 /container/venv /container/venv
COPY --from=backend-build-stage --chown=65532:65532 /container/.u2net /container/.u2net
COPY --from=backend-build-stage --chown=65532:65532 /container/backend/ /container/backend
COPY --from=backend-build-stage --chown=65532:65532 /container/entrypoint.py /container/entrypoint.py
COPY --from=backend-build-stage --chown=65532:65532 /container/healthcheck.py /container/healthcheck.py

# Copy the built frontend static site from frontend builder stage.
COPY --from=frontend-build-stage --chown=65532:65532 /app/frontend/out/. \
    /container/backend/image_converter/presentation/web/static_site

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ["python", "/container/healthcheck.py"]

ENTRYPOINT ["/usr/bin/dumb-init", "--", "python", "/container/entrypoint.py"]