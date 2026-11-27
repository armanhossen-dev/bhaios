"""Local Whisper & optional Gemini Speech-to-Text + Bangla voice model manager."""

from __future__ import annotations

import asyncio
import base64
import io
import json
import os
import re
import subprocess
import tempfile

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from ..config import MODELS_DIR, STT_DIR, TTS_DIR
from ..db import get_setting, set_setting
from ..rag import clean_bangla_text

router = APIRouter(prefix="/api", tags=["voice"])
_whisper_cache: dict[str, object] = {}
_nemo_model = None
_tts_cache: dict[str, tuple[object, object]] = {}

TTS_CATALOG = [
    {
        "id": "facebook/mms-tts-ben",
        "title": "Hugging Face MMS-TTS Bangla",
        "language": "Bangla (বাংলা)",
        "size": "145 MB",
        "description": "Meta/Hugging Face VITS neural voice model for natural offline Bangla speech output.",
    },
    {
        "id": "facebook/mms-tts-eng",
        "title": "Hugging Face MMS-TTS English",
        "language": "English",
        "size": "145 MB",
        "description": "Meta/Hugging Face VITS neural voice model for offline English speech output.",
    },
]

WHISPER_CATALOG = [
    {
        "name": "whisper-medium-bn-en-cs-faster",
        "title": "Bangla + English Code-Switching (Faster-Whisper)",
        "size": "1.5 GB",
        "bangla_quality": "Best Bangla + English (CTranslate2)",
        "description": "kayees/whisper-medium-bn-en-cs-faster — trained for Bangla + English CS speech offline.",
    },
    {
        "name": "titu_stt_bn_conformer_large",
        "title": "Hishab Titu Bangla Conformer Large",
        "size": "487 MB",
        "bangla_quality": "Best Native Bangla (NeMo)",
        "description": "Specialized Bangla Conformer-CTC ASR from Hugging Face (hishab/titu_stt_bn_conformer_large).",
    },
    {
        "name": "base",
        "title": "Whisper Base",
        "size": "145 MB",
        "bangla_quality": "Basic",
        "description": "Fast English & basic Bangla voice input. Already lightweight on CPU.",
    },
    {
        "name": "small",
        "title": "Whisper Small (Recommended for Bangla)",
        "size": "484 MB",
        "bangla_quality": "Good Bangla",
        "description": "Noticeably better Bangla & Banglish speech recognition offline on 8–16 GB RAM.",
    },
    {
        "name": "medium",
        "title": "Whisper Medium (High-Accuracy Bangla)",
        "size": "1.5 GB",
        "bangla_quality": "Best Offline Bangla",
        "description": "High-accuracy Bangla academic & technical dictation; slower on CPU.",
    },
]


class VoiceModelAction(BaseModel):
    name: str


def _is_installed(name: str) -> bool:
    if name == "whisper-medium-bn-en-cs-faster":
        return (STT_DIR / "whisper-medium-bn-en-cs-faster" / "model.bin").exists()
    if name == "titu_stt_bn_conformer_large":
        return (STT_DIR / "titu_stt_bn_conformer_large.nemo").exists()
    return (MODELS_DIR / f"{name}.pt").exists()


def _get_faster_whisper_bn_en():
    if "whisper-medium-bn-en-cs-faster" not in _whisper_cache:
        from faster_whisper import WhisperModel

        _whisper_cache["whisper-medium-bn-en-cs-faster"] = WhisperModel(
            str(STT_DIR / "whisper-medium-bn-en-cs-faster"),
            device="cpu",
            compute_type="int8",
        )
    return _whisper_cache["whisper-medium-bn-en-cs-faster"]


def _get_nemo_titu():
    global _nemo_model
    if _nemo_model is None:
        import nemo.collections.asr as nemo_asr

        _nemo_model = nemo_asr.models.EncDecCTCModelBPE.restore_from(
            str(STT_DIR / "titu_stt_bn_conformer_large.nemo")
        )
    return _nemo_model


