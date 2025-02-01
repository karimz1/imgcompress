############################################################
# 1) Stage FRONTEND BUILD (with Node)
############################################################
FROM node:22 AS frontend-build

WORKDIR /app
# Copy the frontend code into this stage
COPY frontend/ ./frontend

WORKDIR /app/frontend

# Install and build
RUN npm install --legacy-peer-deps
RUN npm run build
# The static site is now in /app/frontend/out/

############################################################
# 2) Stage FINAL PYTHON IMAGE
############################################################
FROM python:3.9-slim-bullseye

LABEL maintainer="Karim Zouine <mails.karimzouine@gmail.com>"
LABEL version="1.0.0"
LABEL description="imgcompress is a lightweight, efficient, and scalable image compression tool available as a Docker image. It compresses and optimizes images while maintaining high quality and supports HEIC-to-JPG conversion for seamless compatibility."

LABEL org.opencontainers.image.title="Image Compression Tool"
LABEL org.opencontainers.image.description="A Dockerized tool for compressing and optimizing images with Python libraries. Features include batch processing, HEIC-to-JPG conversion, configurable quality settings, and automatic output directory creation."
LABEL org.opencontainers.image.url="https://github.com/karimz1/imgcompress"
LABEL org.opencontainers.image.source="https://github.com/karimz1/imgcompress"
LABEL org.opencontainers.image.documentation="https://github.com/karimz1/imgcompress"
LABEL org.opencontainers.image.licenses="MIT"

# Install system dependencies needed for HEIC support
RUN apt-get update && apt-get install -y --no-install-recommends \
    libheif-dev \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /container

# Copy Python code from the host
# - backend/ for Flask & CLI code
# - setup.py to install the package
# - requirements.txt for Python dependencies
COPY backend/ /container/backend
COPY setup.py /container/
COPY requirements.txt /container/

# Install Python dependencies + packages
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir .

RUN mkdir -p /container/backend/image_converter/web_app/static_site

# Copy the compiled Next.js site from Stage 1
COPY --from=frontend-build /app/frontend/out/. \
     /container/backend/image_converter/web_app/static_site

# Expose 5000 for "web" mode
EXPOSE 5000

ENTRYPOINT ["image-converter"]
