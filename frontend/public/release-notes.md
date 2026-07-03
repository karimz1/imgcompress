## v0.8.3 — 2026-07-01

- UI: Redesigned the per-file crop editor for mobile. [#737](https://github.com/karimz1/imgcompress/issues/737)
- AI background removal: Files whose background was removed now get an `_ai-bg-removed` suffix in their name, so they are easy to tell apart from regular compressions. The tag follows the converter that actually ran, so it stays correct across output formats, and the target-size compression path (which never removes the background) no longer gets the suffix by mistake.
- UI: Moved the "Clear Processed Files" action in the storage manager below the file list and restyled it as a full-width button, so it reads more clearly and is harder to trigger by accident.
- UX: Downloading a file that was already deleted or has expired now shows a friendly "This file is no longer here" dialog instead of a raw JSON error page. The same dialog appears from both the compressed-files drawer and the storage manager, and the stale entries are cleared so there is nothing left to click again.
- i18n: Fixed a hydration issue where the page could briefly render in the wrong language. The app now renders the default locale first, then switches to your saved or browser-detected language right after loading, without a hydration mismatch.
- Internals: Added a max log size in the backend for the Runtime Error Screen so diagnostics stay bounded. [#740](https://github.com/karimz1/imgcompress/issues/740)
- Dependencies: Updated frontend packages and applied security patches. Dropped the temporary `postcss` override now that Next ships a patched transitive dependency.

## v0.8.2 — 2026-06-04

- UI: Replaced emoji language flags with cross-platform [`flag-icons`](https://github.com/lipis/flag-icons) so flag rendering is consistent across Windows, Linux, and macOS. Reported via email by Armin. [#669](https://github.com/karimz1/imgcompress/issues/669)
- Docker: Bootstrapped a local `docker-container` buildx builder via `scripts/ensureBuildxBuilder.sh` and threaded `--builder` through the Makefile and dev scripts, so builds no longer require Docker Cloud or hit Cloud Build quotas. [#670](https://github.com/karimz1/imgcompress/issues/670)
- Security: Bumped DHI base image digests (Debian 13.4 → 13.5), `uv` 0.11.11 → 0.11.18, and 6 runtime Python packages (`pycparser`, `pillow_heif`, `psd-tools`, `rembg`, `onnxruntime`, `fpdf2`). Trivy now reports 0 vulnerabilities, down from 1 HIGH (libcap2 CVE-2026-4878). [#671](https://github.com/karimz1/imgcompress/issues/671)
- Docs: Added a dedicated Per-File Cropping section to the README with walkthrough, screenshot, and YouTube demo link.

## v0.8.1 — 2026-05-30

This patch release addresses a dependency oversight from [v0.8.0](https://github.com/karimz1/imgcompress/releases/tag/release_0.8.0), forgot to update the ``release-notes.md`` which triggers ``Update available`` even on the latest version.

### 🐛 Bug Fixes
- Fixed incorrect version display causing false "Update Available" notification — see [#668](https://github.com/karimz1/imgcompress/issues/668)

## v0.8.0 — 2026-05-30

- Feature: Added multi-language support to the imgcompress web UI.
  Special thanks to [nagyonmarci](https://github.com/nagyonmarci) for contributing the initial [i18n support](https://github.com/karimz1/imgcompress/issues/653) and the Hungarian translation.

- Added additional language files [@karimz1](https://github.com/karimz1).
  Some translations were created with the help of online translation tools, so they may not be perfect. If you notice anything incorrect or unnatural, contributions are welcome.

- Internals: Updated Frontend Dependencies to latest security patch.

| Locale | Language | Credit | Status |
| --- | --- | --- | --- |
| `en` | English | [karimz1](https://github.com/karimz1) | Source language |
| `hu` | Hungarian | [nagyonmarci](https://github.com/nagyonmarci) | Community translation |
| `de` | German | Online tools | Not validated |
| `ar` | Arabic | Online tools | Not validated |
| `es` | Spanish | Online tools | Not validated |
| `es-MX` | Spanish (Mexico) | Online tools | Not validated |
| `fr` | French | Online tools | Not validated |
| `hi` | Hindi | Online tools | Not validated |
| `ja` | Japanese | Online tools | Not validated |
| `pt-BR` | Portuguese (Brazil) | Online tools | Not validated |
| `ru` | Russian | Online tools | Not validated |
| `zh-CN` | Chinese (Simplified) | Online tools | Not validated |

## v0.7.0 — 2026-05-24
- Feature: Image Crop Editor for per-file cropping before conversion. [#625](https://github.com/karimz1/imgcompress/issues/625)
- Docker Improvements: First-time contributor [@AlexanderSlokov](https://github.com/AlexanderSlokov) hardened the image (non-root, reduced OS attack surface) across AMD64 and ARM64, and refactored the healthcheck, entrypoint, and Makefile in [#626](https://github.com/karimz1/imgcompress/pull/626).
- Internal: Refactored the backend toward cleaner architecture using domain DTOs for a better developer experience.
- CI: Added Python lint, a feature flag matrix, and a pre-publish image scan for auditability.
- Internal: Expanded test coverage and added a DEV_MODE flag for triggering error states during UI testing.

## v0.6.1 — 2026-04-18
- Feature: Add GitHub Star Banner to Compressed Files Drawer [#599](https://github.com/karimz1/imgcompress/issues/599)
- Update Dependencies: This update brings all dependencies to the latest release candidates available at the time, improving security, stability, and overall reliability for imgcompress.
- Stability Improvement: Improved Debian Bookworm Docker build reliability by adding apt-get retry and timeout handling. PR by [Lilyandlucy](https://github.com/karimz1/imgcompress/pull/532)

## v0.6.0 — 2026-01-22
- Feature: Enhanced Image to PDF Export: Multi-Page Formatting and Page Controls [#476](https://github.com/karimz1/imgcompress/issues/476)
- Feature: Search and Filter for Supported Formats Dialog [#477](https://github.com/karimz1/imgcompress/issues/477)

## v0.5.0 — 2026-01-21
- Feature: Implement Automatic Update Notifications [#469](https://github.com/karimz1/imgcompress/issues/469)
- Improvements: Simplify UI by removing non-essential UX elements + update mascot logo [#473](https://github.com/karimz1/imgcompress/issues/473)
- Improvements: Speed up ImgCompress API with Granian (Rust HTTP server) [#470](https://github.com/karimz1/imgcompress/issues/470)
- BugFix: Update storage calculation: use processed files + host-derived container capacity [#472](https://github.com/karimz1/imgcompress/issues/472)

## v0.4.0 — 2026-01-04
- Feature: Support AVIF as Output Format [#453](https://github.com/karimz1/imgcompress/issues/453)
- Request: Add a Documentation button to the UI [#457](https://github.com/karimz1/imgcompress/issues/457)
- Internal: Clean Up in Backend [#454](https://github.com/karimz1/imgcompress/issues/454)


## v0.3.1 — 2025-12-30
- Feature: Adds local AI background removal option to CLI [#439](https://github.com/karimz1/imgcompress/issues/439)
- 🚀 Optimize Docker cold start by lazy-loading heavy dependencies in imgcompress. Starts in under 2 Seconds [#437](https://github.com/karimz1/imgcompress/issues/437)

## v0.3.0 — 2025-12-24
- Add AI background removal for PNG output [#429](https://github.com/karimz1/imgcompress/issues/429)

## v0.2.8 — 2025-12-23
- Fallback to Web Mode when no Arg Mode is Provided [#426](https://github.com/karimz1/imgcompress/issues/426)

## v0.2.7.2 — 2025-12-20
- License Update: GNU GPL-3.0 Migration [#410](https://github.com/karimz1/imgcompress/issues/410)

## v0.2.7.1 — 2025-12-19
- BugFix: Broken CLI Mode [#409](https://github.com/karimz1/imgcompress/issues/409)

## v0.2.7 — 2025-12-19
- Feature: Modernize UI Elements + Splash Screen Animation with Particles [#405](https://github.com/karimz1/imgcompress/issues/405)
- Internal: Improve PDF Processing for better Memory optimization ([#407](https://github.com/karimz1/imgcompress/issues/407))
- Internal: DevContainer Integration Tests not same as Github Actions ([#397](https://github.com/karimz1/imgcompress/issues/397))
- Internal: DEPRECATED Migrate to Docker BuildX in Integration Test ([#398](https://github.com/karimz1/imgcompress/issues/398))

## v0.2.6 — 2025-12-15
- Feature: Enables file downloads from storage management([#388](https://github.com/karimz1/imgcompress/issues/388))
- Feature: Improve Release Notes UI for Latest and Archive([#393](https://github.com/karimz1/imgcompress/issues/393))
- BugFix issue where PSD Rendering was not perfect moved to psd-tools py library([#391](https://github.com/karimz1/imgcompress/issues/391))
- BugFix: Issue in Processing large Files in imgcompress([#390](https://github.com/karimz1/imgcompress/issues/390))
- Internal Enhancement: Seperation of Tests (Unit + Docker Integration)([#392](https://github.com/karimz1/imgcompress/issues/392))

## 0.2.5.2 — 2025-12-10
- Feature: Disable Storage Management via Environment Flag([#387](https://github.com/karimz1/imgcompress/issues/387))

## v0.2.5.1 — 2025-12-09
- Improvement: Internet Check Changed from Auto to Manual Trigger ([#384](https://github.com/karimz1/imgcompress/issues/384))

## v0.2.5 — 2025-12-08
- New Feature: Add Container Status & Connectivity Indicator UI ([#382](https://github.com/karimz1/imgcompress/issues/382))

## v0.2.4 — 2025-12-01
- New Feature: Add support for extracting PDF pages as images in imgcompress ([#374](https://github.com/karimz1/imgcompress/issues/374))

## v0.2.3 — 2025-11-27
- New Improvement "Support .PSD file format with verification: ([#361](https://github.com/karimz1/imgcompress/issues/361))

## v0.2.2 — 2025-11-08
- New Feature "Implement .EPS file format support and verification: ([#343](https://github.com/karimz1/imgcompress/issues/343))


## v0.2.1 — 2025-10-12
- Enhances "Support Formats" by using Dialog: ([#325](https://github.com/karimz1/imgcompress/issues/325))

## v0.2.0 — 2025-10-11
- New Feature: Introduced modern dark theme with OS-based default (system) and persistent preference. ([#321](https://github.com/karimz1/imgcompress/issues/321))
- New Feature: Add Release Notes viewer with a button to open it from the bottom-left toolbar  ([#322](https://github.com/karimz1/imgcompress/issues/322))

## v0.1.0 — 2025-10-01
- New Feature: Ability to convert files but allow the user to target a specific max filesize for the outputs ([#316](https://github.com/karimz1/imgcompress/issues/316))
