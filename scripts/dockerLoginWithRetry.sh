#!/usr/bin/env bash
set -euo pipefail

# docker login with retries. dhi.io's token endpoint sometimes answers 504,
# which would otherwise fail the whole build.
# Usage: REGISTRY_USERNAME=... REGISTRY_PASSWORD=... dockerLoginWithRetry.sh dhi.io

REGISTRY="${1:?registry missing}"
ATTEMPTS="${ATTEMPTS:-5}"

for attempt in $(seq 1 "$ATTEMPTS"); do
  if printf '%s' "$REGISTRY_PASSWORD" | docker login "$REGISTRY" --username "$REGISTRY_USERNAME" --password-stdin; then
    exit 0
  fi
  if [ "$attempt" -lt "$ATTEMPTS" ]; then
    echo "Login to $REGISTRY failed (attempt $attempt/$ATTEMPTS), retrying in $((attempt * 15))s" >&2
    sleep $((attempt * 15))
  fi
done

echo "Login to $REGISTRY failed after $ATTEMPTS attempts" >&2
exit 1
