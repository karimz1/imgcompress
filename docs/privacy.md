# Privacy & Security

imgcompress is engineered with a strict "Privacy by Default" architecture. I believe that privacy is not just a feature, but a fundamental technical requirement.


- All processing is performed strictly on your hardware. Your files are never uploaded, buffered, or transmitted to any external server.

- **Open & Auditable**: My entire source code is open for professional security audits, ensuring complete transparency into how your data is handled.


## 🛡️ Zero-Networking (High-Security)

For air-gapped systems or HIPAA/GDPR compliance, I provide a **Zero-Networking** configuration that hard-blocks all outbound traffic while maintaining local browser access.

!!! note "Advanced Setup Only"
    This configuration requires manual maintenance of Docker networking. For standard privacy-focused use, I recommend following the [Quick Start Guide](installation.md#quick-start).

**Example:**

[docker-compose-no-internet.yml](https://github.com/karimz1/imgcompress/blob/main/docker-compose-no-internet.yml)

```yaml
--8<-- "docker-compose-no-internet.yml"
```
