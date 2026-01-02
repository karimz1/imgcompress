# Installation

This guide covers setting up the [imgcompress Web UI](web-ui.md) using Docker.

## 🚀 Quick Start

### Using `docker compose`

```yaml
--8<-- "docker-compose.yml"
```

Start:
```bash
docker compose up -d 
```

Then open:

👉 **[http://localhost:3001](http://localhost:3001/)**

See the [Web UI Guide](web-ui.md) for usage instructions.



### Using `docker run`

```bash
docker run -d --name imgcompress -p 3001:5000 karimz1/imgcompress:latest
```

#### 🧼 Minimal Mode: Hide the Mascot

Prefer a cleaner UI?

```bash
docker run -d --name imgcompress -p 3001:5000 -e DISABLE_LOGO=true karimz1/imgcompress:latest
```

___

## 🔄 Updating imgcompress

Get the latest stable release.

### Using `docker compose`
```bash
docker compose pull
docker compose up -d --force-recreate
```

### Using `docker run`

```bash
docker pull karimz1/imgcompress:latest
docker stop imgcompress
docker rm imgcompress
docker run -d --name imgcompress -p 3001:5000 karimz1/imgcompress:latest
```
> **Open imgcompress:** **[http://localhost:3001](http://localhost:3001/)**

## 🔖 Choosing Your Version

imgcompress provides **three tags**, depending on your needs.

[See all available tags on Docker Hub](https://hub.docker.com/r/karimz1/imgcompress/tags)

> **Recommendation**: I personally recommend using `latest` to ensure you receive the latest stable updates, bug fixes, and features.

The available tags are:

| **Version**        | **Tag** | **What’s Included**           | **Best For**                     |
| ------------------ | ------- | ----------------------------- | -------------------------------- |
| **Stable**         | `latest`  | Fully tested release          | Most users — recommended         |
| **Pinned Release** | `X.Y.Z`   | Exact version, never changes | Reproducible deployments, historic versions |
| **Nightly**        | `nightly` | Latest changes & dependency bumps | Testing new features (may break) |

### **Stable (`latest`)**
The safest and most reliable choice.  
Every latest release passes **QA checks by the author (Karim Zouine)** before publication.

### **Pinned Release (for example: `0.3.1`)**
A frozen version that **never updates**.  
Ideal for locked-down deployments or staying on a version you trust.

### **Nightly (`nightly`)**
Includes the newest changes and dependency updates.  
⚠️ May include breaking changes — think of it as a **public beta**.

## 🖥️ Supported Platforms

| Docker image platform | Typical host | Status |
|-----------------------|--------------|:------:|
| **linux/amd64**       | x86-64 Linux, Windows (WSL 2) | ✅ |
| **linux/arm64**       | Apple Silicon, Raspberry Pi 4+, AWS Graviton | ✅ |

> **Windows desktop:** Runs via Docker Desktop + WSL 2 (no native Windows-container build needed).

!!! note "Testing note"

    All platforms above are built and run in CI with QEMU multi-arch emulation and a GitHub Actions matrix.  
    That means the images pass automated tests, but not every architecture has been manually tried on physical hardware.

___

## 🛡️ Isolated & High-Security Deployment (Zero-Networking)

For enterprises, government agencies, or individuals requiring strict data isolation (e.g., air-gapped systems or HIPAA/GDPR compliance), imgcompress supports a **Zero-Networking** mode.

This specialized setup:

- **Disables all outbound traffic** from the application container.
- **Protects against data exfiltration** at the infrastructure level.
- **Maintains local accessibility** via a secure internal bridge.

👉 **View the [Zero-Networking / Air-Gapped Setup](privacy.md#zero-networking-air-gapped-setup) guide.**
