"""
BhaiOS Local Backend Server (FastAPI + Ollama + Local Whisper + PyPDF)
Serves the version1 UI and provides real offline AI inference, vision, voice, and model management.
"""

from __future__ import annotations

import base64
import json
import os
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pypdf import PdfReader

BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parent
MODELS_DIR = REPO_ROOT / "models" / "whisper"
UPLOADS_DIR = REPO_ROOT / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")

app = FastAPI(title="BhaiOS Local Backend", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for uploaded document chunks (kept strictly local)
UPLOADED_DOCS: list[dict[str, Any]] = []
_whisper_model = None

SUGGESTED_MODELS = [
    {
        "name": "qwen2.5:3b",
        "title": "Qwen 2.5 (3B)",
        "category": "Text",
        "size": "1.9 GB",
        "ram": "4 GB RAM",
        "tags": ["Bangla + English", "Fast", "Recommended"],
        "description": "Balanced bilingual text model for Guide Mode hints and explanations.",
    },
    {
        "name": "qwen2.5vl:3b",
        "title": "Qwen 2.5 VL (3B)",
        "category": "Vision",
        "size": "3.2 GB",
        "ram": "6 GB RAM",
        "tags": ["Vision", "Handwriting", "Diagrams"],
        "description": "Best compact VLM for reading Bangla/English handwritten notes & diagrams.",
    },
    {
        "name": "llava-phi3:latest",
        "title": "LLaVA-Phi3",
        "category": "Vision",
        "size": "2.9 GB",
        "ram": "5 GB RAM",
        "tags": ["Vision", "Fast"],
        "description": "Lightweight vision-language model for screenshots and printed pages.",
    },
    {
        "name": "gemma3:4b",
        "title": "Gemma 3 (4B)",
        "category": "Vision",
        "size": "3.3 GB",
        "ram": "6 GB RAM",
        "tags": ["Multimodal", "Bangla", "Google"],
        "description": "Strong multilingual + vision reasoning on 16 GB laptops.",
    },
    {
        "name": "moondream:latest",
        "title": "Moondream 2",
        "category": "Vision",
        "size": "1.7 GB",
        "ram": "3 GB RAM",
        "tags": ["Vision", "Ultra-light"],
        "description": "Ultra-fast vision model for low-RAM laptops.",
    },
    {
        "name": "llama3.2:1b",
        "title": "Llama 3.2 (1B)",
        "category": "Text",
        "size": "1.3 GB",
        "ram": "2 GB RAM",
        "tags": ["Fast", "English"],
        "description": "Tiny, instant-response model for quick tasks.",
    },
]

GUIDE_SYSTEM_PROMPT = """You are BhaiOS, a warm, supportive "big brother" study assistant for Bangladeshi university students.
You are in GUIDE-FIRST MODE:
1. NEVER give the final direct answer or complete solved homework immediately.
2. Give a helpful hint, break the problem into one small step, or ask a guiding Socratic question so the student thinks and solves it themselves.
3. If the student asks in Bangla (or asks for Bangla), respond naturally in clear Bangla (and/or English if helpful).
4. Keep your response concise (2-4 sentences) and encouraging.
5. Ground your hints in the student's uploaded notes when provided."""

ANSWER_SYSTEM_PROMPT = """You are BhaiOS, a local-first study assistant for Bangladeshi university students.
You are in DIRECT ANSWER MODE:
1. Give a clear, accurate, step-by-step explanation and direct answer.
2. Respond in the same language the student uses (Bangla or English).
3. Ground your answer in the student's uploaded notes when provided."""


def get_whisper():
    global _whisper_model
    if _whisper_model is None:
        import whisper

        _whisper_model = whisper.load_model("base", download_root=str(MODELS_DIR))
    return _whisper_model


class ChatRequest(BaseModel):
    message: str
    mode: str = "guide"
    model: str = "qwen2.5:3b"
    vision_model: str = "llava-phi3:latest"
    image_base64: str | None = None
    history: list[dict[str, str]] = []


class PullModelRequest(BaseModel):
    name: str


class SuggestRequest(BaseModel):
    prefix: str
    lang: str = "bn"
    model: str = "qwen2.5:0.5b"


@app.post("/api/suggest")
async def ai_suggest(req: SuggestRequest) -> dict[str, Any]:
    prompt = (
        f"Complete or suggest 3 short study questions in {'Bangla' if req.lang == 'bn' else 'English'} "
        f"starting from: '{req.prefix}'. Return ONLY 3 lines, no numbering or quotes."
    )
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={"model": req.model, "prompt": prompt, "stream": False, "options": {"num_predict": 60}},
            )
            r.raise_for_status()
            lines = [ln.strip("- •0123456789. ") for ln in (r.json().get("response") or "").splitlines() if ln.strip()]
            return {"suggestions": lines[:3]}
    except Exception:
        return {"suggestions": []}


