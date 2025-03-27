# 1) Stage: FRONTEND BUILD (with Node)
############################################################
# Use the build platform for this stage so that the Node
# build tools run on the build host.
FROM node:22 AS frontend-build

WORKDIR /app
# Copy the frontend code into this stage
COPY frontend/ ./frontend

WORKDIR /app/frontend

# Install dependencies and build the static site.
RUN npm install
RUN npm run build
# The built static files are in /app/frontend/out/

############################################################
# 2) Stage: FINAL PYTHON IMAGE
############################################################
# Build the final image for the target platform.
FROM python:3.9-slim-buster

# Metadata labels
LABEL maintainer="Karim Zouine <mails.karimzouine@gmail.com>"
LABEL version="1.0.0"
LABEL description="imgcompress is a lightweight, efficient, and scalable image compression tool available as a Docker image. It compresses and optimizes images while maintaining high quality and supports HEIC-to-JPG conversion for seamless compatibility."

LABEL org.opencontainers.image.title="Image Compression Tool"
LABEL org.opencontainers.image.description="A Dockerized tool for compressing and optimizing images with Python libraries. Features include batch processing, HEIC-to-JPG conversion, configurable quality settings, and automatic output directory creation."
LABEL org.opencontainers.image.url="https://github.com/karimz1/imgcompress"
LABEL org.opencontainers.image.source="https://github.com/karimz1/imgcompress"
LABEL org.opencontainers.image.documentation="https://github.com/karimz1/imgcompress"
LABEL org.opencontainers.image.licenses="MIT"

# Install system dependencies needed for HEIC support.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libheif-dev \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory.
WORKDIR /container

# Copy backend code, setup, and requirements.
COPY backend/ /container/backend
COPY setup.py /container/
COPY requirements.txt /container/

# Install Python dependencies and your package.
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir .

# Create the directory where the static frontend will be placed.
RUN mkdir -p /container/backend/image_converter/presentation/web/static_site

# Copy the built frontend static site from the previous stage.
COPY --from=frontend-build /app/frontend/out/. /container/backend/image_converter/presentation/web/static_site

# Expose port 5000.
EXPOSE 5000

# Define the entrypoint.
ENTRYPOINT ["image-converter"]
