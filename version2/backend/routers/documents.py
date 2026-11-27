"""Universal Document Intelligence & Visual Studio APIs."""

from __future__ import annotations

import base64
import json
import sqlite3
import time
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel

from ..db import db_session, row_to_dict
from ..ollama_client import inspect_image_with_vlm
from ..rag import clean_bangla_text, retrieve_relevant_chunks
from ..services.ingestion.image_qr_adapter import decode_qr_codes
from ..services.ingestion.worker import (
    _EXECUTOR,
    _run_job_thread,
    enqueue_ingestion_job,
    ingest_bytes_immediate,
)

router = APIRouter(prefix="/api/documents", tags=["documents"])


class VisualAnalyzeRequest(BaseModel):
    doc_id: str
    task: str = "equation"  # qr | equation | diagram | table | code_screenshot
    vision_model: str = "llava-phi3:latest"
    page_number: int = 1


@router.get("")
def list_documents(
    course_id: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    limit = max(1, min(200, limit))
    offset = max(0, offset)
    with db_session() as conn:
        sql = """
            SELECT d.*, COUNT(c.id) AS chunk_count
            FROM documents d
            LEFT JOIN doc_chunks c ON c.doc_id = d.id
        """
        params: list = []
        if course_id:
            sql += " WHERE d.course_id = ?"
            params.append(course_id)
        sql += " GROUP BY d.id ORDER BY d.created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        rows = conn.execute(sql, tuple(params)).fetchall()
    return [row_to_dict(r) for r in rows if r]


@router.get("/search")
def search_documents(
    q: str,
    top_k: int = 5,
    doc_id: str | None = None,
    course_id: str | None = None,
    semester_id: str | None = None,
    file_type: str | None = None,
) -> list[dict]:
    return retrieve_relevant_chunks(
        q,
        top_k=top_k,
        doc_id=doc_id,
        course_id=course_id,
        semester_id=semester_id,
        file_type=file_type,
    )


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    pipeline: str = Form("ocr"),
    vision_model: str = Form("llava-phi3:latest"),
    course_id: str | None = Form(None),
    topic_id: str | None = Form(None),
) -> dict:
    raw_bytes = await file.read()
    return await ingest_bytes_immediate(
        raw_bytes=raw_bytes,
        filename=file.filename or "untitled",
        mime_type=file.content_type or "application/octet-stream",
        pipeline=pipeline,
        vision_model=vision_model,
        course_id=course_id,
        topic_id=topic_id,
    )


@router.post("/batch-upload")
async def batch_upload_documents(
    files: list[UploadFile] = File(...),
    pipeline: str = Form("ocr"),
    vision_model: str = Form("llava-phi3:latest"),
    course_id: str | None = Form(None),
    topic_id: str | None = Form(None),
) -> dict:
    """Queue multiple files into background ingestion worker and return job handles immediately."""
    jobs = []
    for f in files:
        raw_bytes = await f.read()
        job = enqueue_ingestion_job(
            raw_bytes=raw_bytes,
            filename=f.filename or "untitled",
            mime_type=f.content_type or "application/octet-stream",
            pipeline=pipeline,
            vision_model=vision_model,
            course_id=course_id,
            topic_id=topic_id,
        )
        jobs.append(job)
    return {"queued": len(jobs), "jobs": jobs}


@router.get("/jobs")
def list_ingestion_jobs(course_id: str | None = None) -> list[dict]:
    with db_session() as conn:
        sql = "SELECT * FROM ingestion_jobs"
        params: tuple = ()
        if course_id:
            sql += " WHERE course_id = ?"
            params = (course_id,)
        sql += " ORDER BY created_at DESC LIMIT 50"
        rows = conn.execute(sql, params).fetchall()
    return [row_to_dict(r) for r in rows if r]


