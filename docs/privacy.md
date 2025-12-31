# Privacy & Security

## 🔒 Privacy-First Design

imgcompress is built with privacy as a primary feature, not an afterthought.

- **100% Local Processing**: No uploads, no telemetry. Your files never leave your machine.
- **No Telemetry**: The container has zero outbound analytics or tracking code.
- **Open-Source**: Fully auditable code base.
- **Offline Capable**: Works perfectly without an internet connection.

### Docker Isolation

You can run imgcompress with read-only volumes or in network-disabled mode for extra peace of mind.

## 🏢 Enterprise / High Security Setup

For environments requiring **strict network isolation** (e.g., air-gapped systems, high-privacy compliance), we provide a specialized Docker Compose configuration.

This setup:
1.  **Block completely** internet access for the application container.
2.  Maintains **local access** via a secure proxy bridge.
3.  Is **self-contained** in a single file.

👉 **`docker-compose-no-internet.yml`**

```yaml
--8<-- "docker-compose-no-internet.yml"
```
