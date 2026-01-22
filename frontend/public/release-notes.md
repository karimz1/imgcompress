## v0.6.0 — 2026-01-22
- Feature: PDF Extended export — output PDFs (not just images) with A4/original sizing and optional multi-page splits with custom margins [#476](https://github.com/karimz1/imgcompress/issues/476)
- Improvement: Supported Formats dialog now includes search for faster format discovery and cleaner UX. [#477](https://github.com/karimz1/imgcompress/issues/477)

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
