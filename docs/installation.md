---
title: "Installing Imgcompress with Docker"
description: How to set up ImgCompress on Docker, Synology NAS, or Linux. Get your private image optimizer running in under a minute.
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



### Maintenance & Updates

Keep your instance secure and benefit from the latest features.

=== "Docker Compose (Recommended)"

    1. **Pull the latest version**
       ```bash
       docker compose pull
       ```
    2. **Restart the service**
       ```bash
       docker compose up -d
       ```

=== "Docker Run"

    1. **Download the image**
       ```bash
       docker pull karimz1/imgcompress:latest
       ```
    2. **Replace the container**
       ```bash
       docker rm -f imgcompress
       docker run -d \
         --name imgcompress \
         -p 3001:5000 \
         --restart \
         unless-stopped \
         karimz1/imgcompress:latest
       ```
     3. Once the container is running, open your web browser & navigate to: http://localhost:3001  

---

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

## Hardened & Offline Deployment (High-Security)

For organizations requiring extreme data isolation (e.g., **HIPAA, GDPR, or SOC2**), `imgcompress` supports a fully air-gapped configuration. This workflow severs the container's ability to communicate with the public internet.

!!! danger "Advanced Implementation Only"
    This architecture mandates total network isolation. **By choosing this method, the Web UI cannot notify you of new releases.** You will need to manually monitor the [GitHub Releases](https://github.com/karimz1/imgcompress/releases) to stay current. See [How Updates Notification Work](release-notes.md#transparent-update-checks) for more details.

??? note "Technical Implementation"
    For zero-egress deployments, start with the hardened sample configuration below:

    ```yaml
    --8<-- "docker-compose-no-internet.yml"
    ```

!!! info "Post-Installation Verification"
    Once deployed, you should audit your network status using the built-in monitoring tools. For detailed instructions on verifying your isolation status, see the **[High-Security & Offline Usage Guide](web-ui.md#high-security-offline-usage)**.
