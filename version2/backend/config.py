"""Configuration & constants for BhaiOS v2."""

from __future__ import annotations

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
VERSION2_DIR = BACKEND_DIR.parent
REPO_ROOT = VERSION2_DIR.parent

DATA_DIR = Path(os.environ.get("BHAIOS_DATA_DIR", str(VERSION2_DIR / "data")))
UPLOADS_DIR = DATA_DIR / "uploads"
MODELS_DIR = REPO_ROOT / "models" / "whisper"
STT_DIR = REPO_ROOT / "models" / "stt"
TTS_DIR = REPO_ROOT / "models" / "tts"
DB_PATH = Path(os.environ.get("BHAIOS_DB_PATH", str(DATA_DIR / "bhaios_v2.db")))
FRONTEND_DIST_DIR = VERSION2_DIR / "frontend" / "dist"

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)
STT_DIR.mkdir(parents=True, exist_ok=True)
TTS_DIR.mkdir(parents=True, exist_ok=True)

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")

# Weak/tiny models (< 2B) hallucinate broken Bangla and fail Socratic formatting
WEAK_MODELS = {"qwen2.5:0.5b", "llama3.2:1b"}

SUGGESTED_MODELS = [
    {
        "name": "qwen2.5:3b",
        "title": "Qwen 2.5 (3B) · Main Study Model",
        "category": "Text",
        "size": "1.9 GB",
        "ram": "4 GB RAM",
        "tags": ["Bhai Guide", "Bangla + English", "Recommended"],
        "description": "Fast main local model for Guide Mode hints and bilingual study.",
    },
    {
        "name": "hf.co/bartowski/Qwen2.5-Coder-3B-Instruct-GGUF",
        "title": "HF Qwen2.5-Coder (3B) · CS & Coding",
        "category": "CS Study",
        "size": "2.1 GB",
        "ram": "4 GB RAM",
        "tags": ["Hugging Face", "DSA / OS / Code", "CS Student"],
        "description": "Hugging Face's best compact CS model for algorithms, OS, DBMS, and debugging.",
    },
    {
        "name": "hf.co/Qwen/Qwen2.5-7B-Instruct-GGUF",
        "title": "HF Qwen2.5 (7B) · Deep CS & Bangla",
        "category": "CS Study",
        "size": "4.7 GB",
        "ram": "8 GB RAM",
        "tags": ["Hugging Face", "Bangla + Math", "CS Theory"],
        "description": "High-accuracy Hugging Face model for CS theory, proofs, and clean Bangla output.",
    },
    {
        "name": "hf.co/bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF",
        "title": "HF DeepSeek-R1-Distill (7B) · Reasoning & Proofs",
        "category": "CS Study",
        "size": "4.7 GB",
        "ram": "8 GB RAM",
        "tags": ["Hugging Face", "Algorithms", "Step-by-Step"],
        "description": "Chain-of-thought reasoning model for discrete math, complexity proofs, and OS/DSA.",
    },
    {
        "name": "qwen2.5vl:3b",
        "title": "Qwen 2.5 VL (3B)",
        "category": "Vision",
        "size": "3.2 GB",
        "ram": "6 GB RAM",
        "tags": ["Vision", "Handwriting", "Diagrams"],
        "description": "Compact VLM for reading Bangla/English handwritten notes & diagrams.",
    },
    {
        "name": "llava-phi3:latest",
        "title": "LLaVA-Phi3",
        "category": "Vision",
        "size": "2.9 GB",
        "ram": "5 GB RAM",
        "tags": ["Vision", "Fast"],
        "description": "Lightweight vision-language model for screenshots and printed pages.",
    },
    {
        "name": "gemma3:4b",
        "title": "Gemma 3 (4B)",
        "category": "Vision",
        "size": "3.3 GB",
        "ram": "6 GB RAM",
        "tags": ["Multimodal", "Bangla", "Google"],
        "description": "Strong multilingual + vision reasoning on 16 GB laptops.",
    },
]

GEMINI_MODELS = [
    {"name": "gemini:gemini-2.5-flash", "size": "Cloud API", "is_vision": True, "parameter_size": "2.5 Flash"},
    {"name": "gemini:gemini-2.5-pro", "size": "Cloud API", "is_vision": True, "parameter_size": "2.5 Pro"},
]
