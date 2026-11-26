#!/usr/bin/env bash
set -euo pipefail

# Usage: DATABASE_URL=... ./deploy/scripts/backup-db.sh /var/backups/mobileum-demo
BACKUP_DIR="${1:-./backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: DATABASE_URL is not set." >&2
  exit 1
fi

OUT_FILE="$BACKUP_DIR/mobileum_sales_demo_${TIMESTAMP}.dump"
pg_dump --format=custom --no-owner --no-privileges --dbname="$DATABASE_URL" --file="$OUT_FILE"
echo "Database backup created: $OUT_FILE"
