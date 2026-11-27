"""Core Banglish Faster-Whisper INT8 inference engine (100% offline)."""

from __future__ import annotations

import re
import threading
import unicodedata
from typing import Any

import numpy as np
from faster_whisper import WhisperModel

from .config import SpeechConfig
from .models import EngineStatus, OutputStyle, TranscriptSegment, TranscriptionSettings

# Deterministic Bengali-to-Roman phonetic map (used only when user explicitly selects roman_banglish)
_BN_TO_ROMAN = {
    "অ": "o", "আ": "a", "ই": "i", "ঈ": "ee", "উ": "u", "ঊ": "oo", "ঋ": "ri",
    "এ": "e", "ঐ": "oi", "ও": "o", "ঔ": "ou",
    "ক": "k", "খ": "kh", "গ": "g", "ঘ": "gh", "ঙ": "ng",
    "চ": "ch", "ছ": "chh", "জ": "j", "ঝ": "jh", "ঞ": "n",
    "ট": "t", "ঠ": "th", "ড": "d", "ঢ": "dh", "ণ": "n",
    "ত": "t", "থ": "th", "দ": "d", "ধ": "dh", "ন": "n",
    "প": "p", "ফ": "f", "ব": "b", "ভ": "bh", "ম": "m",
    "য": "j", "র": "r", "ল": "l", "শ": "sh", "ষ": "sh", "স": "s", "হ": "h",
    "ড়": "r", "ঢ়": "rh", "য়": "y", "ৎ": "t", "ং": "ng", "ঃ": "h", "ঁ": "",
    "া": "a", "ি": "i", "ী": "ee", "ু": "u", "ূ": "oo", "ৃ": "ri",
    "ে": "e", "ৈ": "oi", "ো": "o", "ৌ": "ou", "্": "", "।": ".",
}


def sanitize_banglish_text(text: str, punctuation: bool = True) -> str:
    """Clean Unicode Bengali + English text without corrupting valid ং/ঃ/ঁ or meaning."""
    text = unicodedata.normalize("NFC", text)
    text = re.sub(r"্{2,}", "্", text)
    text = re.sub(r"্([া-ৌ])", r"\1", text)
    text = re.sub(r"([া-ৌ])\1+", r"\1", text)
    text = re.sub(r"্(?=\s|$)", "", text)
    text = re.sub(r"(^|[\s.,!?;:()\[\]{}\"'“”‘’—–-])([া-ৌ্]+)", r"\1", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not punctuation:
        text = re.sub(r"[.,!?;:।]+", "", text).strip()
    return text


def format_output_style(text: str, style: OutputStyle) -> str:
    """Apply non-semantic script formatting (default 'mixed' preserves natural BN+EN)."""
    if style == "mixed":
        return text
    if style == "bn_script":
        return text.replace(".", "।")
    if style == "roman_banglish":
        out = []
        for ch in text:
            out.append(_BN_TO_ROMAN.get(ch, ch))
        return re.sub(r"\s+", " ", "".join(out)).strip()
    return text


def format_srt_timestamp(seconds: float) -> str:
    ms_total = max(0, int(round(seconds * 1000)))
    hrs, rem = divmod(ms_total, 3600000)
    mins, rem = divmod(rem, 60000)
    secs, ms = divmod(rem, 1000)
    return f"{hrs:02d}:{mins:02d}:{secs:02d},{ms:03d}"


def export_txt(segments: list[TranscriptSegment]) -> str:
    return "\n".join(s.text for s in segments if s.text.strip())


def export_srt(segments: list[TranscriptSegment]) -> str:
    blocks = []
    for idx, seg in enumerate(segments, start=1):
        if not seg.text.strip():
            continue
        blocks.append(
            f"{idx}\n{format_srt_timestamp(seg.start)} --> {format_srt_timestamp(seg.end)}\n{seg.text.strip()}\n"
        )
    return "\n".join(blocks)


class BanglishSpeechEngine:
    """Singleton Faster-Whisper INT8 engine for offline Bengali-English code-switched ASR."""

    def __init__(self, config: SpeechConfig | None = None) -> None:
        self.config = config or SpeechConfig()
        self._model: WhisperModel | None = None
        self._lock = threading.Lock()
        self._infer_lock = threading.Lock()

    def is_cached(self) -> bool:
        return (self.config.local_model_dir / "model.bin").exists()

    def is_loaded(self) -> bool:
        return self._model is not None

    def load_model(self) -> WhisperModel:
        with self._lock:
            if self._model is None:
                if self.config.local_files_only and not self.is_cached():
                    raise FileNotFoundError(
                        f"Offline model not found at {self.config.local_model_dir}. "
                        f"Download '{self.config.model_id}' first."
                    )
                model_src = (
                    str(self.config.local_model_dir)
                    if self.is_cached()
                    else self.config.model_id
                )
                self._model = WhisperModel(
                    model_src,
                    device=self.config.device,
                    compute_type=self.config.compute_type,
                    cpu_threads=self.config.cpu_threads,
                    num_workers=self.config.num_workers,
                    local_files_only=self.config.local_files_only,
                )
            return self._model

    def status(self, recording_state: str = "idle") -> EngineStatus:
        return EngineStatus(
            model_id=self.config.model_id,
            local_path=str(self.config.local_model_dir),
            model_cached=self.is_cached(),
            model_loaded=self.is_loaded(),
            compute_type=self.config.compute_type,
            device=self.config.device,
            offline_ready=self.is_cached(),
            recording_state=recording_state,  # type: ignore[arg-type]
        )

    def transcribe_array(
        self,
        audio: np.ndarray,
        settings: TranscriptionSettings | None = None,
        offset_seconds: float = 0.0,
    ) -> list[dict[str, Any]]:
        """Run Faster-Whisper INT8 transcription on a 16 kHz mono float32 array."""
        cfg = settings or TranscriptionSettings()
        if audio.size < int(0.3 * self.config.sample_rate):
            return []

        model = self.load_model()
        # Anchor code-switched model to 'bn' under auto mode so short Banglish clips aren't misdetected as Hindi/Urdu
        lang_arg = "bn" if cfg.language == "auto" else cfg.language
        cs_prompt = (
            None
            if cfg.language == "en"
            else "ভাই, আজকে আমার university project এবং class lecture নিয়ে বাংলা আর English-এ কথা বলব।"
        )

        with self._infer_lock:
            segments, info = model.transcribe(
                audio.astype(np.float32),
                language=lang_arg,
                task="transcribe",
                beam_size=cfg.beam_size,
                initial_prompt=cs_prompt,
                vad_filter=True,
                vad_parameters={
                    "threshold": cfg.vad_sensitivity,
                    "min_silence_duration_ms": self.config.min_silence_ms,
                },
                repetition_penalty=1.1,
                no_repeat_ngram_size=3,
                condition_on_previous_text=False,
            )
            results: list[dict[str, Any]] = []
            for seg in segments:
                cleaned = sanitize_banglish_text(seg.text, punctuation=cfg.punctuation)
                formatted = format_output_style(cleaned, cfg.output_style)
                if formatted:
                    results.append(
                        {
                            "start": round(offset_seconds + float(seg.start), 2),
                            "end": round(offset_seconds + float(seg.end), 2),
                            "text": formatted,
                            "language": info.language or cfg.language,
                        }
                    )
            return results


_ENGINE_INSTANCE: BanglishSpeechEngine | None = None


def get_speech_engine() -> BanglishSpeechEngine:
    global _ENGINE_INSTANCE
    if _ENGINE_INSTANCE is None:
        _ENGINE_INSTANCE = BanglishSpeechEngine()
    return _ENGINE_INSTANCE
