"""Modular Offline Text-to-Speech Engine (Piper EN + Replaceable Bangla TTS adapters)."""

from __future__ import annotations

import io
import os
import re
import shutil
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any

import numpy as np
import scipy.io.wavfile as wavfile

from ..config import DATA_DIR, TTS_DIR

TTS_OUTPUTS_DIR = DATA_DIR / "tts_outputs"
TTS_OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
_TTS_CACHE: dict[str, tuple[Any, Any]] = {}


def _apply_speed(waveform: np.ndarray, sample_rate: int, speed: float) -> tuple[np.ndarray, int]:
    """Adjust playback speed via simple linear resampling when speed != 1.0."""
    speed = max(0.6, min(1.8, float(speed)))
    if abs(speed - 1.0) < 0.02 or waveform.size == 0:
        return waveform, sample_rate
    new_len = max(1, int(len(waveform) / speed))
    xp = np.linspace(0, 1, len(waveform))
    x = np.linspace(0, 1, new_len)
    return np.interp(x, xp, waveform).astype(np.float32), sample_rate


def _tts_local_dir(model_id: str) -> Path:
    return TTS_DIR / model_id.replace("/", "__")


def is_tts_installed(model_id: str) -> bool:
    if model_id == "piper-en":
        return bool(shutil.which("piper")) or (_TTS_CACHE.get("piper") is not None)
    d = _tts_local_dir(model_id)
    return d.is_dir() and (d / "config.json").exists()


def synthesize_speech_wav(
    text: str,
    *,
    language: str = "auto",
    speed: float = 1.0,
    save_file: bool = False,
) -> tuple[bytes, str, str | None]:
    """Synthesize WAV audio offline. Returns (wav_bytes, engine_used, saved_path)."""
    clean = re.sub(r"[`*_#$]+", " ", text).strip()[:1200]
    if not clean:
        raise ValueError("Empty text for TTS")

    has_bangla = bool(re.search(r"[\u0980-\u09FF]", clean))
    use_bangla = language == "bn" or has_bangla

    # 1) English via Piper if installed, else MMS-TTS English
    if not use_bangla and shutil.which("piper"):
        piper_model = next((p for p in (TTS_DIR / "piper").glob("*.onnx")), None) if (TTS_DIR / "piper").exists() else None
        if piper_model:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp_wav = tmp.name
            try:
                subprocess.run(
                    ["piper", "--model", str(piper_model), "--output_file", tmp_wav],
                    input=clean.encode("utf-8"),
                    check=True,
                    capture_output=True,
                )
                sr, data = wavfile.read(tmp_wav)
                flt = data.astype(np.float32) / 32767.0
                flt, sr = _apply_speed(flt, sr, speed)
                buf = io.BytesIO()
                wavfile.write(buf, rate=sr, data=np.int16(np.clip(flt, -1.0, 1.0) * 32767))
                wav_bytes = buf.getvalue()
                saved = _save_wav(wav_bytes) if save_file else None
                return wav_bytes, "piper-en", saved
            finally:
                if os.path.exists(tmp_wav):
                    os.remove(tmp_wav)

    # 2) Neural VITS offline (MMS-TTS Bangla or English)
    model_id = "facebook/mms-tts-ben" if use_bangla else "facebook/mms-tts-eng"
    local_dir = _tts_local_dir(model_id)
    if not is_tts_installed(model_id):
        raise FileNotFoundError(
            f"Offline TTS model '{model_id}' not installed locally in {local_dir}."
        )

    import torch
    from transformers import AutoTokenizer, VitsModel

    if model_id not in _TTS_CACHE:
        tok = AutoTokenizer.from_pretrained(str(local_dir), local_files_only=True)
        mdl = VitsModel.from_pretrained(str(local_dir), local_files_only=True)
        _TTS_CACHE[model_id] = (tok, mdl)

    tok, mdl = _TTS_CACHE[model_id]
    inputs = tok(clean, return_tensors="pt")
    with torch.no_grad():
        waveform = mdl(**inputs).waveform[0].cpu().numpy()
    waveform, sr = _apply_speed(waveform, int(mdl.config.sampling_rate), speed)
    pcm = np.int16(np.clip(waveform, -1.0, 1.0) * 32767)
    buf = io.BytesIO()
    wavfile.write(buf, rate=sr, data=pcm)
    wav_bytes = buf.getvalue()
    saved = _save_wav(wav_bytes) if save_file else None
    return wav_bytes, model_id, saved


def _save_wav(wav_bytes: bytes) -> str:
    out = TTS_OUTPUTS_DIR / f"tts_{int(time.time())}.wav"
    out.write_bytes(wav_bytes)
    return str(out)