@router.get("/jobs/{job_id}")
def get_ingestion_job(job_id: str) -> dict:
    with db_session() as conn:
        row = conn.execute("SELECT * FROM ingestion_jobs WHERE id = ?", (job_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Job not found")
    return row_to_dict(row) or {}


@router.post("/jobs/{job_id}/cancel")
def cancel_ingestion_job(job_id: str) -> dict:
    with db_session() as conn:
        row = conn.execute("SELECT * FROM ingestion_jobs WHERE id = ?", (job_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Job not found")
        conn.execute(
            "UPDATE ingestion_jobs SET status = 'cancelled', updated_at = ? WHERE id = ? AND status IN ('queued', 'processing')",
            (time.time(), job_id),
        )
        updated = conn.execute("SELECT * FROM ingestion_jobs WHERE id = ?", (job_id,)).fetchone()
    return row_to_dict(updated) or {}


@router.post("/jobs/{job_id}/retry")
def retry_ingestion_job(job_id: str) -> dict:
    with db_session() as conn:
        job = conn.execute("SELECT * FROM ingestion_jobs WHERE id = ?", (job_id,)).fetchone()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        doc = conn.execute("SELECT * FROM documents WHERE id = ?", (job["document_id"],)).fetchone()
        if not doc or not Path(doc["file_path"]).exists():
            raise HTTPException(status_code=404, detail="Original uploaded file missing")
        raw_bytes = Path(doc["file_path"]).read_bytes()
        conn.execute(
            "UPDATE ingestion_jobs SET status = 'queued', progress = 10, error_message = NULL, updated_at = ? WHERE id = ?",
            (time.time(), job_id),
        )
        updated = conn.execute("SELECT * FROM ingestion_jobs WHERE id = ?", (job_id,)).fetchone()

    _EXECUTOR.submit(
        _run_job_thread,
        job_id,
        doc["id"],
        Path(doc["file_path"]),
        raw_bytes,
        doc["original_name"],
        doc["mime_type"],
        doc["pipeline"],
        "llava-phi3:latest",
        doc["course_id"],
        doc["topic_id"],
    )
    return row_to_dict(updated) or {}


@router.post("/analyze-visual")
async def analyze_visual_document(req: VisualAnalyzeRequest) -> dict:
    """Visual Studio endpoint: OpenCV QR decode (safe preview) + VLM/OCR equation, UML/circuit & table inspection."""
    with db_session() as conn:
        doc = conn.execute("SELECT * FROM documents WHERE id = ?", (req.doc_id,)).fetchone()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    path = Path(doc["file_path"])
    if not path.exists():
        raise HTTPException(status_code=404, detail="File missing on disk")

    img_bytes = b""
    if doc["file_type"] == "pdf" or doc["mime_type"] == "application/pdf":
        import pymupdf

        with pymupdf.open(str(path)) as pdf_doc:
            p_idx = max(0, min(len(pdf_doc) - 1, req.page_number - 1))
            pix = pdf_doc[p_idx].get_pixmap(dpi=150)
            img_bytes = pix.tobytes("png")
    else:
        img_bytes = path.read_bytes()

    qr_payloads = decode_qr_codes(img_bytes)
    task_prompts = {
        "qr": "List and explain any visible QR codes, links, or text labels without executing external scripts.",
        "equation": "Transcribe all mathematical equations accurately in LaTeX ($...$ / $$...$$) and explain each variable concisely.",
        "diagram": "Analyze this diagram, flowchart, UML, or circuit step-by-step and summarize its components and connections.",
        "table": "Extract all tables cleanly in Markdown table format preserving numeric precision and Bangla/English headers.",
        "code_screenshot": "Transcribe the code visible in this screenshot accurately inside a fenced code block and identify any bugs.",
    }
    prompt = task_prompts.get(req.task, task_prompts["diagram"])
    vlm_output = ""
    if req.task != "qr":
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        try:
            vlm_output = clean_bangla_text(
                await inspect_image_with_vlm(req.vision_model, b64, prompt)
            )
        except Exception as exc:
            vlm_output = f"Vision model unavailable ({exc}). OpenCV QR detection still ran locally."

    return {
        "doc_id": req.doc_id,
        "task": req.task,
        "qr_payloads": qr_payloads,
        "analysis": vlm_output,
    }


@router.get("/{doc_id}/pages")
def get_document_pages(doc_id: str) -> list[dict]:
    with db_session() as conn:
        rows = conn.execute(
            "SELECT * FROM document_pages WHERE document_id = ? ORDER BY page_number ASC", (doc_id,)
        ).fetchall()
    out = []
    for r in rows:
        d = row_to_dict(r) or {}
        d["tables"] = json.loads(d.pop("tables_json", "[]"))
        d["equations"] = json.loads(d.pop("equations_json", "[]"))
        d["metadata"] = json.loads(d.pop("metadata_json", "{}"))
        out.append(d)
    return out


@router.get("/{doc_id}/assets")
def get_document_assets(doc_id: str) -> list[dict]:
    with db_session() as conn:
        rows = conn.execute(
            "SELECT * FROM document_assets WHERE document_id = ? ORDER BY page_number ASC, created_at ASC",
            (doc_id,),
        ).fetchall()
    return [row_to_dict(r) for r in rows if r]


@router.get("/{doc_id}/chunks")
def get_document_chunks(doc_id: str) -> list[dict]:
    with db_session() as conn:
        rows = conn.execute(
            "SELECT * FROM doc_chunks WHERE doc_id = ? ORDER BY page_num ASC", (doc_id,)
        ).fetchall()
    return [row_to_dict(r) for r in rows if r]


@router.get("/{doc_id}/content")
def get_document_text_content(doc_id: str) -> PlainTextResponse:
    with db_session() as conn:
        rows = conn.execute(
            "SELECT page_num, content FROM doc_chunks WHERE doc_id = ? ORDER BY page_num ASC",
            (doc_id,),
        ).fetchall()
    if not rows:
        raise HTTPException(status_code=404, detail="Document content not found")
    return PlainTextResponse("\n\n".join(r["content"] for r in rows))


@router.get("/{doc_id}/file")
def get_document_file(doc_id: str):
    with db_session() as conn:
        row = conn.execute("SELECT file_path, original_name, mime_type FROM documents WHERE id = ?", (doc_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    path = Path(row["file_path"])
    if not path.exists():
        raise HTTPException(status_code=404, detail="File missing on disk")
    return FileResponse(str(path), media_type=row["mime_type"], filename=row["original_name"])


@router.delete("/{doc_id}")
def delete_document(doc_id: str) -> dict:
    with db_session() as conn:
        row = conn.execute("SELECT file_path FROM documents WHERE id = ?", (doc_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Document not found")
        file_path = Path(row["file_path"])
        try:
            conn.execute("DELETE FROM doc_chunks_fts WHERE doc_id = ?", (doc_id,))
        except sqlite3.OperationalError:
            pass
        conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
    if file_path.exists():
        file_path.unlink()
    return {"deleted": doc_id}
