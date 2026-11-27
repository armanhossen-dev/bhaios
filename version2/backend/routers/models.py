"""Local Ollama model discovery, pull, and delete endpoints."""

from __future__ import annotations

import json
import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..config import GEMINI_MODELS, OLLAMA_URL, SUGGESTED_MODELS, WEAK_MODELS
from ..db import get_setting

router = APIRouter(prefix="/api/models", tags=["models"])


class PullModelRequest(BaseModel):
    name: str


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
                        v in name.lower() for v in ("vl", "llava", "moondream", "vision", "gemma3")
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

    google_key = get_setting("google_api_key", "")
    if google_key:
        for gm in GEMINI_MODELS:
            installed.append(
                {
                    "name": gm["name"],
                    "size_bytes": 0,
                    "size": gm["size"],
                    "parameter_size": gm["parameter_size"],
                    "quantization": "API",
                    "family": "gemini",
                    "is_vision": gm["is_vision"],
                }
            )

    installed_names = {m["name"] for m in installed}
    suggested = [
        {**s, "installed": s["name"] in installed_names}
        for s in SUGGESTED_MODELS
    ]
    return {
        "ollama_online": ollama_online,
        "installed": installed,
        "suggested": suggested,
    }


@router.post("/pull")
async def pull_model(req: PullModelRequest) -> StreamingResponse:
    async def event_stream():
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(600.0, connect=5.0)) as client:
                async with client.stream(
                    "POST", f"{OLLAMA_URL}/api/pull", json={"name": req.name, "stream": True}
                ) as resp:
                    if resp.status_code != 200:
                        yield json.dumps({"error": f"Ollama returned {resp.status_code}"}) + "\n"
                        return
                    async for line in resp.aiter_lines():
                        if line.strip():
                            yield line + "\n"
        except Exception as exc:
            yield json.dumps({"error": str(exc)}) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


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
