FROM python:3.9-slim-bullseye

# Install system dependencies needed for HEIC support
RUN apt-get update && apt-get install -y --no-install-recommends \
    libheif-dev \
    && rm -rf /var/lib/apt/lists/*


WORKDIR /app

COPY ../ .


ENTRYPOINT ["python", "imgcompress.py"]