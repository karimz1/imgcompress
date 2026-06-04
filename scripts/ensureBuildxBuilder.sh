#!/usr/bin/env sh
# Ensure a local buildx builder with the given name exists. Idempotent.
#
# Prefers an existing builder by that name; otherwise creates one with the
# docker-container driver (Docker's recommended portable BuildKit setup).
# This keeps builds local instead of falling through to whatever the active
# default builder is (e.g. a Docker Cloud builder).
set -eu

NAME="${1:-imgcompress-builder}"

if ! command -v docker >/dev/null 2>&1; then
    echo "ensureBuildxBuilder: docker is required but was not found in PATH" >&2
    exit 1
fi

if docker buildx inspect "$NAME" >/dev/null 2>&1; then
    exit 0
fi

echo "🛠  Creating local buildx builder '$NAME' (docker-container driver)"
docker buildx create --name "$NAME" --driver docker-container >/dev/null
