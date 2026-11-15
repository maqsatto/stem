#!/usr/bin/env sh
# Back up PostgreSQL and uploaded files into ./backups.
# Usage: ./scripts/backup.sh
set -eu

cd "$(dirname "$0")/.."

if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    . ./.env
    set +a
fi

POSTGRES_USER="${POSTGRES_USER:-mlstem}"
POSTGRES_DB="${POSTGRES_DB:-mlstem}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p backups

DB_FILE="backups/mlstem-db-${STAMP}.dump.gz"
UPLOADS_FILE="backups/mlstem-uploads-${STAMP}.tar.gz"

echo "Dumping database ${POSTGRES_DB}..."
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom | gzip > "$DB_FILE"

echo "Archiving uploaded files..."
docker compose exec -T backend tar -czf - -C /app uploads > "$UPLOADS_FILE"

echo "Backup complete:"
echo "  database: $DB_FILE"
echo "  uploads:  $UPLOADS_FILE"
echo "Copy both files to off-server storage and verify restoration regularly."
