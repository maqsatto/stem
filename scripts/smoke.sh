#!/usr/bin/env sh
# Minimal smoke check for a running deployment.
# Usage: ./scripts/smoke.sh [BASE_URL]
set -eu

BASE_URL="${1:-http://localhost:8080}"

echo "Checking frontend: ${BASE_URL}/healthz"
curl -fsS "${BASE_URL}/healthz" >/dev/null

echo "Checking public API through nginx: ${BASE_URL}/api/v1/algorithms"
curl -fsS "${BASE_URL}/api/v1/algorithms?page_size=1" >/dev/null

echo "Checking public home page: ${BASE_URL}/"
curl -fsS "${BASE_URL}/" >/dev/null

echo "Smoke check passed."
