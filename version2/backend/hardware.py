"""Hardware-aware model manager & offline Ollama connector."""

from __future__ import annotations

import os
import platform
import subprocess
from typing import Any

import httpx

OLLAMA_BASE = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")

MODEL_CATALOG: list[dict[str, Any]] = [
    {
        "id": "qwen2.5:1.5b",
        "name": "Qwen 2.5 · 1.5B (Q4)",
        "tier": "low",
        "disk_gb": 1.0,
        "ram_gb": 2.5,
        "est_tok_s": "28–45 tok/s",
        "bangla_rating": "Good (3/5)",
        "vision": False,
        "role": "chat",
    },
    {
        "id": "qwen2.5:3b",
        "name": "Qwen 2.5 · 3B (Q4)",
        "tier": "low",
        "disk_gb": 1.9,
        "ram_gb": 4.0,
        "est_tok_s": "18–30 tok/s",
        "bangla_rating": "Very Good (4/5)",
        "vision": False,
        "role": "chat",
    },
    {
        "id": "moondream:latest",
        "name": "Moondream 2 (Vision)",
        "tier": "low",
        "disk_gb": 1.7,
        "ram_gb": 3.5,
        "est_tok_s": "15–22 tok/s",
        "bangla_rating": "English/Caption",
        "vision": True,
        "role": "vision",
    },
    {
        "id": "qwen2.5:7b",
        "name": "Qwen 2.5 · 7B (Q4)",
        "tier": "mid",
        "disk_gb": 4.7,
        "ram_gb": 8.0,
        "est_tok_s": "9–16 tok/s",
        "bangla_rating": "Excellent (5/5)",
        "vision": False,
        "role": "chat",
    },
    {
        "id": "llama3.2:3b",
        "name": "Llama 3.2 · 3B (Q4)",
        "tier": "mid",
        "disk_gb": 2.0,
        "ram_gb": 4.0,
        "est_tok_s": "18–28 tok/s",
        "bangla_rating": "Fair (3/5)",
        "vision": False,
        "role": "chat",
    },
    {
        "id": "llava-phi3:latest",
        "name": "LLaVA-Phi3 (Vision)",
        "tier": "mid",
        "disk_gb": 2.9,
        "ram_gb": 5.5,
        "est_tok_s": "12–18 tok/s",
        "bangla_rating": "Good Vision",
        "vision": True,
        "role": "vision",
    },
    {
        "id": "bge-m3:latest",
        "name": "BGE-M3 (Bangla+EN Embeddings)",
        "tier": "high",
        "disk_gb": 1.2,
        "ram_gb": 2.2,
        "est_tok_s": "Batch embed",
        "bangla_rating": "Multilingual 5/5",
        "vision": False,
        "role": "embed",
    },
    {
        "id": "nomic-embed-text:latest",
        "name": "Nomic Embed Text",
        "tier": "mid",
        "disk_gb": 0.27,
        "ram_gb": 0.8,
        "est_tok_s": "Fast embed",
        "bangla_rating": "English-first",
        "vision": False,
        "role": "embed",
    },
]


def detect_hardware() -> dict[str, Any]:
    """Detect total RAM, CPU cores, and GPU presence cross-platform without heavy deps."""
    total_ram_gb = 8.0
    used_ram_gb = 4.2
    sys_name = platform.system()
    cpu_count = os.cpu_count() or 4

    try:
        if sys_name == "Darwin":
            mem_bytes = int(subprocess.check_output(["sysctl", "-n", "hw.memsize"], text=True).strip())
            total_ram_gb = round(mem_bytes / (1024 ** 3), 1)
            vm = subprocess.check_output(["vm_stat"], text=True)
            pages_active = 0
            pages_wired = 0
            for line in vm.splitlines():
                if "Pages active:" in line:
                    pages_active = int(line.split(":")[1].strip().rstrip("."))
                elif "Pages wired down:" in line:
                    pages_wired = int(line.split(":")[1].strip().rstrip("."))
            used_ram_gb = round(((pages_active + pages_wired) * 16384) / (1024 ** 3), 1)
        elif sys_name == "Linux" and os.path.exists("/proc/meminfo"):
            info = {}
            with open("/proc/meminfo") as f:
                for line in f:
                    k, v = line.split(":", 1)
                    info[k.strip()] = int(v.strip().split()[0])
            total_ram_gb = round(info.get("MemTotal", 8_000_000) / (1024 ** 2), 1)
            avail = info.get("MemAvailable", 4_000_000) / (1024 ** 2)
            used_ram_gb = round(max(0.5, total_ram_gb - avail), 1)
    except Exception:
        pass

    if total_ram_gb <= 8.5:
        tier = "low"
        recommended = ["qwen2.5:3b", "moondream:latest", "nomic-embed-text:latest"]
    elif total_ram_gb <= 16.5:
        tier = "mid"
        recommended = ["qwen2.5:7b", "llama3.2:3b", "llava-phi3:latest", "bge-m3:latest"]
    else:
        tier = "high"
        recommended = ["qwen2.5:7b", "llava-phi3:latest", "bge-m3:latest"]

    ram_pct = min(99, max(5, round((used_ram_gb / max(total_ram_gb, 1)) * 100)))
    return {
        "os": sys_name,
        "arch": platform.machine(),
        "cpu_cores": cpu_count,
        "total_ram_gb": total_ram_gb,
        "used_ram_gb": used_ram_gb,
        "ram_percent": ram_pct,
        "tier": tier,
        "recommended_models": recommended,
        "gpu": "Apple Silicon Unified" if (sys_name == "Darwin" and platform.machine() == "arm64") else "CPU / Integrated",
    }


async def check_ollama() -> dict[str, Any]:
    """Check local Ollama daemon and installed models (localhost only)."""
    try:
        async with httpx.AsyncClient(timeout=2.5) as client:
            r = await client.get(f"{OLLAMA_BASE}/api/tags")
            if r.status_code == 200:
                models = r.json().get("models", [])
                installed = [
                    {
                        "name": m["name"],
                        "size_gb": round(m.get("size", 0) / (1024 ** 3), 2),
                    }
                    for m in models
                ]
                return {"online": True, "installed": installed}
    except Exception:
        pass
    return {"online": False, "installed": []}