@app.get("/api/health")
async def health() -> dict[str, Any]:
    ollama_ok = False
    installed_count = 0
    try:
        async with httpx.AsyncClient(timeout=2.5) as client:
            r = await client.get(f"{OLLAMA_URL}/api/tags")
            if r.status_code == 200:
                ollama_ok = True
                installed_count = len(r.json().get("models", []))
    except Exception:
        pass
    whisper_ready = (MODELS_DIR / "base.pt").exists()
    return {
        "status": "ok",
        "ollama": ollama_ok,
        "installed_models": installed_count,
        "whisper_base": whisper_ready,
    }


@app.get("/api/models")
async def list_models() -> dict[str, Any]:
    installed: list[dict[str, Any]] = []
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{OLLAMA_URL}/api/tags")
            r.raise_for_status()
            for m in r.json().get("models", []):
                size_gb = round(m.get("size", 0) / (1024**3), 2)
                installed.append(
                    {
                        "name": m["name"],
                        "size": f"{size_gb} GB" if size_gb >= 1 else f"{round(m.get('size', 0) / (1024**2))} MB",
                        "modified": m.get("modified_at", ""),
                        "family": m.get("details", {}).get("family", ""),
                        "params": m.get("details", {}).get("parameter_size", ""),
                        "is_vision": any(
                            k in m["name"].lower() for k in ("vl", "llava", "moondream", "vision", "gemma3")
                        ),
                    }
                )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Ollama unreachable: {exc}")

    installed_names = {m["name"] for m in installed}
    suggestions = [
        {**s, "installed": s["name"] in installed_names} for s in SUGGESTED_MODELS
    ]
    whisper_installed = (MODELS_DIR / "base.pt").exists()
    return {
        "installed": installed,
        "suggestions": suggestions,
        "whisper": {"name": "whisper-base", "size": "139 MB", "installed": whisper_installed},
    }


@app.post("/api/models/pull")
async def pull_model(req: PullModelRequest):
    async def event_stream():
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST", f"{OLLAMA_URL}/api/pull", json={"name": req.name, "stream": True}
            ) as resp:
                async for line in resp.aiter_lines():
                    if line:
                        yield line + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@app.delete("/api/models/{name:path}")
async def delete_model(name: str) -> dict[str, str]:
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.request("DELETE", f"{OLLAMA_URL}/api/delete", json={"name": name})
        if r.status_code not in (200, 204):
            raise HTTPException(status_code=r.status_code, detail=r.text)
    return {"deleted": name}


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), pipeline: str = Form("VLM")) -> dict[str, Any]:
    content = await file.read()
    filename = file.filename or "upload"
    dest = UPLOADS_DIR / filename
    dest.write_bytes(content)

    ext = dest.suffix.lower()
    extracted_text = ""
    image_base64: str | None = None
    pages = 1

    if ext == ".pdf":
        try:
            reader = PdfReader(str(dest))
            pages = len(reader.pages)
            extracted_text = "\n\n".join(
                (p.extract_text() or "").strip() for p in reader.pages[:8]
            ).strip()
        except Exception as exc:
            extracted_text = f"[PDF read error: {exc}]"
    elif ext in {".png", ".jpg", ".jpeg", ".webp"}:
        image_base64 = base64.b64encode(content).decode("utf-8")
        extracted_text = f"[Image uploaded: {filename} — ready for Vision-Language inspection]"

    doc_entry = {
        "id": f"doc-{int(time.time() * 1000)}",
        "filename": filename,
        "pages": pages,
        "size_mb": round(max(0.1, len(content) / (1024 * 1024)), 2),
        "pipeline": pipeline,
        "text": extracted_text[:4000],
        "image_base64": image_base64,
    }
    UPLOADED_DOCS.insert(0, doc_entry)
    return {
        "id": doc_entry["id"],
        "filename": filename,
        "pages": pages,
        "size": f"{doc_entry['size_mb']} MB",
        "has_image": image_base64 is not None,
        "image_base64": image_base64,
        "preview": extracted_text[:240],
    }


