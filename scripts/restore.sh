#!/usr/bin/env sh
# Restore PostgreSQL and (optionally) uploaded files from backups.
# Usage: ./scripts/restore.sh <db-dump.gz> [uploads.tar.gz]
# WARNING: --clean removes existing database objects. Test on staging first.
set -eu

cd "$(dirname "$0")/.."

DB_DUMP="${1:-}"
UPLOADS_TAR="${2:-}"

if [ -z "$DB_DUMP" ]; then
    echo "Usage: $0 <db-dump.gz> [uploads.tar.gz]" >&2
    exit 1
fi

if [ ! -f "$DB_DUMP" ]; then
    echo "Database dump not found: $DB_DUMP" >&2
    exit 1
fi

if [ -n "$UPLOADS_TAR" ] && [ ! -f "$UPLOADS_TAR" ]; then
    echo "Uploads archive not found: $UPLOADS_TAR" >&2
    exit 1
fi

if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    . ./.env
    set +a
fi

POSTGRES_USER="${POSTGRES_USER:-mlstem}"
POSTGRES_DB="${POSTGRES_DB:-mlstem}"

echo "Stopping backend to avoid writes during restore..."
docker compose stop backend

echo "Restoring database ${POSTGRES_DB} from ${DB_DUMP}..."
gunzip -c "$DB_DUMP" | docker compose exec -T db pg_restore \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --clean --if-exists --no-owner

echo "Starting backend..."
docker compose start backend

if [ -n "$UPLOADS_TAR" ]; then
    echo "Restoring uploads from ${UPLOADS_TAR}..."
    docker compose exec -T backend tar -xzf - -C /app < "$UPLOADS_TAR"
    docker compose restart backend
fi

echo "Restore finished. Verify /health and a few key pages before announcing the restore."
