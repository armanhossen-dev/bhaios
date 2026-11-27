"""FastAPI REST & WebSocket router for BhaiOS Local Speech Engine."""

from __future__ import annotations

import asyncio
import json
import os
import tempfile
import time
import uuid

import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from .audio_buffer import resample_to_16k_mono
from .audio_capture import MicrophoneCapture, MicrophoneError
from .config import TRANSCRIPTS_DIR
from .engine import export_srt, export_txt, get_speech_engine
from .models import (
    EngineStatus,
    RecordingActionResponse,
    TranscriptSegment,
    TranscriptionSettings,
)
from .streaming import StreamingSession

router = APIRouter(tags=["speech-engine"])

_mic_capture = MicrophoneCapture()
_active_session: StreamingSession | None = None
_active_session_id: str | None = None


class ExportRequest(BaseModel):
    segments: list[TranscriptSegment]
    format: str = "txt"
    save_locally: bool = False


@router.get("/api/engine", response_model=EngineStatus)
def get_engine_status() -> EngineStatus:
    engine = get_speech_engine()
    return engine.status(recording_state=_mic_capture.state)


@router.post("/api/recording/start", response_model=RecordingActionResponse)
def start_recording(settings: TranscriptionSettings | None = None) -> RecordingActionResponse:
    global _active_session, _active_session_id
    engine = get_speech_engine()
    if _mic_capture.state == "recording":
        return RecordingActionResponse(
            state="recording",
            message="Recording already in progress.",
            session_id=_active_session_id,
        )
    if _mic_capture.state == "paused":
        _mic_capture.resume()
        return RecordingActionResponse(
            state="recording",
            message="Resumed recording.",
            session_id=_active_session_id,
        )

    session = StreamingSession(engine, settings or TranscriptionSettings())
    try:
        _mic_capture.start(on_audio=session.push_audio)
    except MicrophoneError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    _active_session = session
    _active_session_id = uuid.uuid4().hex[:10]
    return RecordingActionResponse(
        state="recording",
        message="Local microphone recording started.",
        session_id=_active_session_id,
    )


@router.post("/api/recording/pause", response_model=RecordingActionResponse)
def pause_recording() -> RecordingActionResponse:
    _mic_capture.pause()
    return RecordingActionResponse(
        state=_mic_capture.state,  # type: ignore[arg-type]
        message="Recording paused.",
        session_id=_active_session_id,
    )


@router.post("/api/recording/stop")
async def stop_recording() -> dict:
    global _active_session, _active_session_id
    _mic_capture.stop()
    events = []
    segments = []
    if _active_session is not None:
        events = await asyncio.to_thread(_active_session.process_step, True)
        segments = [s.model_dump() for s in _active_session.final_segments]
        _active_session = None
    sid = _active_session_id
    _active_session_id = None
    return {
        "state": "idle",
        "session_id": sid,
        "events": events,
        "segments": segments,
    }


@router.post("/api/speech/transcribe")
async def transcribe_file_banglish(
    file: UploadFile = File(...),
    language: str = Form("auto"),
    output_style: str = Form("mixed"),
    beam_size: int = Form(5),
    vad_sensitivity: float = Form(0.45),
    punctuation: bool = Form(True),
) -> dict:
    """Transcribe an uploaded audio file/blob using kayees/whisper-medium-bn-en-cs-faster."""
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty audio payload")

    suffix = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(raw)
        tmp_path = tmp.name

    try:
        import av

        container = av.open(tmp_path)
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
        settings = TranscriptionSettings(
            language=language,  # type: ignore[arg-type]
            output_style=output_style,  # type: ignore[arg-type]
            beam_size=beam_size,
            vad_sensitivity=vad_sensitivity,
            punctuation=punctuation,
        )
        t0 = time.perf_counter()
        segments = await asyncio.to_thread(engine.transcribe_array, audio_16k, settings)
        latency_ms = int((time.perf_counter() - t0) * 1000)
        full_text = " ".join(s["text"] for s in segments).strip()
        return {
            "text": full_text,
            "segments": segments,
            "latency_ms": latency_ms,
            "engine": engine.config.model_id,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Speech transcription error: {exc}") from exc
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@router.post("/api/speech/export")
def export_transcript(req: ExportRequest) -> PlainTextResponse:
    content = export_srt(req.segments) if req.format == "srt" else export_txt(req.segments)
    if req.save_locally and content.strip():
        ext = "srt" if req.format == "srt" else "txt"
        out_path = TRANSCRIPTS_DIR / f"transcript_{int(time.time())}.{ext}"
        out_path.write_text(content, encoding="utf-8")
    return PlainTextResponse(content)


@router.websocket("/ws/transcribe")
async def websocket_transcribe(ws: WebSocket) -> None:
    """Real-time WebSocket endpoint: accepts Float32/Int16 16kHz PCM frames + JSON control."""
    await ws.accept()
    engine = get_speech_engine()
    session = StreamingSession(engine)
    paused = False

    await ws.send_json({"type": "status", "status": "connected", "model": engine.config.model_id})

    try:
        while True:
            msg = await ws.receive()
            if msg.get("type") == "websocket.disconnect":
                break

            if msg.get("bytes") is not None:
                if paused:
                    continue
                raw_bytes = msg["bytes"]
                # Accept 16kHz float32 PCM frames from browser AudioWorklet / ScriptProcessor
                samples = np.frombuffer(raw_bytes, dtype=np.float32)
                if samples.size > 0:
                    session.push_audio(samples)
                    events = await asyncio.to_thread(session.process_step, False)
                    for ev in events:
                        await ws.send_json(ev)

            elif msg.get("text") is not None:
                try:
                    ctrl = json.loads(msg["text"])
                except json.JSONDecodeError:
                    await ws.send_json({"type": "error", "error": "Invalid JSON control message"})
                    continue

                ctype = ctrl.get("type")
                if ctype == "config":
                    cfg = TranscriptionSettings(**ctrl.get("settings", {}))
                    session.update_settings(cfg)
                    await ws.send_json({"type": "status", "status": "configured"})
                elif ctype == "pause":
                    paused = True
                    await ws.send_json({"type": "status", "status": "paused"})
                elif ctype == "resume":
                    paused = False
                    await ws.send_json({"type": "status", "status": "recording"})
                elif ctype in ("flush", "stop"):
                    events = await asyncio.to_thread(session.process_step, True)
                    for ev in events:
                        await ws.send_json(ev)
                    await ws.send_json({"type": "status", "status": "stopped" if ctype == "stop" else "flushed"})
                    if ctype == "stop":
                        break
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await ws.send_json({"type": "error", "error": str(exc)})
        except Exception:
            pass
