#!/usr/bin/env bash
set -euo pipefail

# Usage: MEDIA_STORAGE_DIR=/var/lib/mobileum-storage ./deploy/scripts/backup-media.sh /var/backups/mobileum-demo
MEDIA_DIR="${MEDIA_STORAGE_DIR:-./storage}"
BACKUP_DIR="${1:-./backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [[ ! -d "$MEDIA_DIR" ]]; then
  echo "Error: MEDIA_STORAGE_DIR not found: $MEDIA_DIR" >&2
  exit 1
fi

OUT_FILE="$BACKUP_DIR/mobileum_media_${TIMESTAMP}.tar.gz"
tar -czf "$OUT_FILE" -C "$MEDIA_DIR" products categories shared
echo "Media backup created: $OUT_FILE"
