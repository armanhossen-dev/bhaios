"""Configuration & constants for BhaiOS (100% Offline Apple Silicon M4 16GB)."""

from __future__ import annotations

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
VERSION2_DIR = BACKEND_DIR.parent
REPO_ROOT = VERSION2_DIR.parent

DATA_DIR = Path(os.environ.get("BHAIOS_DATA_DIR", str(VERSION2_DIR / "data")))
UPLOADS_DIR = DATA_DIR / "uploads"
MODELS_ROOT = Path(os.environ.get("BHAIOS_MODELS_DIR", str(REPO_ROOT / "models")))
MODELS_DIR = MODELS_ROOT / "whisper"
STT_DIR = MODELS_ROOT / "stt"
TTS_DIR = MODELS_ROOT / "tts"
EMBED_DIR = MODELS_ROOT / "embeddings"
CHROMA_DIR = DATA_DIR / "chroma"
DB_PATH = Path(os.environ.get("BHAIOS_DB_PATH", str(DATA_DIR / "bhaios_v2.db")))
FRONTEND_DIST_DIR = VERSION2_DIR / "frontend" / "dist"

for _d in (DATA_DIR, UPLOADS_DIR, MODELS_ROOT, MODELS_DIR, STT_DIR, TTS_DIR, EMBED_DIR):
    _d.mkdir(parents=True, exist_ok=True)

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODELS_PATH = os.environ.get("OLLAMA_MODELS", str(Path.home() / ".ollama" / "models"))

# Strict offline enforcement by default after install
OFFLINE_MODE_DEFAULT = os.environ.get("BHAIOS_OFFLINE_MODE", "1") == "1"

# Central model identifiers (overridable via environment)
DEFAULT_QWEN_MODEL = os.environ.get("BHAIOS_QWEN_MODEL", "qwen3.5:4b")
DEFAULT_NEMOTRON_MODEL = os.environ.get("BHAIOS_NEMOTRON_MODEL", "nemotron-3-nano:4b")
DEFAULT_LIGHTWEIGHT_MODEL = os.environ.get("BHAIOS_LIGHT_MODEL", "qwen2.5:0.5b")
DEFAULT_EMBEDDING_MODEL = os.environ.get("BHAIOS_EMBED_MODEL", "BAAI/bge-m3")

# Tiny models excluded from primary auto-selection unless Lightweight Mode is active
WEAK_MODELS = {"qwen2.5:0.5b", "llama3.2:1b"}

# Backward-compatible catalog reference built from central registry
SUGGESTED_MODELS = [
    {
        "name": DEFAULT_QWEN_MODEL,
        "title": "Qwen 3.5 (4B) · Main Study Assistant",
        "category": "Primary LLM",
        "size": "2.7 GB",
        "ram": "5 GB RAM",
        "tags": ["Default", "Bangla + Banglish", "Multimodal"],
        "description": "Primary offline study assistant for Bangla/English explanations, notes, and PDF/PPTX Q&A.",
    },
    {
        "name": DEFAULT_NEMOTRON_MODEL,
        "title": "NVIDIA Nemotron-3-Nano (4B) · Deep Reasoning",
        "category": "Reasoning LLM",
        "size": "2.8 GB",
        "ram": "5.5 GB RAM",
        "tags": ["Optional", "Math & CS", "Code Debugging"],
        "description": "Specialized reasoning model for complex algorithms, proofs, debugging, and agent planning.",
    },
    {
        "name": "qwen2.5:3b",
        "title": "Qwen 2.5 (3B) · Compact Fallback",
        "category": "Primary LLM",
        "size": "1.9 GB",
        "ram": "4 GB RAM",
        "tags": ["Fallback", "Bangla + English"],
        "description": "Compact fallback LLM for 8-16 GB unified memory laptops.",
    },
    {
        "name": "qwen2.5vl:3b",
        "title": "Qwen 2.5 VL (3B) · Local Vision",
        "category": "Vision",
        "size": "3.2 GB",
        "ram": "6 GB RAM",
        "tags": ["Vision", "Diagrams"],
        "description": "Local vision-language model for diagrams and handwritten notes.",
    },
]
