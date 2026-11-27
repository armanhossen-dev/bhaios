"""Tests for BhaiOS Local Speech Engine (Offline Banglish ASR)."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import numpy as np
import pytest
from fastapi.testclient import TestClient

from speech_engine.audio_buffer import RollingAudioBuffer, resample_to_16k_mono
from speech_engine.audio_capture import MicrophoneCapture, MicrophoneError
from speech_engine.config import SpeechConfig
from speech_engine.engine import (
    BanglishSpeechEngine,
    export_srt,
    export_txt,
    format_output_style,
    sanitize_banglish_text,
)
from speech_engine.models import TranscriptSegment, TranscriptionSettings
from speech_engine.streaming import StreamingSession, deduplicate_overlap
from speech_engine.vad import SileroVADFilter
from version2.backend.main import app


def test_offline_model_loading_and_missing_dir_error(tmp_path: Path):
    # Missing directory must fail cleanly with FileNotFoundError (no silent substitution)
    bad_cfg = SpeechConfig(local_model_dir=tmp_path / "missing_model", local_files_only=True)
    bad_engine = BanglishSpeechEngine(bad_cfg)
    assert bad_engine.is_cached() is False
    with pytest.raises(FileNotFoundError):
        bad_engine.load_model()

    # Real local model loads offline
    real_engine = BanglishSpeechEngine()
    assert real_engine.is_cached() is True
    model = real_engine.load_model()
    assert model is not None
    assert real_engine.is_loaded() is True


def test_duplicate_word_prevention_across_chunks():
    prev = "ভাই, কালকে আমার university project এর"
    nxt = "university project এর একটা presentation আছে"
    deduped = deduplicate_overlap(prev, nxt)
    assert deduped == "একটা presentation আছে"

    # Case-insensitive & punctuation-tolerant English boundary
    assert deduplicate_overlap("We need to prepare.", "prepare for the exam") == "for the exam"


def test_long_pauses_and_background_noise_rejected_by_vad():
    vad = SileroVADFilter(threshold=0.45)
    sr = 16000

    # 3 seconds of silence
    silence = np.zeros(3 * sr, dtype=np.float32)
    assert vad.has_speech(silence, sr) is False

    # 3 seconds of low-amplitude background noise
    rng = np.random.default_rng(42)
    noise = (rng.normal(0, 0.001, 3 * sr)).astype(np.float32)
    assert vad.has_speech(noise, sr) is False


def test_resampling_and_rolling_buffer_overlap():
    # 48 kHz stereo -> 16 kHz mono
    stereo_48k = np.ones((48000, 2), dtype=np.float32) * 0.25
    mono_16k = resample_to_16k_mono(stereo_48k, 48000)
    assert mono_16k.ndim == 1
    assert abs(mono_16k.size - 16000) <= 10

    buf = RollingAudioBuffer(sample_rate=16000, chunk_seconds=4.0, overlap_seconds=1.0)
    buf.append(np.ones(16000 * 4, dtype=np.float32))
    assert buf.has_ready_chunk() is True
    popped = buf.pop_chunk()
    assert popped is not None
    chunk, start_sec = popped
    assert chunk.size == 16000 * 4
    assert start_sec == 0.0
    # 1.0s overlap retained
    assert buf._buf.size == 16000


def test_microphone_error_handling():
    mic = MicrophoneCapture()
    with patch("sounddevice.InputStream", side_effect=OSError("No input device")):
        with pytest.raises(MicrophoneError):
            mic.start(lambda _: None)
    assert mic.state == "idle"


def test_output_styles_and_exports():
    raw = "ভাই, কালকে আমার university project আছে."
    assert sanitize_banglish_text(raw) == raw
    assert format_output_style(raw, "mixed") == raw
    assert format_output_style(raw, "bn_script").endswith("।")
    roman = format_output_style("আমার project", "roman_banglish")
    assert "project" in roman and "amar" in roman.lower()

    segs = [
        TranscriptSegment(id="1", start=0.0, end=2.5, text="ভাই, কালকে presentation আছে।"),
        TranscriptSegment(id="2", start=2.5, end=5.0, text="So prepare করতে হবে।"),
    ]
    assert "ভাই, কালকে presentation আছে।" in export_txt(segs)
    srt = export_srt(segs)
    assert "00:00:00,000 --> 00:00:02,500" in srt


def test_english_bengali_and_mixed_transcribe_pipeline():
    """Test English, Bengali, and Mixed audio arrays through BanglishSpeechEngine."""
    engine = BanglishSpeechEngine()

    # Use local MMS-TTS English if cached to generate real English speech waveform
    from version2.backend.routers.voice import _load_hf_tts, _tts_installed
    import torch

    if _tts_installed("facebook/mms-tts-eng"):
        tok_en, mod_en = _load_hf_tts("facebook/mms-tts-eng")
        inp = tok_en("My university project presentation is tomorrow.", return_tensors="pt")
        with torch.no_grad():
            wav_en = mod_en(**inp).waveform[0].cpu().numpy()
        segs_en = engine.transcribe_array(wav_en, TranscriptionSettings(language="en"))
        assert isinstance(segs_en, list)
        assert len(segs_en) >= 1
        assert "university" in segs_en[0]["text"].lower() or "project" in segs_en[0]["text"].lower()

    if _tts_installed("facebook/mms-tts-ben"):
        tok_bn, mod_bn = _load_hf_tts("facebook/mms-tts-ben")
        inp_bn = tok_bn("কালকে আমার একটা কাজ আছে", return_tensors="pt")
        with torch.no_grad():
            wav_bn = mod_bn(**inp_bn).waveform[0].cpu().numpy()
        segs_bn = engine.transcribe_array(wav_bn, TranscriptionSettings(language="bn"))
        assert isinstance(segs_bn, list)

    # Mixed BN + EN concatenated
    if _tts_installed("facebook/mms-tts-ben") and _tts_installed("facebook/mms-tts-eng"):
        mixed_wav = np.concatenate([wav_bn, np.zeros(4000, dtype=np.float32), wav_en])
        segs_mix = engine.transcribe_array(mixed_wav, TranscriptionSettings(language="auto"))
        assert isinstance(segs_mix, list)


def test_engine_rest_and_websocket_endpoints():
    with TestClient(app) as client:
        res = client.get("/api/engine")
        assert res.status_code == 200
        data = res.json()
        assert data["model_id"] == "kayees/whisper-medium-bn-en-cs-faster"
        assert data["offline_ready"] is True
        assert data["compute_type"] == "int8"

        with client.websocket_connect("/ws/transcribe") as ws:
            hello = ws.receive_json()
            assert hello["type"] == "status"
            assert hello["status"] == "connected"
            ws.send_json({"type": "config", "settings": {"language": "auto", "output_style": "mixed"}})
            cfg_ack = ws.receive_json()
            assert cfg_ack["status"] == "configured"
            ws.send_json({"type": "stop"})
            stop_ack = ws.receive_json()
            assert stop_ack["status"] == "stopped"
