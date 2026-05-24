#!/bin/sh
# extract_deps.sh — Runtime Closure Extractor
#
# Adapted from the HAProxy Dockerfile approach:
#   find /usr/local -type f -executable -exec ldd '{}' ';' | awk '/=>/ ...'
#
# Phase 1 (ldd): Copy .so files directly from their resolved filesystem paths.
#   — Immune to Debian package renames (e.g. libpng16-16 → libpng16-16t64 in Trixie).
#   — Does NOT require packages to be in a "configured" state.
#
# Phase 2 (dpkg -L): Copy data files (fonts, CMaps, configs, entrypoint binaries).
#   — ldd cannot discover these since they are not shared objects.
#   — Package names here must match what is actually installed (check with dpkg -l).

set -eu

TARGET_DIR="${EXTRACT_DEPS_TARGET:-/dpkg-export}"
SCAN_BINARIES="${1:-/usr/bin/gs}"

# --- Phase 1: Copy all .so runtime deps from ldd (filesystem paths, not package names) ---
copy_so_from_ldd() {
    binary="$1"
    echo "[extract_deps] Scanning: $binary"

    ldd "$binary" 2>/dev/null \
    | awk '/=>/ { print $(NF-1) }' \
    | grep -v \
        -e 'linux-vdso' \
        -e 'ld-linux' \
        -e 'not found' \
        -e '^$' \
    | sort -u \
    | while IFS= read -r so; do
        [ -f "$so" ] || continue

        # Resolve canonical path to handle usrmerge: /lib → /usr/lib symlink.
        # Without this, cp --parents creates /dpkg-export/lib/ as a real directory,
        # which conflicts with the /lib → usr/lib symlink in the hardened runtime image.
        real_so=$(realpath "$so" 2>/dev/null || echo "$so")

        cp --parents -a "$real_so" "$TARGET_DIR/" 2>/dev/null || true

        # Also carry versioned symlinks (e.g. libpng16.so → libpng16.so.16.x.x)
        so_dir=$(dirname "$real_so")
        so_base=$(basename "$real_so" | cut -d. -f1-2)   # e.g. libpng16.so
        find "$so_dir" -maxdepth 1 \( -name "${so_base}*" \) 2>/dev/null \
        | while IFS= read -r link; do
            real_link=$(realpath "$link" 2>/dev/null || echo "$link")
            cp --parents -a "$real_link" "$TARGET_DIR/" 2>/dev/null || true
            # Preserve the symlink itself (not just the target)
            [ -L "$link" ] && cp --parents -a "$link" "$TARGET_DIR/" 2>/dev/null || true
        done
    done
}

# --- Phase 2: Copy data files from named packages via dpkg -L ---
copy_data_from_packages() {
    for pkg in "$@"; do
        dpkg -L "$pkg" 2>/dev/null | while IFS= read -r f; do
            if [ -L "$f" ]; then
                # Symlinks must be preserved as-is (not resolved).
                # e.g. iccprofiles → ../../color/icc/ghostscript is a dir-symlink
                # that realpath would turn into a directory path, breaking cp.
                cp --parents -a "$f" "$TARGET_DIR/" 2>/dev/null || true
            elif [ -f "$f" ]; then
                # Regular files: resolve usrmerge paths (/lib → /usr/lib).
                real_f=$(realpath "$f" 2>/dev/null || echo "$f")
                cp --parents -a "$real_f" "$TARGET_DIR/" 2>/dev/null || true
            fi
        done
        echo "[extract_deps]   ✓ $pkg"
    done
}

# --- Main ---
echo "[extract_deps] Starting extraction → $TARGET_DIR"
mkdir -p "$TARGET_DIR"

echo "[extract_deps] Phase 1: Resolving .so deps via ldd..."
for binary in $SCAN_BINARIES; do
    [ -f "$binary" ] || continue
    copy_so_from_ldd "$binary"
done

echo "[extract_deps] Phase 2: Copying data files from packages..."
# Only list packages that own DATA (fonts, CMaps, configs, executables).
# .so packages are handled by Phase 1 — no need to name them here.
copy_data_from_packages \
    ghostscript \
    libgs10-common \
    libgs-common \
    fonts-urw-base35 \
    fontconfig-config \
    poppler-data \
    dumb-init

echo "[extract_deps] Done."
