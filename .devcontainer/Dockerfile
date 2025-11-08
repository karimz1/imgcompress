FROM ghcr.io/karimz1/imgcompress-devcontainer-image:2025-11


# Python virtual environment  
WORKDIR /app  
RUN python3 -m venv /venv  
ENV PATH="/venv/bin:$PATH"  


RUN npm i pnpm -g

# Install Python dependencies  
COPY requirements-dev.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements-dev.txt  
  
  
ENTRYPOINT ["/bin/sh"]