# BhaiOS — Version 2 (Full-Stack Local Study OS)

100% offline, privacy-first Bangla & English AI study webapp built with **React 19 + TypeScript + Vite + Tailwind CSS v4** and a modular **FastAPI + SQLite + Local BM25 RAG + Ollama + Whisper** backend.

## Architecture

- `version2/backend/` — Modular FastAPI routers (`chat`, `documents`, `tasks`, `resources`, `analytics`, `models`, `voice`, `health`), SQLite WAL persistence (`version2/data/bhaios_v2.db`), and local BM25 chunk retrieval.
- `version2/frontend/` — React 19 + TypeScript + Tailwind v4 SPA with KaTeX math rendering, 3-step Socratic Hint Ladder, Avro phonetic Bangla input, `⌘K` Command Palette, Document Companion, Pomodoro Focus Timer, Monthly Planner, Formula Vault, and Benchmark Lab.

## Quick Start

```bash
# One-command build + launch (serves SPA + API on http://127.0.0.1:8080)
./version2/start.sh
```

Or run dev servers separately:

```bash
# Terminal 1: Backend API
python3 -m uvicorn version2.backend.main:app --host 127.0.0.1 --port 8080 --reload

# Terminal 2: Frontend Vite dev server (proxies /api -> 8080)
cd version2/frontend && npm run dev
```

## Run Tests

```bash
python3 -m pytest version2/backend/tests/test_api.py -v
cd version2/frontend && npm run build
```
