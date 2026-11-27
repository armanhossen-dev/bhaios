"""Model Lifecycle, 16GB M4 Memory Guard, Disk Pre-Flight & External SSD Path Manager."""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import time
from pathlib import Path
from typing import Any

import httpx

from ..config import MODELS_ROOT, OLLAMA_MODELS_PATH, OLLAMA_URL, STT_DIR, TTS_DIR
from ..core.model_registry import MODEL_REGISTRY, ModelSpec
from ..core.offline_guard import allow_install_network
from ..db import get_setting, set_setting

_DOWNLOAD_STATUS: dict[str, str] = {}
_RUNTIME_ERRORS: dict[str, str] = {}


def get_storage_info(custom_path: str | None = None) -> dict[str, Any]:
    target = Path(custom_path or get_setting("custom_models_path", "") or MODELS_ROOT)
    check_path = target if target.exists() else target.parent
    try:
        usage = shutil.disk_usage(str(check_path if check_path.exists() else Path.home()))
        free_gb = round(usage.free / (1024**3), 2)
        total_gb = round(usage.total / (1024**3), 2)
    except Exception:
        free_gb, total_gb = 0.0, 0.0
    return {
        "models_root": str(target),
        "ollama_models_path": get_setting("ollama_models_path", OLLAMA_MODELS_PATH),
        "free_gb": free_gb,
        "total_gb": total_gb,
        "external_volumes": [
            str(p) for p in Path("/Volumes").iterdir() if p.is_dir() and p.name != "Macintosh HD"
        ]
        if Path("/Volumes").exists()
        else [],
    }


def check_model_compatibility(model_id: str, total_ram_gb: float = 16.0, free_disk_gb: float | None = None) -> dict[str, Any]:
    spec = MODEL_REGISTRY.get(model_id)
    if free_disk_gb is None:
        free_disk_gb = get_storage_info()["free_gb"]
    if not spec:
        return {"compatible": True, "warnings": [], "reason": "Custom Ollama model"}

    warnings: list[str] = []
    compatible = True
    if spec.min_ram_gb > total_ram_gb * 0.85:
        compatible = False
        warnings.append(f"Requires {spec.min_ram_gb} GB RAM, exceeding safe limit for {total_ram_gb} GB Unified Memory.")
    if spec.size_gb > max(0.0, free_disk_gb - 1.0):
        compatible = False
        warnings.append(f"Needs {spec.size_gb} GB disk (+1 GB headroom); only {free_disk_gb} GB free.")
    return {"compatible": compatible, "warnings": warnings, "spec": spec.to_dict()}


async def get_ollama_state() -> tuple[bool, list[dict[str, Any]], list[dict[str, Any]]]:
    """Return (ollama_online, installed_tags, running_ps)."""
    try:
        async with httpx.AsyncClient(timeout=2.5) as client:
            tags_r = await client.get(f"{OLLAMA_URL}/api/tags")
            ps_r = await client.get(f"{OLLAMA_URL}/api/ps")
            online = tags_r.status_code == 200
            tags = tags_r.json().get("models", []) if online else []
            ps = ps_r.json().get("models", []) if ps_r.status_code == 200 else []
            return online, tags, ps
    except Exception:
        return False, [], []


