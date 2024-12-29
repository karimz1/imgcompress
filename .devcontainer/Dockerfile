# Use the Docker-in-Docker image that is Debian-based.
# (Tags change over time—check Docker Hub for the latest.)
FROM docker:23-dind-bullseye

# Install Python 3, pip, libheif-dev, etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-dev \
    libheif-dev \
    && rm -rf /var/lib/apt/lists/*

# (Optional) If you have requirements.txt or need additional Python deps:
# COPY requirements.txt /tmp/requirements.txt
# RUN pip3 install --no-cache-dir -r /tmp/requirements.txt

# Copy your app code into the container
WORKDIR /app
COPY . /app

# (Optional) Install your app if it’s a Python package
# RUN pip3 install --no-cache-dir .

# By default, the official dind images run "dockerd-entrypoint.sh" as entrypoint
# which starts the Docker daemon. We'll keep that entrypoint and just override
# the default CMD to run a shell or your Python script, etc.

# If you want to run a Python script as the container's main process,
# you can do something like:
# CMD ["python3", "imgcompress.py"]

# But if you want to keep the default shell:
CMD ["sh"]