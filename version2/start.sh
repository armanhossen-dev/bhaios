#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/version2/frontend"

if [ ! -d "$FRONTEND_DIR/dist" ]; then
  echo "Building BhaiOS v2 frontend..."
  (cd "$FRONTEND_DIR" && npm install && npm run build)
fi

echo "Starting BhaiOS v2 on http://127.0.0.1:8080 ..."
cd "$ROOT_DIR"
exec python3 -m uvicorn version2.backend.main:app --host 127.0.0.1 --port 8080