def _get_whisper(model_name: str):
    if model_name not in _whisper_cache:
        import whisper

        _whisper_cache.clear()
        _whisper_cache[model_name] = whisper.load_model(
            model_name, download_root=str(MODELS_DIR)
        )
    return _whisper_cache[model_name]


@router.get("/voice/models")
def list_voice_models() -> dict:
    default_model = (
        "whisper-medium-bn-en-cs-faster"
        if _is_installed("whisper-medium-bn-en-cs-faster")
        else "base"
    )
    active = get_setting("active_whisper_model", default_model)
    if not _is_installed(active):
        active = default_model
    models = [
        {**m, "installed": _is_installed(m["name"]), "active": m["name"] == active}
        for m in WHISPER_CATALOG
    ]
    return {"active": active, "models": models}


@router.post("/voice/models/select")
def select_voice_model(req: VoiceModelAction) -> dict:
    if not any(m["name"] == req.name for m in WHISPER_CATALOG):
        raise HTTPException(status_code=400, detail="Unknown Whisper model")
    if not _is_installed(req.name):
        raise HTTPException(status_code=400, detail="Model not downloaded yet")
    set_setting("active_whisper_model", req.name)
    return {"active": req.name}


@router.post("/voice/models/download")
async def download_voice_model(req: VoiceModelAction) -> StreamingResponse:
    if not any(m["name"] == req.name for m in WHISPER_CATALOG):
        raise HTTPException(status_code=400, detail="Unknown voice model")

    async def event_stream():
        yield json.dumps({"status": f"Downloading '{req.name}'…"}) + "\n"
        try:
            if req.name == "whisper-medium-bn-en-cs-faster":
                from huggingface_hub import snapshot_download

                await asyncio.to_thread(
                    snapshot_download,
                    repo_id="kayees/whisper-medium-bn-en-cs-faster",
                    local_dir=str(STT_DIR / "whisper-medium-bn-en-cs-faster"),
                )
            elif req.name == "titu_stt_bn_conformer_large":
                from huggingface_hub import hf_hub_download

                await asyncio.to_thread(
                    hf_hub_download,
                    repo_id="hishab/titu_stt_bn_conformer_large",
                    filename="titu_stt_bn_conformer_large.nemo",
                    local_dir=str(STT_DIR),
                )
            else:
                await asyncio.to_thread(_get_whisper, req.name)
            set_setting("active_whisper_model", req.name)
            yield json.dumps({"status": "ready", "active": req.name}) + "\n"
        except Exception as exc:
            yield json.dumps({"error": str(exc)}) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@router.delete("/voice/models/{name}")
def delete_voice_model(name: str) -> dict:
    import shutil

    if name == "whisper-medium-bn-en-cs-faster":
        target = STT_DIR / "whisper-medium-bn-en-cs-faster"
        if not target.exists():
            raise HTTPException(status_code=404, detail="Voice model not found")
        _whisper_cache.pop(name, None)
        shutil.rmtree(target)
        if get_setting("active_whisper_model", "base") == name:
            set_setting("active_whisper_model", "base")
        return {"deleted": name}

    target = (
        STT_DIR / "titu_stt_bn_conformer_large.nemo"
        if name == "titu_stt_bn_conformer_large"
        else MODELS_DIR / f"{name}.pt"
    )
    if not target.exists():
        raise HTTPException(status_code=404, detail="Voice model file not found")
    _whisper_cache.pop(name, None)
    target.unlink()
    if get_setting("active_whisper_model", "base") == name:
        set_setting("active_whisper_model", "base")
    return {"deleted": name}


