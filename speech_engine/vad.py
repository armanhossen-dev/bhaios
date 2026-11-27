"""Silero VAD wrapper using faster_whisper's bundled ONNX model (100% offline)."""

from __future__ import annotations

import numpy as np
from faster_whisper.vad import VadOptions, get_speech_timestamps


class SileroVADFilter:
    """Detects speech activity in 16 kHz mono float32 chunks."""

    def __init__(self, threshold: float = 0.45, min_silence_ms: int = 450) -> None:
        self.threshold = threshold
        self.min_silence_ms = min_silence_ms

    def update_params(self, threshold: float, min_silence_ms: int | None = None) -> None:
        self.threshold = threshold
        if min_silence_ms is not None:
            self.min_silence_ms = min_silence_ms

    def has_speech(self, audio: np.ndarray, sample_rate: int = 16000) -> bool:
        """Return True if Silero VAD finds speech segments in the audio."""
        if audio.size < int(0.25 * sample_rate):
            return False
        rms = float(np.sqrt(np.mean(np.square(audio))))
        if rms < 0.002:
            return False

        opts = VadOptions(
            threshold=self.threshold,
            min_speech_duration_ms=200,
            min_silence_duration_ms=self.min_silence_ms,
        )
        timestamps = get_speech_timestamps(audio.astype(np.float32), vad_options=opts, sampling_rate=sample_rate)
        return len(timestamps) > 0
