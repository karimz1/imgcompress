FROM docker:27.5.0-rc.1-dind

# Install Python, pip, and system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    py3-setuptools \
    py3-virtualenv \
    libheif \
    git \
    curl \
    wget \
    gcc \
    musl-dev \
    linux-headers \
    openssl-dev

# Set up a Python virtual environment
RUN python3 -m venv /usr/src/app/venv \
    && /usr/src/app/venv/bin/pip install --no-cache-dir --upgrade pip setuptools

# Set environment variables for the virtual environment
ENV PATH="/usr/src/app/venv/bin:$PATH"

# Set the working directory
WORKDIR /usr/src/app

# Copy the application code
#COPY requirements-dev.txt /usr/src/app/requirements-dev.txt
COPY . .

# Install Python dependencies inside the virtual environment
#RUN pip install --no-cache-dir -r requirements-dev.txt

# Default command
CMD ["python", "imgcompress.py", "--help"]