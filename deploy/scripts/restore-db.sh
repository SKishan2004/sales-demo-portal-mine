#!/usr/bin/env bash
set -euo pipefail

# Usage: DATABASE_URL=... ./deploy/scripts/restore-db.sh /path/to/backup.dump
DUMP_FILE="${1:-}"
if [[ -z "$DUMP_FILE" || ! -f "$DUMP_FILE" ]]; then
  echo "Usage: DATABASE_URL=... $0 <backup.dump>" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: DATABASE_URL is not set." >&2
  exit 1
fi

pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL" "$DUMP_FILE"
echo "Database restored from: $DUMP_FILE"
