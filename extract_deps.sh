#!/bin/sh
# extract_deps.sh
# Enumerate files from explicitly installed packages via dpkg -L,
# then copy them into TARGET_DIR preserving directory structure.
#
# This addresses the lead maintainer's request to replace the broad
# "cp -a /usr/lib/*-linux-gnu" with a precise, package-driven enumeration.
#
# Usage: sh extract_deps.sh <PACKAGE...>
#   Example: sh extract_deps.sh ghostscript dumb-init libheif1

set -eu

TARGET_DIR="${EXTRACT_DEPS_TARGET:-/dpkg-export}"
mkdir -p "$TARGET_DIR"

if [ $# -eq 0 ]; then
    echo "[extract_deps] ERROR: no packages specified." >&2
    exit 1
fi

echo "[extract_deps] Extracting files from $# package(s) → $TARGET_DIR"

for pkg in "$@"; do
    file_count=0
    dpkg -L "$pkg" 2>/dev/null | while IFS= read -r f; do
        [ -f "$f" ] || [ -L "$f" ] || continue
        cp --parents -a "$f" "$TARGET_DIR/" 2>/dev/null || true
        file_count=$((file_count + 1))
    done
    echo "[extract_deps]   ✓ $pkg"
done

echo "[extract_deps] Done."
