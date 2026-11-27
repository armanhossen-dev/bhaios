"""Configuration for BhaiOS Local Speech Engine (Apple M4 & CPU INT8 optimized)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

SPEECH_ENGINE_DIR = Path(__file__).resolve().parent
REPO_ROOT = SPEECH_ENGINE_DIR.parent
DEFAULT_MODEL_DIR = REPO_ROOT / "models" / "stt" / "whisper-medium-bn-en-cs-faster"
TRANSCRIPTS_DIR = REPO_ROOT / "version2" / "data" / "transcripts"
TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class SpeechConfig:
    model_id: str = "kayees/whisper-medium-bn-en-cs-faster"
    local_model_dir: Path = Path(os.environ.get("BHAIOS_STT_DIR", str(DEFAULT_MODEL_DIR)))
    compute_type: str = "int8"
    device: str = "cpu"
    cpu_threads: int = int(os.environ.get("BHAIOS_STT_THREADS", "4"))
    num_workers: int = 1
    sample_rate: int = 16000
    chunk_seconds: float = 6.0
    overlap_seconds: float = 1.5
    vad_threshold: float = 0.45
    min_silence_ms: int = 450
    beam_size: int = 5
    local_files_only: bool = True
