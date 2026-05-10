# Stage 1: FRONTEND BUILD
# ------------------------------------------------------------------------------------------
# Docker Hardened Image (DHI) Debian 13 base with Socket Firewall pre-installed
# to protect build environment from malicious dependencies.
# Ref: https://hub.docker.com/hardened-images/catalog/dhi/node
# Constraint: Node 26 is not yet available in DHI, fallback to LTS Node 24 (supported until 2027).
FROM dhi.io/node:24-debian13-sfw-dev AS frontend-build-stage

ENV NODE_ENV=production

WORKDIR /app
COPY frontend/ ./frontend

WORKDIR /app/frontend
# Note: Hardened Node image pre-installs pnpm.
# Intent: Use BuildKit cache mount for the pnpm global store to speed up rebuilds
# when package.json is modified.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    CI=true pnpm install --frozen-lockfile
RUN pnpm run build

# The built static files are in /app/frontend/out/


# Stage 2: PYTHON BACKEND BUILD
# ------------------------------------------------------------------------------------------
# Intent: Fallback to Debian 12 (Bookworm) because dhi.io/python:3.11-debian13 is 
# currently affected by CVE-2026-6100 (CVSS 9.1) without an upstream patch.
# Ref: https://scout.docker.com/vulnerabilities/id/CVE-2026-6100
FROM dhi.io/debian-base:bookworm-debian12-dev AS backend-build-stage

# Use 'uv' for high-performance Python package management instead of standard pip.
# Ref: https://github.com/astral-sh/uv
COPY --from=dhi.io/uv:0-debian12-dev /uv /uvx /bin/

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

# Feature: Docker cache mounts for faster builds.
# (apt doesn't need to resolve metadata again after first successful run)
RUN rm -f /etc/apt/apt.conf.d/docker-clean; \
    echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache

# Info: python3-dev is unaffected by CVE-2026-6100, so we install it safely here.
# Workaround: BuildKit 'COPY' cannot dynamically resolve host-architecture triplet 
# paths (e.g. x86_64 vs aarch64). We export the matching directory to a predictable 
# path (/dpkg-export) to facilitate architecture-agnostic multi-arch copying later.
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    set -eux; \
    apt-get update -o Acquire::Retries=5 -o Acquire::http::Timeout=30 && \
    apt-get install -y \
    python3 \
    libjpeg62-turbo libpng16-16 libtiff6 libwebp7 libopenjp2-7 \
    libimagequant0 libheif1 liblcms2-2 \
    libfreetype6  libharfbuzz0b libfribidi0 \
    libxcb1 zlib1g libgif7 \
    ghostscript dumb-init && \
    mkdir -p /dpkg-export/usr/lib && cp -a /usr/lib/*-linux-gnu /dpkg-export/usr/lib/

# Setup runtime directory for nonroot user (pre-configured in DHI, UID/GID 65532).
RUN mkdir -p /container && \
    chown -R nonroot:nonroot /container

USER nonroot

ENV VIRTUAL_ENV=/container/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
# Constraint: Point to system Python interpreter to prevent uv from downloading 
# a separate binary (which bypasses container image scanning).
RUN uv venv --python /usr/bin/python3.11 $VIRTUAL_ENV

WORKDIR /container

COPY --chown=nonroot:nonroot requirements.txt .
COPY --chown=nonroot:nonroot setup.py .

RUN --mount=type=cache,target=/home/nonroot/.cache/uv,uid=65532,gid=65532 \
    uv pip install -r requirements.txt

COPY --chown=nonroot:nonroot backend/ ./backend

RUN --mount=type=cache,target=/home/nonroot/.cache/uv,uid=65532,gid=65532 \
    uv pip install .

# Pre-download rembg model to prevent download overhead during runtime.
ENV U2NET_HOME=/container/.u2net
# Intent: Since backend code is copied earlier, any code change invalidates layer cache.
# We use a BuildKit cache mount at /cache/u2net so the model is not re-downloaded 
# from the internet, then copy it to the persistent U2NET_HOME inside the image.
RUN --mount=type=cache,target=/cache/u2net,uid=65532,gid=65532 \
    U2NET_HOME=/cache/u2net python - <<'PY' && cp -a /cache/u2net/. /container/.u2net/
import json
from rembg import new_session
with open("backend/image_converter/config/rembg.json", "r", encoding="utf-8") as f:
    model_name = json.load(f).get("model_name", "u2net")
new_session(model_name)
print(f"rembg model cached: {model_name}")
PY

COPY --chown=nonroot:nonroot entrypoint.py ./entrypoint.py
COPY --chown=nonroot:nonroot healthcheck.py ./healthcheck.py

# Create static site directory. Required pre-creation as a nonroot user 
# to avoid permission issues when copying frontend assets.
RUN mkdir -p /container/backend/image_converter/presentation/web/static_site


# Stage 3: FINAL RUNTIME
# ------------------------------------------------------------------------------------------
FROM dhi.io/debian-base:bookworm-debian12 AS final-stage

LABEL org.opencontainers.image.authors="Karim Zouine <mails.karimzouine@gmail.com>" \
      org.opencontainers.image.vendor="Karim Zouine" \
      org.opencontainers.image.title="imgcompress - High Performance Image Compression & Background Removal" \
      org.opencontainers.image.description="Self-hosted, privacy-first tool for image compression, conversion (HEIC/WebP/PDF), and background removal using local AI. Supports 70+ formats." \
      org.opencontainers.image.url="https://github.com/karimz1/imgcompress" \
      org.opencontainers.image.source="https://github.com/karimz1/imgcompress" \
      org.opencontainers.image.documentation="https://github.com/karimz1/imgcompress" \
      org.opencontainers.image.licenses="GPL-3.0-or-later"

ENV VIRTUAL_ENV=/container/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
ENV U2NET_HOME=/container/.u2net

WORKDIR /container

COPY --from=backend-build-stage /dpkg-export/usr/lib/ /usr/lib/
COPY --from=backend-build-stage --chown=65532:65532 /usr/bin/dumb-init /usr/bin/dumb-init

COPY --from=backend-build-stage --chown=65532:65532 /container/venv /container/venv
COPY --from=backend-build-stage --chown=65532:65532 /container/.u2net /container/.u2net
COPY --from=backend-build-stage --chown=65532:65532 /container/backend/ /container/backend
COPY --from=backend-build-stage --chown=65532:65532 /container/entrypoint.py /container/entrypoint.py
COPY --from=backend-build-stage --chown=65532:65532 /container/healthcheck.py /container/healthcheck.py

COPY --from=frontend-build-stage --chown=65532:65532 /app/frontend/out/. \
    /container/backend/image_converter/presentation/web/static_site

EXPOSE 5000

# Constraint: The runtime hardened image lacks a shell (/bin/sh). 
# We execute the healthcheck via python directly.
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ["python", "/container/healthcheck.py"]

ENTRYPOINT ["/usr/bin/dumb-init", "--", "python", "/container/entrypoint.py"]
