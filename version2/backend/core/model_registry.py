"""Central Model Registry for BhaiOS multi-model local ecosystem (Apple Silicon M4 16GB)."""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Literal

from ..config import (
    DEFAULT_EMBEDDING_MODEL,
    DEFAULT_LIGHTWEIGHT_MODEL,
    DEFAULT_NEMOTRON_MODEL,
    DEFAULT_QWEN_MODEL,
    EMBED_DIR,
    OLLAMA_MODELS_PATH,
    STT_DIR,
    TTS_DIR,
)

ModelKind = Literal["ollama_llm", "embedding", "stt", "ocr", "tts"]


@dataclass(frozen=True)
class ModelSpec:
    id: str
    display_name: str
    kind: ModelKind
    category: str
    size_gb: float
    min_ram_gb: float
    recommended_for: str
    license_note: str
    storage_path: str
    optional: bool = False
    max_supported_ram_gb: float = 16.0

    def to_dict(self) -> dict:
        return asdict(self)


MODEL_REGISTRY: dict[str, ModelSpec] = {
    DEFAULT_QWEN_MODEL: ModelSpec(
        id=DEFAULT_QWEN_MODEL,
        display_name="Qwen 3.5 (4B)",
        kind="ollama_llm",
        category="Main Study Assistant",
        size_gb=2.7,
        min_ram_gb=5.0,
        recommended_for="General study, Bangla/Banglish explanations, PDF/PPTX summaries, exam prep",
        license_note="Apache-2.0 / Qwen License",
        storage_path=OLLAMA_MODELS_PATH,
        optional=False,
    ),
    DEFAULT_NEMOTRON_MODEL: ModelSpec(
        id=DEFAULT_NEMOTRON_MODEL,
        display_name="NVIDIA Nemotron-3-Nano (4B)",
        kind="ollama_llm",
        category="Advanced Reasoning",
        size_gb=2.8,
        min_ram_gb=5.5,
        recommended_for="Complex math proofs, CS algorithms, code debugging, multi-step planning",
        license_note="NVIDIA Open Model License",
        storage_path=OLLAMA_MODELS_PATH,
        optional=True,
    ),
    "nemotron-30b": ModelSpec(
        id="nemotron-30b",
        display_name="NVIDIA Nemotron (30B Reference)",
        kind="ollama_llm",
        category="Incompatible Reference",
        size_gb=19.0,
        min_ram_gb=24.0,
        recommended_for="Too large for 16 GB Unified Memory M4",
        license_note="NVIDIA Open Model License",
        storage_path=OLLAMA_MODELS_PATH,
        optional=True,
        max_supported_ram_gb=16.0,
    ),
    DEFAULT_LIGHTWEIGHT_MODEL: ModelSpec(
        id=DEFAULT_LIGHTWEIGHT_MODEL,
        display_name="Qwen 2.5 (0.5B) Lightweight",
        kind="ollama_llm",
        category="Lightweight Mode",
        size_gb=0.4,
        min_ram_gb=1.5,
        recommended_for="Ultra-low memory fallback & fast simple classification",
        license_note="Apache-2.0",
        storage_path=OLLAMA_MODELS_PATH,
        optional=True,
    ),
    DEFAULT_EMBEDDING_MODEL: ModelSpec(
        id=DEFAULT_EMBEDDING_MODEL,
        display_name="BAAI BGE-M3 Multilingual Embeddings",
        kind="embedding",
        category="Document RAG",
        size_gb=2.2,
        min_ram_gb=3.0,
        recommended_for="Bengali + English semantic search across course documents",
        license_note="MIT License",
        storage_path=str(EMBED_DIR),
        optional=False,
    ),
    "whisper-medium-bn-en-cs-faster": ModelSpec(
        id="whisper-medium-bn-en-cs-faster",
        display_name="Faster-Whisper Banglish Medium (INT8)",
        kind="stt",
        category="Speech-to-Text",
        size_gb=0.75,
        min_ram_gb=2.0,
        recommended_for="Offline Bengali, English & Banglish speech transcription",
        license_note="MIT / Whisper Weights",
        storage_path=str(STT_DIR / "whisper-medium-bn-en-cs-faster"),
        optional=False,
    ),
    "tesseract-ben-eng": ModelSpec(
        id="tesseract-ben-eng",
        display_name="Tesseract OCR (ben + eng)",
        kind="ocr",
        category="OCR Engine",
        size_gb=0.1,
        min_ram_gb=0.5,
        recommended_for="Printed screenshots, scanned PDFs, slide images",
        license_note="Apache-2.0",
        storage_path="/opt/homebrew/share/tessdata",
        optional=False,
    ),
    "piper-en": ModelSpec(
        id="piper-en",
        display_name="Piper Offline English TTS",
        kind="tts",
        category="English TTS",
        size_gb=0.07,
        min_ram_gb=0.5,
        recommended_for="Fast local English voice synthesis",
        license_note="MIT License (verify voice card license before redistribution)",
        storage_path=str(TTS_DIR / "piper"),
        optional=True,
    ),
    "facebook/mms-tts-ben": ModelSpec(
        id="facebook/mms-tts-ben",
        display_name="MMS-TTS Bengali (VITS)",
        kind="tts",
        category="Bengali TTS",
        size_gb=0.15,
        min_ram_gb=0.8,
        recommended_for="Offline Bengali neural speech output (replaceable)",
        license_note="CC-BY-NC 4.0 (Non-Commercial — do not redistribute commercially)",
        storage_path=str(TTS_DIR / "facebook__mms-tts-ben"),
        optional=False,
    ),
    "chatterbox-bangla": ModelSpec(
        id="chatterbox-bangla",
        display_name="Chatterbox-Bangla Adapter",
        kind="tts",
        category="Bengali TTS (Optional)",
        size_gb=1.2,
        min_ram_gb=3.5,
        recommended_for="Expressive Bengali TTS evaluation adapter",
        license_note="Check upstream model card license before distribution",
        storage_path=str(TTS_DIR / "chatterbox-bangla"),
        optional=True,
    ),
}


def get_model_spec(model_id: str) -> ModelSpec | None:
    return MODEL_REGISTRY.get(model_id)
