"""Hardware telemetry, Ollama health & privacy export/reset endpoints."""

from __future__ import annotations

import os
import platform
import subprocess
import time

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..config import OLLAMA_URL
from ..db import db_session, get_setting, set_setting

router = APIRouter(prefix="/api", tags=["health"])
START_TIME = time.time()


class SettingsUpdate(BaseModel):
    google_api_key: str | None = None


class ResetWorkspaceRequest(BaseModel):
    confirm: str


def _get_ram_info_gb() -> tuple[float, float]:
    """Return (used_gb, total_gb) on macOS or Linux without external psutil dependency."""
    system = platform.system()
    try:
        if system == "Darwin":
            total_bytes = int(subprocess.check_output(["sysctl", "-n", "hw.memsize"]).strip())
            total_gb = total_bytes / (1024**3)
            vm_out = subprocess.check_output(["vm_stat"]).decode()
            page_size = 16384
            for line in vm_out.splitlines():
                if "page size of" in line:
                    page_size = int(line.split("page size of")[1].split("bytes")[0].strip())
                    break
            stats: dict[str, int] = {}
            for line in vm_out.splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    v = v.strip().rstrip(".")
                    if v.isdigit():
                        stats[k.strip()] = int(v)
            used_pages = (
                stats.get("Pages active", 0)
                + stats.get("Pages wired down", 0)
                + stats.get("Pages occupied by compressor", 0)
            )
            used_gb = (used_pages * page_size) / (1024**3)
            return round(used_gb, 1), round(total_gb, 1)
        elif system == "Linux" and os.path.exists("/proc/meminfo"):
            info: dict[str, int] = {}
            with open("/proc/meminfo", encoding="utf-8") as f:
                for line in f:
                    parts = line.split(":")
                    if len(parts) == 2:
                        val = parts[1].strip().split()[0]
                        if val.isdigit():
                            info[parts[0].strip()] = int(val)
            total_kb = info.get("MemTotal", 0)
            avail_kb = info.get("MemAvailable", info.get("MemFree", 0))
            total_gb = total_kb / (1024**2)
            used_gb = (total_kb - avail_kb) / (1024**2)
            return round(used_gb, 1), round(total_gb, 1)
    except Exception:
        pass
    return 0.0, 16.0


@router.get("/health")
async def get_health() -> dict:
    used_gb, total_gb = _get_ram_info_gb()
    ram_percent = round((used_gb / total_gb) * 100, 1) if total_gb > 0 else 0.0

    ollama_online = False
    running_models: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            tags_resp = await client.get(f"{OLLAMA_URL}/api/tags")
            if tags_resp.status_code == 200:
                ollama_online = True
            ps_resp = await client.get(f"{OLLAMA_URL}/api/ps")
            if ps_resp.status_code == 200:
                running_models = ps_resp.json().get("models", [])
    except Exception:
        ollama_online = False

    return {
        "status": "ok",
        "ollama_online": ollama_online,
        "running_models": running_models,
        "ram_used_gb": used_gb,
        "ram_total_gb": total_gb,
        "ram_percent": ram_percent,
        "platform": platform.system(),
        "uptime_seconds": int(time.time() - START_TIME),
    }


@router.get("/settings")
def read_settings() -> dict:
    key = get_setting("google_api_key", "")
    masked = f"{key[:6]}...{key[-4:]}" if len(key) > 10 else ("configured" if key else "")
    return {"has_google_api_key": bool(key), "google_api_key_masked": masked}


@router.post("/settings")
def update_settings(req: SettingsUpdate) -> dict:
    if req.google_api_key is not None:
        set_setting("google_api_key", req.google_api_key.strip())
    return read_settings()


@router.get("/settings/export")
def export_workspace_json() -> JSONResponse:
    """Export student's local academic data cleanly as JSON for backup & portability."""
    tables = [
        "universities", "departments", "academic_years", "semesters",
        "courses", "course_topics", "documents", "flashcards",
        "quiz_sessions", "tasks", "focus_sessions", "knowledge_relationships", "lecture_transcripts",
    ]
    bundle: dict[str, object] = {"exported_at": time.time(), "schema_version": 3}
    with db_session() as conn:
        for tbl in tables:
            try:
                rows = conn.execute(f"SELECT * FROM {tbl}").fetchall()
                bundle[tbl] = [dict(r) for r in rows]
            except Exception:
                bundle[tbl] = []
    return JSONResponse(
        content=bundle,
        headers={"Content-Disposition": 'attachment; filename="bhaios-workspace-export.json"'},
    )


@router.post("/settings/reset-workspace")
def reset_workspace(req: ResetWorkspaceRequest) -> dict:
    """Privacy control: wipe study history/uploads without touching downloaded local models."""
    if req.confirm.strip() != "RESET":
        raise HTTPException(status_code=400, detail="Confirmation text must equal 'RESET'")
    tables = [
        "doc_chunks_fts", "document_assets", "document_pages", "doc_chunks",
        "ingestion_jobs", "knowledge_relationships", "lecture_transcripts",
        "quiz_questions", "quiz_sessions", "flashcards", "topic_mastery",
        "messages", "chats", "tasks", "focus_sessions", "documents",
        "course_topics", "courses", "semesters", "academic_years", "departments", "universities",
    ]
    with db_session() as conn:
        for tbl in tables:
            try:
                conn.execute(f"DELETE FROM {tbl}")
            except Exception:
                pass
    return {"reset": True}