async def _transcribe_with_gemini(
    api_key: str, audio_bytes: bytes, mime_type: str, language: str
) -> str:
    b64 = base64.b64encode(audio_bytes).decode("utf-8")
    lang_hint = (
        "Bangla (Bengali script)"
        if language == "bn"
        else (
            "English"
            if language == "en"
            else "Bangla or English (preserve exact spoken language)"
        )
    )
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": f"Transcribe this audio accurately in {lang_hint}. Return ONLY the transcribed text with zero extra commentary."
                    },
                    {"inlineData": {"mimeType": mime_type or "audio/webm", "data": b64}},
                ],
            }
        ]
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        return "".join(p.get("text", "") for p in parts).strip()


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = Form("auto"),
) -> dict:
    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Empty audio recording")

    google_key = get_setting("google_api_key", "")
    if google_key:
        try:
            txt = await _transcribe_with_gemini(
                google_key, raw_bytes, file.content_type or "audio/webm", language
            )
            if txt:
                return {"text": clean_bangla_text(txt), "language": language, "engine": "gemini"}
        except Exception:
            pass

    ext_map = {
        "audio/webm": ".webm",
        "audio/mp4": ".mp4",
        "audio/m4a": ".m4a",
        "audio/ogg": ".ogg",
        "audio/wav": ".wav",
        "audio/mpeg": ".mp3",
    }
    mime_base = (file.content_type or "").split(";")[0].strip().lower()
    suffix = ext_map.get(mime_base) or os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(raw_bytes)
        tmp_path = tmp.name

    try:
        default_model = (
            "whisper-medium-bn-en-cs-faster"
            if _is_installed("whisper-medium-bn-en-cs-faster")
            else "base"
        )
        active_name = get_setting("active_whisper_model", default_model)
        if not _is_installed(active_name):
            active_name = default_model

        if active_name == "whisper-medium-bn-en-cs-faster":
            fw_model = await asyncio.to_thread(_get_faster_whisper_bn_en)
            lang_arg = "bn" if language in ("auto", "", "Auto") else language
            cs_prompt = (
                None
                if lang_arg == "en"
                else "ভাই, আজকে আমার university project এবং class lecture নিয়ে বাংলা আর English-এ কথা বলব।"
            )

            def _run_fw():
                segs, info = fw_model.transcribe(
                    tmp_path,
                    language=lang_arg,
                    task="transcribe",
                    beam_size=5,
                    initial_prompt=cs_prompt,
                    vad_filter=True,
                    vad_parameters={"threshold": 0.35, "min_silence_duration_ms": 300},
                    repetition_penalty=1.1,
                    no_repeat_ngram_size=3,
                    condition_on_previous_text=False,
                )
                txt = " ".join(s.text.strip() for s in segs).strip()
                # Short 1-2s utterances can be dropped by Silero VAD; retry once without VAD
                if not txt:
                    segs2, info = fw_model.transcribe(
                        tmp_path,
                        language=lang_arg,
                        task="transcribe",
                        beam_size=5,
                        initial_prompt=cs_prompt,
                        vad_filter=False,
                        repetition_penalty=1.1,
                        no_repeat_ngram_size=3,
                        condition_on_previous_text=False,
                    )
                    txt = " ".join(s.text.strip() for s in segs2).strip()
                return txt, info.language

            raw_text, det_lang = await asyncio.to_thread(_run_fw)
            return {
                "text": clean_bangla_text(raw_text),
                "language": det_lang or language,
                "engine": "faster-whisper-bn-en-cs",
            }

        if active_name == "titu_stt_bn_conformer_large":
            wav_path = tmp_path + ".wav"
            try:
                subprocess.run(
                    ["ffmpeg", "-y", "-i", tmp_path, "-ar", "16000", "-ac", "1", wav_path],
                    check=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                nemo_model = await asyncio.to_thread(_get_nemo_titu)
                hyps = await asyncio.to_thread(nemo_model.transcribe, [wav_path])
                raw = hyps[0] if isinstance(hyps[0], str) else getattr(hyps[0], "text", str(hyps[0]))
                return {
                    "text": clean_bangla_text(raw),
                    "language": "bn",
                    "engine": "hishab-titu-conformer",
                }
            except ImportError:
                active_name = "base"
            finally:
                if os.path.exists(wav_path):
                    os.remove(wav_path)

        model = _get_whisper(active_name)
        lang_arg = None if language in ("auto", "", "Auto") else language
        prompt = (
            "এটি একটি বাংলা এবং ইংরেজি শিক্ষামূলক প্রশ্ন।"
            if language in ("bn", "auto")
            else None
        )
        result = model.transcribe(
            tmp_path,
            language=lang_arg,
            initial_prompt=prompt,
            temperature=0.0,
            condition_on_previous_text=False,
            fp16=False,
        )
        raw_text = (result.get("text") or "").strip()
        text = clean_bangla_text(raw_text)
        return {
            "text": text,
            "language": result.get("language", language),
            "engine": f"whisper-{active_name}",
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Whisper transcription failed: {exc}") from exc
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


# --- Hugging Face Local Neural TTS (Voice Output) ---

class TtsDownloadRequest(BaseModel):
    id: str


class TtsSpeakRequest(BaseModel):
    text: str
    language: str = "auto"


def _tts_local_dir(model_id: str) -> str:
    return str(TTS_DIR / model_id.replace("/", "__"))


def _tts_installed(model_id: str) -> bool:
    d = _tts_local_dir(model_id)
    return os.path.isdir(d) and os.path.exists(os.path.join(d, "config.json"))


def _load_hf_tts(model_id: str):
    if model_id not in _tts_cache:
        from transformers import AutoTokenizer, VitsModel

        local_dir = _tts_local_dir(model_id)
        source = local_dir if _tts_installed(model_id) else model_id
        tokenizer = AutoTokenizer.from_pretrained(source)
        model = VitsModel.from_pretrained(source)
        if not _tts_installed(model_id):
            os.makedirs(local_dir, exist_ok=True)
            tokenizer.save_pretrained(local_dir)
            model.save_pretrained(local_dir)
        _tts_cache[model_id] = (tokenizer, model)
    return _tts_cache[model_id]


@router.get("/tts/models")
def list_tts_models() -> dict:
    return {
        "models": [{**m, "installed": _tts_installed(m["id"])} for m in TTS_CATALOG]
    }


@router.post("/tts/download")
async def download_tts_model(req: TtsDownloadRequest) -> StreamingResponse:
    if not any(m["id"] == req.id for m in TTS_CATALOG):
        raise HTTPException(status_code=400, detail="Unknown TTS model")

    async def event_stream():
        yield json.dumps({"status": f"Downloading {req.id} from Hugging Face…"}) + "\n"
        try:
            await asyncio.to_thread(_load_hf_tts, req.id)
            yield json.dumps({"status": "ready", "id": req.id}) + "\n"
        except Exception as exc:
            yield json.dumps({"error": str(exc)}) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@router.post("/tts/speak")
async def speak_text(req: TtsSpeakRequest):
    clean = re.sub(r"[`*_#$]+", " ", req.text).strip()[:600]
    if not clean:
        raise HTTPException(status_code=400, detail="Empty text")

    has_bangla = bool(re.search(r"[\u0980-\u09FF]", clean))
    model_id = (
        "facebook/mms-tts-ben"
        if (req.language == "bn" or has_bangla)
        else "facebook/mms-tts-eng"
    )

    if not _tts_installed(model_id):
        raise HTTPException(
            status_code=404,
            detail=f"HF TTS model {model_id} not downloaded yet. Download it in Settings.",
        )

    def _synthesize() -> bytes:
        import numpy as np
        import scipy.io.wavfile as wavfile
        import torch

        tokenizer, model = _load_hf_tts(model_id)
        inputs = tokenizer(clean, return_tensors="pt")
        with torch.no_grad():
            waveform = model(**inputs).waveform[0].cpu().numpy()
        pcm = np.int16(np.clip(waveform, -1.0, 1.0) * 32767)
        buf = io.BytesIO()
        wavfile.write(buf, rate=model.config.sampling_rate, data=pcm)
        return buf.getvalue()

    wav_bytes = await asyncio.to_thread(_synthesize)
    return Response(content=wav_bytes, media_type="audio/wav")
