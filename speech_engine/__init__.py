"""BhaiOS Local Speech Engine — Offline Banglish (BN+EN) ASR powered by Faster-Whisper + Silero VAD."""

from .config import SpeechConfig
from .engine import BanglishSpeechEngine, get_speech_engine

__all__ = ["SpeechConfig", "BanglishSpeechEngine", "get_speech_engine"]
