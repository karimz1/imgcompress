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


WORKDIR /app

COPY image_converter/ /app/image_converter/
COPY setup.py /app/
COPY requirements.txt /app/

RUN pip install -r requirements.txt
RUN pip install .

RUN adduser --disabled-password --gecos '' appuser
RUN chown -R appuser:appuser /app
USER appuser

ENTRYPOINT ["image-converter"]