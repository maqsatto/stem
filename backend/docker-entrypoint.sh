#!/bin/sh
# Wait for PostgreSQL, apply Alembic migrations and optionally seed demo data.
set -eu

DATABASE_URL="${DATABASE_URL:-postgresql+psycopg://mlstem:mlstem@db:5432/mlstem}"

echo "Waiting for PostgreSQL..."
export DATABASE_URL
python - <<'PY'
import os
import time

import psycopg

dsn = os.environ["DATABASE_URL"].replace("postgresql+psycopg://", "postgresql://", 1)
last_error: Exception | None = None
for attempt in range(1, 61):
    try:
        with psycopg.connect(dsn, connect_timeout=3):
            print("PostgreSQL is ready.")
            break
    except Exception as exc:  # pragma: no cover - container bootstrap
        last_error = exc
        if attempt == 60:
            raise SystemExit(f"PostgreSQL is not available: {last_error}") from exc
        time.sleep(2)
PY

echo "Applying database migrations..."
alembic upgrade head

if [ "${SEED_ON_START:-false}" = "true" ]; then
    echo "Seeding demo accounts and content (idempotent)..."
    python -m app.seed
fi

exec "$@"
