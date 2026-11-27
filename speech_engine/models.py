"""Pydantic & dataclass schemas for BhaiOS Local Speech Engine."""

from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field

LanguageOption = Literal["auto", "bn", "en"]
OutputStyle = Literal["mixed", "bn_script", "roman_banglish"]


class TranscriptionSettings(BaseModel):
    language: LanguageOption = "auto"
    output_style: OutputStyle = "mixed"
    chunk_seconds: float = Field(default=6.0, ge=2.0, le=12.0)
    overlap_seconds: float = Field(default=1.5, ge=0.5, le=4.0)
    vad_sensitivity: float = Field(default=0.45, ge=0.1, le=0.9)
    beam_size: int = Field(default=5, ge=1, le=8)
    punctuation: bool = True
    save_locally: bool = True


class TranscriptSegment(BaseModel):
    id: str
    start: float
    end: float
    text: str
    language: str = "bn"
    is_final: bool = True


class EngineStatus(BaseModel):
    model_id: str
    local_path: str
    model_cached: bool
    model_loaded: bool
    compute_type: str
    device: str
    offline_ready: bool
    recording_state: Literal["idle", "recording", "paused"] = "idle"


class RecordingActionResponse(BaseModel):
    state: Literal["idle", "recording", "paused"]
    message: str
    session_id: str | None = None
