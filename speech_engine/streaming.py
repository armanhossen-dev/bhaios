"""Pseudo-streaming chunk coordinator with Silero VAD & overlap deduplication."""

from __future__ import annotations

import uuid
from typing import Any

import numpy as np

from .audio_buffer import RollingAudioBuffer
from .engine import BanglishSpeechEngine
from .models import TranscriptSegment, TranscriptionSettings
from .vad import SileroVADFilter


def deduplicate_overlap(previous_text: str, new_text: str, max_overlap_words: int = 10) -> str:
    """Strip duplicated prefix words from new_text that already end previous_text."""
    prev_words = previous_text.strip().split()
    new_words = new_text.strip().split()
    if not prev_words or not new_words:
        return new_text.strip()

    limit = min(len(prev_words), len(new_words), max_overlap_words)
    for k in range(limit, 0, -1):
        prev_tail = [w.lower().strip(".,!?।") for w in prev_words[-k:]]
        new_head = [w.lower().strip(".,!?।") for w in new_words[:k]]
        if prev_tail == new_head:
            return " ".join(new_words[k:]).strip()
    return new_text.strip()


class StreamingSession:
    """Manages one live transcription stream with rolling chunks, VAD, and deduplication."""

    def __init__(
        self,
        engine: BanglishSpeechEngine,
        settings: TranscriptionSettings | None = None,
    ) -> None:
        self.engine = engine
        self.settings = settings or TranscriptionSettings()
        self.buffer = RollingAudioBuffer(
            sample_rate=engine.config.sample_rate,
            chunk_seconds=self.settings.chunk_seconds,
            overlap_seconds=self.settings.overlap_seconds,
        )
        self.vad = SileroVADFilter(threshold=self.settings.vad_sensitivity)
        self.final_segments: list[TranscriptSegment] = []
        self._committed_text = ""

    def update_settings(self, settings: TranscriptionSettings) -> None:
        self.settings = settings
        self.buffer.configure(settings.chunk_seconds, settings.overlap_seconds)
        self.vad.update_params(settings.vad_sensitivity)

    def push_audio(self, samples: np.ndarray) -> None:
        self.buffer.append(samples)

    def process_step(self, force_flush: bool = False) -> list[dict[str, Any]]:
        """Process ready chunks (final) or unfinalized draft (partial) without blocking."""
        events: list[dict[str, Any]] = []

        while self.buffer.has_ready_chunk() or force_flush:
            popped = self.buffer.pop_chunk(force=force_flush)
            if popped is None:
                break
            chunk_audio, start_sec = popped
            if self.vad.has_speech(chunk_audio, self.engine.config.sample_rate):
                segs = self.engine.transcribe_array(
                    chunk_audio, settings=self.settings, offset_seconds=start_sec
                )
                for s in segs:
                    deduped = deduplicate_overlap(self._committed_text, s["text"])
                    if deduped:
                        seg_obj = TranscriptSegment(
                            id=uuid.uuid4().hex[:10],
                            start=s["start"],
                            end=s["end"],
                            text=deduped,
                            language=s["language"],
                            is_final=True,
                        )
                        self.final_segments.append(seg_obj)
                        self._committed_text = (self._committed_text + " " + deduped).strip()
                        events.append({"type": "final", "segment": seg_obj.model_dump(), "text": deduped})
            if force_flush:
                break

        # Emit partial draft for remaining audio if not flushing
        if not force_flush:
            draft = self.buffer.peek_draft()
            if draft is not None:
                draft_audio, start_sec = draft
                if self.vad.has_speech(draft_audio, self.engine.config.sample_rate):
                    segs = self.engine.transcribe_array(
                        draft_audio, settings=self.settings, offset_seconds=start_sec
                    )
                    draft_text = " ".join(s["text"] for s in segs).strip()
                    draft_text = deduplicate_overlap(self._committed_text, draft_text)
                    if draft_text:
                        events.append({"type": "partial", "text": draft_text})

        return events
