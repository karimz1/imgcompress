# Installation

Run the [**imgcompress Web UI**](web-ui.md) using Docker.  
No local dependencies, no mess, just a high-performance image optimization suite ready in seconds.

## 🚀 Quick Start (Recommended)

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
    3.  👉 **[Access the UI](#accessing-the-ui)**

=== ":material-console: Single Container (`docker run`)"

    Ideal for quick testing or lightweight environments.

    ```bash
    docker run -d \
      --name imgcompress \
      -p 3001:5000 \
      karimz1/imgcompress:latest
    ```

    !!! tip "Pro Tip: Minimal Mode"
        To disable the mascot and use a cleaner, text-only interface, add `-e DISABLE_LOGO=true` to your command:
        ```bash
        docker run -d --name imgcompress -p 3001:5000 -e DISABLE_LOGO=true karimz1/imgcompress:latest
        ```

    👉 [**Access the UI**](#accessing-the-ui)

---

## 🌐 Accessing the UI

Once the container is running, open your web browser and navigate to:

👉 **[http://localhost:3001](http://localhost:3001)**

---

## 🔄 Maintenance & Updates

Keep your instance secure and up-to-date.

| Method | Command                                                                                                                                                                   |
| :--- |:--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Docker Compose** | `docker compose pull && docker compose up -d`                                                                                                                             |
| **Docker Run** | `docker pull karimz1/imgcompress:latest && docker rm -f imgcompress && docker run -d --name imgcompress -p 3001:5000 --restart unless-stopped karimz1/imgcompress:latest` |

## 🔖 Choosing Your Version

!!! recommended
    Use `latest` unless you have a specific reason not to.

| Tag | Description | Best For |
| :--- | :--- | :--- |
| **Stable (`latest`)** | Fully tested release. Each version is manually QA-verified. | Most users. |
| **Pinned (`X.Y.Z`)** | An exact version that never changes (e.g., `0.3.1`). | Production & Reproducibility. |
| **Nightly (`nightly`)** | Latest changes & dependency bumps. | Beta testing new features. |

### **Pinned Release (e.g., `0.3.1`)**

A version that **never changes**. Ideal for production environments requiring strict reproducibility.

```bash
docker run -d --name imgcompress -p 3001:5000 karimz1/imgcompress:0.3.1
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

## 🛡️ Isolated & High-Security Deployment (Zero-Networking)

For enterprises, government agencies, or individuals requiring strict data isolation (e.g., air-gapped systems or HIPAA/GDPR compliance), imgcompress supports a **Zero-Networking** mode.

This specialized setup:

*   **Disables all outbound traffic** from the application container.
*   **Protects against data exfiltration** at the infrastructure level.
*   **Maintains local accessibility** via a secure internal bridge.

👉 **View the [Zero-Networking / Air-Gapped Setup](privacy.md#zero-networking-air-gapped-setup) guide.**
