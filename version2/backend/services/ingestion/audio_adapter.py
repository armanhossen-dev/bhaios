"""Audio ingestion adapter reusing BhaiOS Local Speech Engine (Faster-Whisper Banglish ASR)."""

from __future__ import annotations

import asyncio
from pathlib import Path

import numpy as np

from .base import IngestResult, NormalizedChunk


def _transcribe_audio_sync(file_path: Path) -> tuple[list[dict], str]:
    import av
    from speech_engine.audio_buffer import resample_to_16k_mono
    from speech_engine.engine import get_speech_engine
    from speech_engine.models import TranscriptionSettings

    container = av.open(str(file_path))
    frames = []
    orig_sr = 16000
    for frame in container.decode(audio=0):
        orig_sr = frame.sample_rate
        arr = frame.to_ndarray()
        if arr.ndim == 2:
            arr = arr.mean(axis=0)
        frames.append(arr)
    audio = np.concatenate(frames) if frames else np.zeros(0, dtype=np.float32)
    audio_16k = resample_to_16k_mono(audio, orig_sr)

    engine = get_speech_engine()
    segments = engine.transcribe_array(audio_16k, TranscriptionSettings())
    full = " ".join(s.get("text", "") for s in segments).strip()
    return segments, full


async def parse_audio(
    doc_id: str,
    file_path: Path,
    original_name: str,
    course_id: str | None = None,
) -> IngestResult:
    try:
        segments, full_text = await asyncio.to_thread(_transcribe_audio_sync, file_path)
    except Exception as exc:
        segments = []
        full_text = f"[Audio uploaded: {original_name}. Speech engine note: {exc}]"

    lines = [
        f"[{s['start']:.1f}s - {s['end']:.1f}s] {s['text']}"
        for s in segments
        if s.get("text")
    ]
    formatted = "\n".join(lines) or full_text or f"[Audio lecture: {original_name}]"

    chunk = NormalizedChunk(
        document_id=doc_id,
        filename=original_name,
        file_type="audio",
        course_id=course_id,
        page_number=1,
        content_type="transcript",
        extracted_text=formatted,
        metadata={"segments": segments},
        source_location="Audio 0.0s",
    )
    return IngestResult(
        file_type="audio",
        page_count=1,
        summary=formatted[:240],
        chunks=[chunk],
    )
