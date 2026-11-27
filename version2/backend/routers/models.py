"""Local Model Dashboard, Lifecycle Manager, Router Config & Installation Manager."""

from __future__ import annotations

import os
import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..config import OLLAMA_URL, SUGGESTED_MODELS, WEAK_MODELS
from ..core.offline_guard import get_blocked_network_log, is_offline_mode
from ..db import set_setting
from ..services.model_manager import (
    check_model_compatibility,
    get_full_model_dashboard,
    pull_ollama_model_stream,
    test_ollama_model,
    unload_ollama_model,
)
from .health import _get_ram_info_gb

router = APIRouter(prefix="/api/models", tags=["models"])


class PullModelRequest(BaseModel):
    name: str


class ModelConfigRequest(BaseModel):
    intelligence_mode: str | None = None
    context_window: int | None = None
    max_tokens: int | None = None
    model_timeout_sec: int | None = None
    custom_models_path: str | None = None
    ollama_models_path: str | None = None
    offline_mode: bool | None = None


def _format_size(size_bytes: int) -> str:
    if size_bytes >= 1024**3:
        return f"{size_bytes / (1024**3):.1f} GB"
    if size_bytes >= 1024**2:
        return f"{size_bytes / (1024**2):.0f} MB"
    return f"{size_bytes} B"


@router.get("")
async def list_models() -> dict:
    installed: list[dict] = []
    ollama_online = False
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{OLLAMA_URL}/api/tags")
            if resp.status_code == 200:
                ollama_online = True
                for m in resp.json().get("models", []):
                    name = m.get("name", "")
                    if name in WEAK_MODELS:
                        continue
                    size_bytes = int(m.get("size", 0) or 0)
                    details = m.get("details", {}) or {}
                    is_vision = any(
                        v in name.lower() for v in ("vl", "llava", "moondream", "vision", "qwen3.5")
                    )
                    installed.append(
                        {
                            "name": name,
                            "size_bytes": size_bytes,
                            "size": _format_size(size_bytes),
                            "parameter_size": details.get("parameter_size", ""),
                            "quantization": details.get("quantization_level", ""),
                            "family": details.get("family", ""),
                            "is_vision": is_vision,
                        }
                    )
    except Exception:
        pass

    installed_names = {m["name"] for m in installed}
    suggested = [{**s, "installed": s["name"] in installed_names} for s in SUGGESTED_MODELS]
    return {"ollama_online": ollama_online, "installed": installed, "suggested": suggested}


@router.get("/dashboard")
async def models_dashboard() -> dict:
    used_gb, total_gb = _get_ram_info_gb()
    return await get_full_model_dashboard(ram_total_gb=total_gb, ram_used_gb=used_gb)


@router.get("/compatibility/{name:path}")
def model_compatibility(name: str) -> dict:
    _, total_gb = _get_ram_info_gb()
    return check_model_compatibility(name, total_ram_gb=total_gb)


@router.post("/unload")
async def unload_model(req: PullModelRequest) -> dict:
    ok = await unload_ollama_model(req.name)
    return {"unloaded": ok, "model": req.name}


@router.post("/test")
async def test_model(req: PullModelRequest) -> dict:
    return await test_ollama_model(req.name)


@router.post("/config")
async def update_model_config(req: ModelConfigRequest) -> dict:
    if req.intelligence_mode in ("auto", "qwen", "nemotron", "lightweight"):
        set_setting("ai_intelligence_mode", req.intelligence_mode)
    if req.context_window is not None:
        set_setting("ollama_num_ctx", str(max(1024, min(32768, req.context_window))))
    if req.max_tokens is not None:
        set_setting("ollama_num_predict", str(max(128, min(8192, req.max_tokens))))
    if req.model_timeout_sec is not None:
        set_setting("ollama_timeout_sec", str(max(15, min(600, req.model_timeout_sec))))
    if req.custom_models_path is not None:
        set_setting("custom_models_path", req.custom_models_path.strip())
    if req.ollama_models_path is not None:
        set_setting("ollama_models_path", req.ollama_models_path.strip())
    if req.offline_mode is not None:
        os.environ["BHAIOS_OFFLINE_MODE"] = "1" if req.offline_mode else "0"
    used_gb, total_gb = _get_ram_info_gb()
    return await get_full_model_dashboard(ram_total_gb=total_gb, ram_used_gb=used_gb)


@router.get("/offline-audit")
def offline_audit() -> dict:
    return {
        "offline_mode": is_offline_mode(),
        "blocked_outbound_attempts": get_blocked_network_log(),
    }


@router.post("/pull")
async def pull_model(req: PullModelRequest) -> StreamingResponse:
    return StreamingResponse(pull_ollama_model_stream(req.name), media_type="application/x-ndjson")


@router.delete("/{name:path}")
async def delete_model(name: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.request("DELETE", f"{OLLAMA_URL}/api/delete", json={"name": name})
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail="Failed to delete model")
            return {"deleted": name}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Ollama unreachable: {exc}") from exc
