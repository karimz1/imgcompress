FROM ghcr.io/karimz1/devcontainer-image-only-for-devs@sha256:1466f80cb21f351d42664f270faa7182aa6e3eece12dba23a3633168f3785e4c
  
# Python virtual environment  
WORKDIR /app  
RUN python3 -m venv /venv  
ENV PATH="/venv/bin:$PATH"  
  
# Install Python dependencies  
COPY requirements-dev.txt .  
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements-dev.txt  
  
  
ENTRYPOINT ["/bin/sh"]