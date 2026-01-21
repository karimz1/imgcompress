---
title: "Release Notes & Updates | ImgCompress"
description: Official version history and update documentation for ImgCompress.
---

# Release Notes

This document tracks all notable changes to ImgCompress, including new features, bug fixes, and performance optimizations.

---

## Maintenance and Upgrades

Users may review the [Change Log](#change-log) below for a detailed history of updates. To upgrade an existing installation to the latest version, please refer to the [**Update Guide**](installation.md#maintenance-updates).

## Version Verification Logic

ImgCompress includes an automated check to notify of new releases. This process is designed with a focus on privacy and technical transparency:

1. **Local Identification:** The application parses the bundled `release-notes.md` file to determine the currently deployed version.
2. **Remote Comparison:** The system performs a GET request to `https://imgcompress.karimzouine.com/api/latest-version.json` to retrieve the most recent stable version number.
3. **Notification:** If a newer version is identified, a notification banner is displayed within the Web UI providing a direct link to the official documentation.

!!! info "Privacy Standards"
    The update check is strictly limited to a version string comparison. No user data, metadata, or system telemetry is transmitted during this process.

---

## Change Log

--8<-- "frontend/public/release-notes.md"