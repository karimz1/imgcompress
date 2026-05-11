#!/bin/sh
# extract_deps.sh
# Runtime Closure Extractor: Hybrid ldd + dpkg-L strategy
#
# Strategy:
#   Phase 1 (ldd)    — discover all .so files actually loaded at runtime
#   Phase 2 (dpkg-S) — trace each .so back to its owning Debian package
#   Phase 3 (dpkg-L) — extract ALL files (binaries, data, fonts, configs)
#                      owned by those packages into TARGET_DIR
#
# This captures what ldd misses (e.g. Ghostscript CMaps/Fonts)
# and what dpkg-L misses (pre-installed base-image .so files like libexpat).
#
# Usage: sh extract_deps.sh [TARGET_DIR]
#   TARGET_DIR defaults to /dpkg-export

set -eu

TARGET_DIR="${1:-/dpkg-export}"

# --- Phase 0: Seed packages ---
# Explicitly listed because their value is in data files (fonts, CMaps, configs),
# not discoverable by ldd alone.
EXPLICIT_PACKAGES="
    libjpeg62-turbo
    libpng16-16
    libtiff6
    libwebp7
    libopenjp2-7
    libimagequant0
    libheif1
    liblcms2-2
    libfreetype6
    libharfbuzz0b
    libfribidi0
    libxcb1
    zlib1g
    libgif7
    ghostscript
    dumb-init
"

# --- Phase 1: Collect all .so paths loaded at runtime via ldd ---
find_runtime_libs() {
    # Scan ELF binaries and shared objects under our application paths.
    # Exclude Python .py files — they are not ELF and cause ldd to error.
    find /usr/bin/gs /usr/bin/dumb-init /container/venv \
        -type f \( -name "*.so*" -o -executable \) \
        ! -name "*.py" \
        2>/dev/null \
    | xargs -r ldd 2>/dev/null \
    | awk '/=>/ { print $(NF-1) }' \
    | grep -v \
        -e 'linux-vdso' \
        -e 'ld-linux' \
        -e 'not found' \
        -e '^$' \
    | sort -u
}

# --- Phase 2: Map each .so path back to its owning Debian package ---
resolve_packages_from_libs() {
    libs="$1"
    resolved=""
    for so in $libs; do
        [ -f "$so" ] || continue
        pkg=$(dpkg-query -S "$so" 2>/dev/null | cut -d: -f1 || true)
        [ -n "$pkg" ] && resolved="$resolved $pkg"
    done
    echo "$resolved"
}

# --- Phase 3: Extract all files owned by a package list into TARGET_DIR ---
extract_package_files() {
    packages="$1"
    unique_pkgs=$(printf '%s\n' $packages | sort -u)

    echo "[extract_deps] Packages to export:"
    printf '%s\n' $unique_pkgs | sed 's/^/  - /'

    for pkg in $unique_pkgs; do
        dpkg -L "$pkg" 2>/dev/null | while IFS= read -r f; do
            [ -f "$f" ] || [ -L "$f" ] || continue
            cp --parents -a "$f" "$TARGET_DIR/" 2>/dev/null || true
        done
    done
}

# --- Main ---
echo "[extract_deps] Starting runtime closure extraction → $TARGET_DIR"
mkdir -p "$TARGET_DIR"

echo "[extract_deps] Phase 1: Scanning ELF binaries with ldd..."
runtime_libs=$(find_runtime_libs)
lib_count=$(printf '%s\n' $runtime_libs | grep -c . || true)
echo "[extract_deps] Found $lib_count unique shared libraries."

echo "[extract_deps] Phase 2: Resolving packages from .so paths..."
ldd_packages=$(resolve_packages_from_libs "$runtime_libs")

echo "[extract_deps] Phase 3: Extracting files..."
all_packages="$EXPLICIT_PACKAGES $ldd_packages"
extract_package_files "$all_packages"

echo "[extract_deps] Done. Files written to: $TARGET_DIR"
