# BhaiOS — 100% Offline University AI Study Assistant

> **Local-first, privacy-first academic workspace** built for **Apple Silicon (M4, 16 GB Unified Memory)**.  
> Zero cloud APIs · Strict offline socket guard · Bangla, English & Banglish support.

---

## Table of Contents

1. [Core Principles & Hardware Target](#1-core-principles--hardware-target)
2. [System Architecture](#2-system-architecture)
3. [Multi-Model AI Ecosystem](#3-multi-model-ai-ecosystem)
4. [Key Features](#4-key-features)
5. [Installation & External SSD Setup](#5-installation--external-ssd-setup)
6. [Running the Application](#6-running-the-application)
7. [Keyboard Shortcuts](#7-keyboard-shortcuts)
8. [Testing & Verification](#8-testing--verification)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Core Principles & Hardware Target

- **100% Offline Inference**: No OpenAI, Gemini, Claude, or external auth dependencies during normal study operation.
- **Strict Offline Socket Guard** (`version2/backend/core/offline_guard.py`): Blocks outbound non-localhost connections when `BHAIOS_OFFLINE_MODE=1`, permitting network access only during explicit model downloads.
- **Apple Silicon 16 GB Optimization** (`version2/backend/services/model_manager.py`): Enforces a single active primary LLM in unified memory (`keep_alive: 0` explicit unload before switching), pre-flight disk/RAM compatibility checks, and configurable external SSD storage.

---

## 2. System Architecture

```text
React 19 + TypeScript + Vite + Tailwind v4 SPA
  ├── Course Workspace · AI Chat · Document & Visual Studio · Code Lab
  ├── Study Studio · Lecture Studio · Knowledge Graph · AI Models · Assignments
  └─▶ FastAPI Local Server (127.0.0.1:8080)
        ├── Intelligent Model Router (services/model_router.py)
        ├── Model Lifecycle & Compatibility (services/model_manager.py)
        ├── Controlled Agent + Audit Log (services/agent_tools.py)
        ├── Ingestion Pipeline (services/ingestion/) + OCR (ocr_pipeline.py)
        ├── Hybrid RAG: SQLite FTS5 + BGE-M3 Embeddings (services/hybrid_rag.py)
        ├── Offline Speech Engine: Faster-Whisper INT8 + Silero VAD (speech_engine/)
        ├── Modular TTS: Piper EN + MMS-TTS Bangla (services/tts_engine.py)
        └── SQLite WAL (version2/data/bhaios_v2.db) + Local Ollama (127.0.0.1:11434)
```

---

## 3. Multi-Model AI Ecosystem

Configured centrally via `version2/backend/core/model_registry.py` and `version2/backend/config.py`:

| Role | Model | Size | Min RAM | Behavior |
|---|---|---|---|---|
| **Main Study Assistant** | `qwen3.5:4b` | ~2.7 GB | 5.0 GB | Default for Bangla/Banglish/English Q&A, PDF/PPTX summaries & notes |
| **Advanced Reasoning** | `nemotron-3-nano:4b` | ~2.8 GB | 5.5 GB | Optional; auto-selected for complex math proofs, algorithms & debugging |
| **Lightweight Mode** | `qwen2.5:0.5b` | ~0.4 GB | 1.5 GB | Low-memory fallback & simple classification |
| **Multilingual Embeddings** | `BAAI/bge-m3` | ~2.2 GB | 3.0 GB | Local semantic search (`local_files_only=True`) + SQLite FTS5 RRF |
| **Speech-to-Text** | `whisper-medium-bn-en-cs-faster` | ~0.75 GB | 2.0 GB | Offline CTranslate2 INT8 Bengali + English code-switched ASR |
| **OCR Engine** | `tesseract` (`ben+eng`) | ~0.1 GB | 0.5 GB | OpenCV deskew/denoise/CLAHE/upscale preprocessing for printed text |
| **Text-to-Speech** | `piper-en` / `facebook/mms-tts-ben` | ~0.07–0.15 GB | 0.8 GB | Modular offline voice synthesis with speed & local WAV save |

> **16 GB Guard:** Large 30B+ models (e.g., `nemotron-30b`) are automatically flagged as incompatible by pre-flight checks.

---

## 4. Key Features

- **Intelligent AI Model Router** (`Auto`, `Qwen`, `Nemotron`, `Lightweight`): Evaluates intent, language, task complexity, modality, and free RAM with automatic fallback and an expandable **AI Activity Panel** in Chat.
- **Course-Centric Academic Hierarchy**: University → Department → Academic Year → Semester → Course → Chapters, Materials, Flashcards, Quizzes, and Assignments.
- **Universal Document & Visual Studio**:
  - Supports `PDF` (`PyMuPDF`), `PPTX` (`python-pptx` slides + notes + tables), `DOCX`, `XLSX` (`openpyxl`), `CSV`/`XML`/`MD`/`TXT`, `ZIP` (Zip-Slip & zip-bomb guarded), `Code` (14+ languages with AST symbol chunking), `Images` (OpenCV QR decoder with safe URL inspection modal + OCR), and `Audio`.
  - Background async ingestion worker (`/api/documents/batch-upload`, retry/cancel) and SHA-256 deduplication.
- **Study Studio & Code Lab**: SM-2 spaced-repetition flashcards, grounded MCQ/short/descriptive quizzes, chapter summaries, and an isolated subprocess Code Lab sandbox (Python, C, C++, Node.js) with resource/timeout limits.
- **Controlled Agent Security**: Prompt-injection fencing (`<untrusted_study_material>`), workspace path containment, pending approval gates before file modifications/deletions, and SQLite `agent_audit_log`.

---

## 5. Installation & External SSD Setup

### Prerequisites
- Python 3.11+ & Node.js 20+
- [Ollama](https://ollama.com) running locally on `http://127.0.0.1:11434`

### 1) Install Dependencies
```bash
# Optional macOS binaries for printed-text OCR & English Piper TTS
brew install tesseract tesseract-lang ffmpeg
pip install piper-tts

# Frontend dependencies & production build
cd version2/frontend && npm install && npm run build
```

### 2) Pull Local Models (Optional External SSD Path)
```bash
# Point Ollama & BhaiOS storage to an external SSD if internal disk is limited
export OLLAMA_MODELS="/Volumes/YourSSD/ollama-models"
export BHAIOS_MODELS_DIR="/Volumes/YourSSD/bhaios-models"
export BHAIOS_DATA_DIR="/Volumes/YourSSD/bhaios-data"

ollama serve &
ollama pull qwen3.5:4b
ollama pull nemotron-3-nano:4b
```

---

## 6. Running the Application

```bash
# Single command build & launch (http://127.0.0.1:8080)
./version2/start.sh
```

Or run backend and frontend dev servers separately:

```bash
# Terminal 1 — FastAPI Backend
BHAIOS_OFFLINE_MODE=1 python3 -m uvicorn version2.backend.main:app --host 127.0.0.1 --port 8080 --reload

# Terminal 2 — Vite Frontend Dev Server
cd version2/frontend && npm run dev
```

---

## 7. Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Open Global Command Palette |
| `/` (or `⌘/` / `⌘J`) | Jump to AI Chat and focus input |
| `⌘⇧V` / `Ctrl+M` / `Alt+V` | Navigate to Chat and toggle voice capture |

---

## 8. Testing & Verification

```bash
# Run full backend + speech engine test suite
PYTHONPATH=. pytest version2/backend/tests/ speech_engine/tests/ -v

# Type-check & build production frontend
cd version2/frontend && npm run build
```

---

## 9. Troubleshooting

- **Insufficient Disk Space on Internal SSD**: Mount an external SSD, set `OLLAMA_MODELS` and `BHAIOS_MODELS_DIR`, and configure paths under **AI Models** in the app.
- **Tesseract Not Found**: Printed-image OCR reports missing binary cleanly; install via `brew install tesseract tesseract-lang` (for handwritten notes, use Vision mode with Qwen).
- **Offline Verification**: Disconnect Wi-Fi, open **AI Models -> Offline Verification & Agent Audit Log**, and verify `Strict Offline Socket Guard: ACTIVE` with `0` outbound leaks.