async def unload_ollama_model(model_name: str) -> bool:
    """Explicitly free unified memory by setting keep_alive=0."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={"model": model_name, "prompt": "", "keep_alive": 0, "stream": False},
            )
            return resp.status_code == 200
    except Exception:
        return False


async def ensure_single_primary_llm(target_model: str) -> list[str]:
    """On 16 GB Apple Silicon, unload other running Ollama LLMs before loading a new primary model."""
    _, _, running = await get_ollama_state()
    unloaded: list[str] = []
    for rm in running:
        rname = rm.get("name", "")
        if rname and rname != target_model:
            if await unload_ollama_model(rname):
                unloaded.append(rname)
    return unloaded


def _is_non_ollama_installed(spec: ModelSpec) -> bool:
    if spec.kind == "stt":
        return (STT_DIR / "whisper-medium-bn-en-cs-faster" / "model.bin").exists()
    if spec.kind == "ocr":
        return bool(shutil.which("tesseract"))
    if spec.kind == "tts":
        if spec.id == "piper-en":
            return bool(shutil.which("piper")) or (TTS_DIR / "piper").exists()
        if spec.id == "facebook/mms-tts-ben":
            return (TTS_DIR / "facebook__mms-tts-ben" / "config.json").exists()
        return Path(spec.storage_path).exists()
    if spec.kind == "embedding":
        hf_cache = Path.home() / ".cache" / "huggingface" / "hub"
        slug = f"models--{spec.id.replace('/', '--')}"
        return (hf_cache / slug).exists() or Path(spec.storage_path).exists()
    return False


async def get_full_model_dashboard(ram_total_gb: float = 16.0, ram_used_gb: float = 0.0) -> dict[str, Any]:
    online, tags, running = await get_ollama_state()
    tag_map = {m.get("name", ""): m for m in tags}
    running_map = {m.get("name", ""): m for m in running}
    storage = get_storage_info()

    items: list[dict[str, Any]] = []
    for spec in MODEL_REGISTRY.values():
        if spec.id == "nemotron-30b":
            continue
        installed = (spec.id in tag_map) if spec.kind == "ollama_llm" else _is_non_ollama_installed(spec)
        is_running = spec.id in running_map
        dl_state = _DOWNLOAD_STATUS.get(spec.id)
        err = _RUNTIME_ERRORS.get(spec.id)

        if err:
            status = "Error"
        elif dl_state == "downloading":
            status = "Downloading"
        elif is_running:
            status = "Running"
        elif installed:
            status = "Ready"
        elif spec.kind == "ollama_llm" and not online:
            status = "Unavailable"
        else:
            status = "Unavailable"

        compat = check_model_compatibility(spec.id, ram_total_gb, storage["free_gb"])
        mem_bytes = running_map.get(spec.id, {}).get("size_vram") or running_map.get(spec.id, {}).get("size") or 0
        items.append(
            {
                **spec.to_dict(),
                "installed": installed,
                "running": is_running,
                "status": status,
                "memory_gb": round(mem_bytes / (1024**3), 2) if mem_bytes else 0.0,
                "compatible": compat["compatible"],
                "warnings": compat["warnings"],
                "error": err,
            }
        )

    # Also include any custom Ollama models installed by the user outside the core registry
    for name, meta in tag_map.items():
        if name not in MODEL_REGISTRY:
            is_running = name in running_map
            items.append(
                {
                    "id": name,
                    "display_name": name,
                    "kind": "ollama_llm",
                    "category": "Custom Local LLM",
                    "size_gb": round((meta.get("size", 0) or 0) / (1024**3), 2),
                    "min_ram_gb": 2.0,
                    "recommended_for": "User-installed Ollama model",
                    "license_note": "See Ollama Modelfile",
                    "storage_path": storage["ollama_models_path"],
                    "optional": True,
                    "installed": True,
                    "running": is_running,
                    "status": "Running" if is_running else "Ready",
                    "memory_gb": 0.0,
                    "compatible": True,
                    "warnings": [],
                    "error": None,
                }
            )

    return {
        "ollama_online": online,
        "ollama_installed": bool(shutil.which("ollama")),
        "offline_mode": os.environ.get("BHAIOS_OFFLINE_MODE", "1") == "1",
        "intelligence_mode": get_setting("ai_intelligence_mode", "auto"),
        "context_window": int(get_setting("ollama_num_ctx", "4096") or 4096),
        "max_tokens": int(get_setting("ollama_num_predict", "1024") or 1024),
        "model_timeout_sec": int(get_setting("ollama_timeout_sec", "120") or 120),
        "ram_total_gb": ram_total_gb,
        "ram_used_gb": ram_used_gb,
        "storage": storage,
        "models": items,
    }


async def pull_ollama_model_stream(model_name: str):
    """Stream pull progress with compatibility check & explicit install-network allowance."""
    compat = check_model_compatibility(model_name)
    if not compat["compatible"]:
        yield json.dumps({"error": " ; ".join(compat["warnings"])}) + "\n"
        return

    _DOWNLOAD_STATUS[model_name] = "downloading"
    _RUNTIME_ERRORS.pop(model_name, None)
    try:
        with allow_install_network():
            async with httpx.AsyncClient(timeout=httpx.Timeout(900.0, connect=10.0)) as client:
                async with client.stream(
                    "POST", f"{OLLAMA_URL}/api/pull", json={"name": model_name, "stream": True}
                ) as resp:
                    if resp.status_code != 200:
                        msg = f"Ollama pull failed ({resp.status_code})"
                        _RUNTIME_ERRORS[model_name] = msg
                        yield json.dumps({"error": msg}) + "\n"
                        return
                    async for line in resp.aiter_lines():
                        if line.strip():
                            yield line + "\n"
    except Exception as exc:
        _RUNTIME_ERRORS[model_name] = str(exc)
        yield json.dumps({"error": str(exc)}) + "\n"
    finally:
        _DOWNLOAD_STATUS.pop(model_name, None)


async def test_ollama_model(model_name: str) -> dict[str, Any]:
    t0 = time.perf_counter()
    await ensure_single_primary_llm(model_name)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": model_name,
                    "messages": [{"role": "user", "content": "Reply with 'OK' only."}],
                    "stream": False,
                    "options": {"num_predict": 16},
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "ok": True,
                "model": model_name,
                "latency_ms": int((time.perf_counter() - t0) * 1000),
                "reply": data.get("message", {}).get("content", "").strip(),
            }
    except Exception as exc:
        _RUNTIME_ERRORS[model_name] = str(exc)
        return {"ok": False, "model": model_name, "error": str(exc)}
