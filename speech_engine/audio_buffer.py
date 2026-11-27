"""Rolling 16 kHz mono audio buffer and resampler."""

from __future__ import annotations

import threading
from math import gcd

import numpy as np
from scipy.signal import resample_poly


def resample_to_16k_mono(audio: np.ndarray, orig_sr: int) -> np.ndarray:
    """Convert any PCM/float audio array to 16 kHz mono float32 in [-1.0, 1.0]."""
    arr = np.asarray(audio, dtype=np.float32)
    if arr.ndim == 2:
        arr = arr.mean(axis=1)
    if arr.size == 0:
        return arr

    max_abs = float(np.max(np.abs(arr)))
    if max_abs > 1.5:
        arr = arr / 32768.0

    if orig_sr != 16000 and orig_sr > 0:
        g = gcd(orig_sr, 16000)
        arr = resample_poly(arr, 16000 // g, orig_sr // g).astype(np.float32)

    return np.clip(arr, -1.0, 1.0).astype(np.float32)


class RollingAudioBuffer:
    """Thread-safe rolling buffer yielding overlapping chunks for pseudo-streaming Whisper."""

    def __init__(
        self,
        sample_rate: int = 16000,
        chunk_seconds: float = 6.0,
        overlap_seconds: float = 1.5,
    ) -> None:
        self.sample_rate = sample_rate
        self.chunk_samples = int(chunk_seconds * sample_rate)
        self.overlap_samples = int(min(overlap_seconds, chunk_seconds * 0.5) * sample_rate)
        self._buf = np.zeros(0, dtype=np.float32)
        self._total_samples_consumed = 0
        self._lock = threading.Lock()

    def configure(self, chunk_seconds: float, overlap_seconds: float) -> None:
        with self._lock:
            self.chunk_samples = int(chunk_seconds * self.sample_rate)
            self.overlap_samples = int(min(overlap_seconds, chunk_seconds * 0.5) * self.sample_rate)

    def append(self, samples: np.ndarray) -> None:
        if samples.size == 0:
            return
        with self._lock:
            self._buf = np.concatenate([self._buf, samples.astype(np.float32)])

    def has_ready_chunk(self) -> bool:
        with self._lock:
            return self._buf.size >= self.chunk_samples

    def pop_chunk(self, force: bool = False) -> tuple[np.ndarray, float] | None:
        """Return (chunk_audio, start_offset_seconds) retaining overlap_samples for next chunk."""
        with self._lock:
            if self._buf.size == 0:
                return None
            if not force and self._buf.size < self.chunk_samples:
                return None

            take = min(self._buf.size, self.chunk_samples)
            chunk = self._buf[:take].copy()
            start_sec = self._total_samples_consumed / self.sample_rate

            if force and self._buf.size <= self.chunk_samples:
                self._total_samples_consumed += self._buf.size
                self._buf = np.zeros(0, dtype=np.float32)
            else:
                advance = max(1, take - self.overlap_samples)
                self._buf = self._buf[advance:]
                self._total_samples_consumed += advance

            return chunk, start_sec

    def peek_draft(self) -> tuple[np.ndarray, float] | None:
        """Peek current unfinalized audio (>= 1.2s) for partial draft updates without consuming."""
        with self._lock:
            if self._buf.size < int(1.2 * self.sample_rate):
                return None
            start_sec = self._total_samples_consumed / self.sample_rate
            return self._buf.copy(), start_sec

    def clear(self) -> None:
        with self._lock:
            self._buf = np.zeros(0, dtype=np.float32)
            self._total_samples_consumed = 0
