---
title: "Release Notes & Updates | ImgCompress"
description: Official version history and update documentation for ImgCompress.
---

# Release Notes

This page documents all notable changes, including new features, bug fixes, and performance improvements for the ImgCompress project.

---

## Maintenance and Upgrades

!!! tip "Update Status"
    To upgrade an existing installation, please refer to the [**Update Guide**](installation.md#maintenance-updates).

## Version Verification Logic

ImgCompress includes an automated check to notify of new releases. The process is designed with a focus on privacy and transparency:

1. **Local Identification:** The application reads the local `release-notes.md` file to determine the active version.
2. **Remote Comparison:** The system performs a GET request to `/api/latest-version.json` to retrieve the most recent version number.
3. **Notification:** If the remote version is higher than the local version, a notification banner is displayed within the Web UI.

!!! info "Privacy Standards"
    This check is strictly limited to version string comparison. No user data, telemetry, or file content is transmitted during this process.

---

## Change Log

--8<-- "frontend/public/release-notes.md"