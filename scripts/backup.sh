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
umask 077

DB_FILE="backups/mlstem-db-${STAMP}.dump.gz"
UPLOADS_FILE="backups/mlstem-uploads-${STAMP}.tar.gz"
if [ -e "$DB_FILE" ] || [ -e "$UPLOADS_FILE" ]; then
    echo "A backup with timestamp ${STAMP} already exists; try again later." >&2
    exit 1
fi
TEMP_DIR="$(mktemp -d backups/.backup-XXXXXX)"
trap 'rm -rf "$TEMP_DIR"' EXIT HUP INT TERM

echo "Dumping database ${POSTGRES_DB}..."
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom > "$TEMP_DIR/database.dump"
gzip -c "$TEMP_DIR/database.dump" > "$TEMP_DIR/database.dump.gz"

echo "Archiving uploaded files..."
docker compose exec -T backend tar -czf - -C /app uploads > "$TEMP_DIR/uploads.tar.gz"

mv "$TEMP_DIR/database.dump.gz" "$DB_FILE"
mv "$TEMP_DIR/uploads.tar.gz" "$UPLOADS_FILE"

echo "Backup complete:"
echo "  database: $DB_FILE"
echo "  uploads:  $UPLOADS_FILE"
echo "Copy both files to off-server storage and verify restoration regularly."
