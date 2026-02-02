---
icon: lucide/package-open
title: "Installation & Setup Guide"
description: "Step-by-step guide to installing ImgCompress via Docker. Learn how to set up the container on any self-hosted environment in minutes."
tags:
  - Get started
  - Setup
---

# Getting Started: Let's set it up!

<div class="imgcompress-stats" style="justify-content: flex-start;">
  <span class="docker-pull-count">Loading...</span>
</div>

## Installation

To use **imgcompress**, you just need to have [Docker installed](https://docs.docker.com/get-docker/).

Pick the method that works best for you. I recommend using **Docker Compose** if you want to keep the app running on your server.


=== ":material-lan: Docker Compose (Recommended)"
    If you want **imgcompress** to stay on your server or NAS, use a Docker Compose file.

    1.  Create a file named `docker-compose.yml` and paste this inside:
        ```yaml
        --8<-- "docker-compose.yml"
        ```

        !!! info "Customizing your UI"
            You can customize your experience by editing the `environment` section:

            *   **`DISABLE_LOGO=true`**: Switches to the **clean, mascot-free UI** seen on the homepage.
            *   **`DISABLE_STORAGE_MANAGEMENT=true`**: Hides management features if you don't want users to see all processed files.

    2.  Run this command in the same folder:
        ```bash
        docker compose up -d
        ```
    3.  Open your browser and go to [**http://localhost:3001**](http://localhost:3001).



=== ":material-console: Quick Start (docker run)"
    If you just want to try it out quickly, run this command in your terminal:
    
    ```bash
    docker run -d --name imgcompress -p 3001:5000 karimz1/imgcompress:latest web
    ```
    
    Now open your browser and go to [**http://localhost:3001**](http://localhost:3001).

---

## Updates
Updating is quick and easy.

=== ":material-lan: Docker Compose"
    1. **Get the new version**
       ```bash
       docker compose pull
       ```
    2. **Restart**
       ```bash
       docker compose up -d
       ```

=== ":material-console: Docker Run"
    1. **Get the new version**
       ```bash
       docker pull karimz1/imgcompress:latest
       ```
    2. **Swap for the new one**
       ```bash
       docker rm -f imgcompress
       docker run -d --name imgcompress -p 3001:5000 karimz1/imgcompress:latest web
       ```

---

## Versions
Most people should use **Stable (`latest`)**.

| Name | Type | Who is it for? |
| :--- | :--- | :--- |
| **Stable (`latest`)** | Final versions | Recommended for everyone. |
| **Nightly (`nightly`)** | Daily updates | For people who want to test new features. |

---

## Compatibility
Powered using Docker, **imgcompress** works on almost any computer:

- **Standard PCs & Macs**
- **Windows**
- **Linux**
- **Apple Silicon (M1/M2/M3)**
- **Raspberry Pi 4 and newer**
