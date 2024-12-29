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
    openssl-dev \
    && pip3 install --no-cache-dir --upgrade pip setuptools

# Install Docker daemon and additional tools (if needed)
RUN apk add --no-cache \
    docker \
    iptables \
    ip6tables \
    e2fsprogs \
    e2fsprogs-extra \
    btrfs-progs \
    pigz \
    xfsprogs \
    shadow-uidmap \
    zfs

# Install GitHub CLI
RUN wget -q https://github.com/cli/cli/releases/download/v2.40.0/gh_2.40.0_linux_amd64.tar.gz \
    && tar -xvzf gh_2.40.0_linux_amd64.tar.gz -C /usr/local/bin --strip-components=1 \
    && rm gh_2.40.0_linux_amd64.tar.gz

# Set the working directory
WORKDIR /usr/src/app

# Copy the application code
COPY . .

# Install Python dependencies
RUN pip3 install --no-cache-dir -r requirements-dev.txt

# Default command
CMD ["python3", "imgcompress.py", "--help"]
