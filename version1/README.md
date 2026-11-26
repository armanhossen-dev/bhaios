# BhaiOS — Version 1 (Local AI Study Assistant)

100% offline, privacy-first Bangla & English AI study assistant powered by **FastAPI**, **Ollama**, **PyPDF**, and **OpenAI Whisper**.

---

## Quick Start & Run Commands

### 1. Start Ollama (if not already running)

```bash
ollama serve
```

*(Optional) Pull the default text & vision models:*

```bash
ollama pull qwen2.5:3b
ollama pull llava-phi3:latest
```

### 2. Run the BhaiOS Server

From the repository root (`/bhaios`):

```bash
# Using the project virtual environment (recommended)
.venv/bin/python version1/server.py
```

Or using system Python after installing dependencies:

```bash
pip3 install -r version1/requirements.txt
python3 version1/server.py
```

`server.py` automatically picks an available port (`8080`, `8000`, `8081`, etc.) and prints the exact URL in the terminal, for example:

- **App URL:** `http://127.0.0.1:8080` (or `http://127.0.0.1:8000` if `8080` is busy)

To force a specific port:

```bash
.venv/bin/python -m uvicorn version1.server:app --host 127.0.0.1 --port 8000 --reload
```

---

## Project Structure

```text
version1/
├── index.html          # App shell, left/right sidebars, and all 6 screens
├── server.py           # FastAPI backend (Ollama chat/vision, Whisper STT, PDF upload, live RAM health)
├── requirements.txt    # Python dependencies (FastAPI, Uvicorn, httpx, pypdf, Pillow, Whisper)
├── css/
│   ├── tokens.css      # Obsidian dark & light theme design tokens
│   ├── shadcn.css      # UI primitive styles
│   └── styles.css      # Layout, typography (Plus Jakarta Sans, Noto Sans/Serif Bengali, JetBrains Mono)
├── js/
│   ├── data.js         # Empty initial workspace schema & benchmark structure
│   └── app.js          # Chat, Stop/Repeat/Edit, Saved Chats, Whisper voice, Calendar, Tasks, Live RAM
└── README.md
```

## Key Features

- **Chat:** Guide Mode vs. Answer Mode, inline local model selector dropdown, Stop button during generation, Repeat & Edit prompt actions, and local Whisper voice input (`Auto` / `Bangla` / `English`).
- **Saved Past Chats:** Auto-subjectified (`Physics`, `Chemistry`, `Math`, `Biology`, `Bangla`, `English`, `ICT`, `General`) with timestamps and delete controls under **Chat → Past chats**.
- **Right Panel:** Live clock + matching 45-minute reverse focus countdown, live notifications feed, and uploaded files list with quick upload.
- **Left Sidebar Footer:** Settings & Shortcuts, active model, session token usage, and live device RAM monitoring (`GET /api/health`).
- **Documents, Tasks, Progress, Benchmark & Settings:** Local PDF/image indexing (`VLM` / `OCR`), full monthly calendar + task manager, live session timer, and `EN | বাংলা` + `Small | Medium | Large` font settings.
