FROM docker:27.4.1-dind

# Install Python 3, pip, libheif-dev, and essential build tools
RUN apk update && apk add --no-cache \
    python3 \
    py3-pip \
    python3-dev \
    libheif-dev \
    build-base \
    && rm -rf /var/cache/apk/*

WORKDIR /app

COPY . /app

# (Optional) Install Python dependencies if you have a requirements.txt
# COPY requirements.txt /app/
# RUN pip3 install --no-cache-dir -r requirements.txt

# Set the entry point to run your Python script
ENTRYPOINT ["python3", "imgcompress.py"]
