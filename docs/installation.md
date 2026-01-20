---
title: "Installation: Docker & Python Setup Guide"
description: Learn how to install ImgCompress using Python or Docker. Step-by-step instructions for setting up your private image optimization environment.
---

# Installation: Docker Deployment Guide

Run the [**imgcompress Web App**](web-ui.md) using Docker.  
No local dependencies, no configuration clutter. Just a high-performance image optimization tool ready in seconds.

## Quick Start (Recommended)

!!! info "Fresh Install?" 
    If you have used imgcompress before, ensure you have the newest version by running:

    ````bash
    docker pull karimz1/imgcompress:latest
    ````
=== ":material-docker: Docker Compose (Preferred)"

    Best choice for **long-running setups** and easy upgrades.

    1.  Create a `docker-compose.yml` file:
        ```yaml
        --8<-- "docker-compose.yml"
        ```
    2.  Launch the container:
        ```bash
        docker compose up -d
        ```
    3.  Once the container is running, open your web browser & navigate to:
        **[http://localhost:3001](http://localhost:3001)**

=== ":material-console: Single Container (`docker run`)"
    **Standard Mode (Default: Mascot Enabled)**
    ```bash
    docker run -d \
      --name imgcompress \
      -p 3001:5000 \
      karimz1/imgcompress:latest
    ```

    ??? abstract "Minimal Mode (Hide Mascot)"
        To disable the mascot and use a cleaner, text-only interface, add `-e DISABLE_LOGO=true` to your command:
        ```bash
        docker run -d \
          --name imgcompress \
          -p 3001:5000 \
          -e DISABLE_LOGO=true \
          karimz1/imgcompress:latest
        ```

    Once the container is running, open your web browser & navigate to:
        **[http://localhost:3001](http://localhost:3001)**



## Maintenance & Updates

Keep your instance secure and up-to-date.

| Method | Command                                                                                                                                                                   |
| :--- |:--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Docker Compose** | `docker compose pull && docker compose up -d`                                                                                                                             |
| **Docker Run** | `docker pull karimz1/imgcompress:latest && docker rm -f imgcompress && docker run -d --name imgcompress -p 3001:5000 --restart unless-stopped karimz1/imgcompress:latest` |

## Choosing Your Version

!!! recommended
    Use `latest` unless you have a specific reason not to.

| Tag | Description | Best For |
| :--- | :--- | :--- |
| **Stable (`latest`)** | Fully tested release. Each version is manually QA-verified. | Most users. |
| **Pinned (`X.Y.Z`)** | An exact version that never changes (e.g., `0.4.0`). | Production & Reproducibility. |
| **Nightly (`nightly`)** | Latest changes & dependency bumps. | Beta testing new features. |

### **Pinned Release (e.g., `0.4.0`)**

A version that **never changes**. Ideal for production environments requiring strict reproducibility.

[View all available Tags](https://hub.docker.com/r/karimz1/imgcompress/tags)

```bash
docker run -d \
  --name imgcompress \
  -p 3001:5000 \
  karimz1/imgcompress:0.4.0
```

### **Nightly (`nightly`)**

Includes the newest features and dependency updates.  
⚠️ May include breaking changes. Think of it as a **public beta**.

| Architecture | Platform | Status |
| :--- | :--- | :--- |
| **linux/amd64** | x86-64 (Linux, Windows WSL 2) | ✅ Supported |
| **linux/arm64** | ARM64 (Apple Silicon, RPi 4+, AWS Graviton) | ✅ Supported |

> **Windows Desktop:** Runs via Docker Desktop + WSL 2 (no native Windows-container build needed).

!!! note "Testing Note"
    All platforms above are built and run in CI with QEMU multi-arch emulation and a GitHub Actions matrix. That means the images pass automated tests, but not every architecture has been manually tried on physical hardware.

___

## Isolated Deployment (Zero-Egress)

For organizations with strict compliance requirements (e.g., **HIPAA, GDPR, or SOC2**), `imgcompress` supports a hardened, "Locked-Down" configuration. This setup severs the container's ability to communicate with the public internet, mitigating data exfiltration risks at the infrastructure level.

!!! tip "Looking for a standard setup?" 
    If you do not require network-level isolation, follow the **[Quick Start (Recommended)](#quick-start-recommended)** for a much simpler installation.

### Technical Safeguards

1. **Internal-Only Bridge**: The container is isolated on a private Docker network with no gateway to the outside world.
2. **Disabled DNS**: Prevents the application from resolving any external domains or "phoning home."
3. **Proxy-Gated Access**: UI access is managed through a secure internal bridge, typically requiring a reverse proxy (like Nginx).

!!! danger "Advanced Implementation Only" 
    This is a **Reference Architecture** for security-hardened environments. It introduces significant infrastructure complexity and requires a pre-configured **Nginx Reverse Proxy** or similar gateway. Use this only if your threat model requires total network isolation.

**Implementation (Docker Compose):**

```yaml
--8<-- "docker-compose-no-internet.yml"
```
