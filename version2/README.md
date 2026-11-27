# BhaiOS v2 — Offline-First University Study OS

## Run Locally (Backend + Frontend)
```bash
../.venv/bin/uvicorn backend.server:app --host 127.0.0.1 --port 8765
# Open http://127.0.0.1:8765
```

## Run Tests
```bash
../.venv/bin/python -m unittest discover -s tests -v
```

## Build Desktop Installer (Tauri v2)
```bash
npm install
npm run tauri:build
```
