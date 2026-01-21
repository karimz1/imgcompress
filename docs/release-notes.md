---
title: "Release Notes & Updates | ImgCompress"
description: Official version history and update documentation for ImgCompress.
---

# Release Notes

This document tracks all notable changes to ImgCompress, including new features, bug fixes, and performance optimizations.

---

## Maintenance and Upgrades

Users may review the [Change Log](#change-log) below for a detailed history of updates. To upgrade an existing installation to the latest version, please refer to the [**Update Guide**](installation.md#maintenance-updates).

## Automatic Update Checks (Web UI)

ImgCompress includes an automated check to notify you of new releases. The flow is simple and privacy‑safe:

1. **Local Identification:** The application parses the bundled `release-notes.md` file to determine the currently deployed version.
2. **Remote Comparison:** The Web UI requests the latest published release from the GitHub Releases API: `https://api.github.com/repos/karimz1/imgcompress/releases/latest`.
3. **Notification:** If a newer version is detected, the Web UI displays an update banner with a link to the release notes.

!!! info "Privacy Standards"
    The update check is strictly limited to a version string comparison. No user data, metadata, or system telemetry is transmitted during this process.

---

## Change Log

--8<-- "frontend/public/release-notes.md"
