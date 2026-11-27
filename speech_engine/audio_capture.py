"""Local microphone capture via sounddevice (16 kHz mono float32)."""

from __future__ import annotations

from typing import Callable
import numpy as np


class MicrophoneError(RuntimeError):
    """Raised when microphone device is missing, busy, or permission is denied."""


class MicrophoneCapture:
    """Captures 16 kHz mono audio frames and forwards them to a callback."""

    def __init__(self, sample_rate: int = 16000, blocksize: int = 4000) -> None:
        self.sample_rate = sample_rate
        self.blocksize = blocksize
        self._stream = None
        self._paused = False
        self._running = False

    @property
    def state(self) -> str:
        if not self._running:
            return "idle"
        return "paused" if self._paused else "recording"

    def start(self, on_audio: Callable[[np.ndarray], None]) -> None:
        if self._running:
            return
        try:
            import sounddevice as sd

            def _callback(indata, frames, time_info, status):
                if self._paused or not self._running:
                    return
                mono = np.asarray(indata[:, 0], dtype=np.float32).copy()
                on_audio(mono)

            self._stream = sd.InputStream(
                samplerate=self.sample_rate,
                channels=1,
                dtype="float32",
                blocksize=self.blocksize,
                callback=_callback,
            )
            self._stream.start()
            self._running = True
            self._paused = False
        except Exception as exc:
            self._running = False
            self._stream = None
            raise MicrophoneError(f"Microphone unavailable: {exc}") from exc

    def pause(self) -> None:
        if self._running:
            self._paused = True

    def resume(self) -> None:
        if self._running:
            self._paused = False

    def stop(self) -> None:
        self._running = False
        self._paused = False
        if self._stream is not None:
            try:
                self._stream.stop()
                self._stream.close()
            except Exception:
                pass
            self._stream = None
