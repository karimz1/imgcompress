FROM python:3.9-slim-bullseye

# Install system dependencies needed for HEIC support
RUN apt-get update && apt-get install -y --no-install-recommends \
    libheif-dev \
    && rm -rf /var/lib/apt/lists/*


WORKDIR /app

COPY ../ /app/

# Install Python packages
RUN pip install -r /app/requirements-dev.txt

ENTRYPOINT ["python", "imgcompress.py"]