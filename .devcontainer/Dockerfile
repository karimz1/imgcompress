FROM docker:27.4.1-dind

WORKDIR /app

# Install Python 3, pip, libheif-dev, and essential build tools
RUN apk update && apk add --no-cache \
    python3 \
    py3-pip \
    python3-dev \
    libheif-dev \
    build-base \
    && rm -rf /var/cache/apk/*


RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
&& apt-get install -y nodejs


# Create and activate a virtual environment
RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"

# Debugging: List files before copying
RUN ls -la /app

# Copy and install Python dependencies
COPY requirements-dev.txt .
RUN pip install --upgrade pip
RUN pip install -r requirements-dev.txt

# Copy the rest of the application code
COPY . .

# Set the entrypoint
ENTRYPOINT ["/bin/sh"]