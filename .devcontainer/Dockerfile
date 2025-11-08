FROM ghcr.io/karimz1/imgcompress-devcontainer-image:2025-11


# Python virtual environment  
WORKDIR /app  
RUN python3 -m venv /venv  
ENV PATH="/venv/bin:$PATH"  
  
# Install Python dependencies  
COPY requirements-dev.txt .  
RUN npm i pnpm -g && pip install --upgrade pip && pip install -r requirements-dev.txt
  
  
ENTRYPOINT ["/bin/sh"]