@app.post("/api/transcribe")
async def transcribe_audio(file: UploadFile = File(...), language: str = Form("auto")) -> dict[str, Any]:
    audio_bytes = await file.read()
    suffix = Path(file.filename or "audio.webm").suffix or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        t0 = time.perf_counter()
        model = get_whisper()
        kwargs = {"language": language} if language in ("bn", "en") else {}
        result = model.transcribe(tmp_path, **kwargs)
        elapsed = round(time.perf_counter() - t0, 2)
        return {
            "text": (result.get("text") or "").strip(),
            "language": result.get("language", language),
            "latency_s": elapsed,
        }
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@app.post("/api/chat")
async def chat(req: ChatRequest) -> dict[str, Any]:
    t0 = time.perf_counter()
    system_prompt = GUIDE_SYSTEM_PROMPT if req.mode == "guide" else ANSWER_SYSTEM_PROMPT

    # Attach latest uploaded text context if available
    doc_snippets = [d["text"] for d in UPLOADED_DOCS if d.get("text") and not d.get("image_base64")]
    if doc_snippets:
        system_prompt += "\n\nStudent's uploaded notes context:\n" + "\n---\n".join(doc_snippets[:2])[:2500]

    # Pick vision model if an image is attached (either in request or most recent uploaded image)
    img_b64 = req.image_base64
    if not img_b64 and any(d.get("image_base64") for d in UPLOADED_DOCS[:1]):
        img_b64 = UPLOADED_DOCS[0]["image_base64"]

    target_model = req.vision_model if img_b64 else req.model

    messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
    for h in req.history[-6:]:
        if h.get("role") in ("user", "assistant") and h.get("content"):
            messages.append({"role": h["role"], "content": h["content"]})

    user_msg: dict[str, Any] = {"role": "user", "content": req.message}
    if img_b64:
        user_msg["images"] = [img_b64]
    messages.append(user_msg)

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json={"model": target_model, "messages": messages, "stream": False},
            )
            r.raise_for_status()
            data = r.json()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Ollama error ({target_model}): {exc}")

    elapsed = round(time.perf_counter() - t0, 1)
    reply_text = data.get("message", {}).get("content", "").strip()
    prompt_tok = int(data.get("prompt_eval_count", 0) or 0)
    eval_tok = int(data.get("eval_count", 0) or 0)
    return {
        "reply": reply_text,
        "model_used": target_model,
        "used_vision": bool(img_b64),
        "latency_s": elapsed,
        "prompt_tokens": prompt_tok,
        "completion_tokens": eval_tok,
        "total_tokens": prompt_tok + eval_tok,
    }


app.mount("/", StaticFiles(directory=str(BASE_DIR), html=True), name="static")

if __name__ == "__main__":
    import socket
    import uvicorn

    def pick_port(candidates=(8080, 8000, 8001, 8002)) -> int:
        for p in candidates:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex(("127.0.0.1", p)) != 0:
                    return p
        return 8000

    port = int(os.environ.get("PORT", pick_port()))
    print(f"\n  BhaiOS running at: http://127.0.0.1:{port}\n")
    uvicorn.run(app, host="127.0.0.1", port=port)
