"""Lecture Studio APIs: offline audio file transcription, summary, topics & notes extraction."""

from __future__ import annotations

import json
import re
import time
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..core.security import sanitize_filename, validate_file_bytes
from ..db import db_session, new_id, row_to_dict
from ..services.bhai_agent import generate_with_fallback
from ..services.ingestion.worker import ingest_bytes_immediate

router = APIRouter(prefix="/api/lectures", tags=["lectures"])


@router.get("")
def list_lectures(course_id: str | None = None) -> list[dict]:
    with db_session() as conn:
        sql = "SELECT * FROM lecture_transcripts"
        params: tuple = ()
        if course_id:
            sql += " WHERE course_id = ?"
            params = (course_id,)
        sql += " ORDER BY created_at DESC LIMIT 30"
        rows = conn.execute(sql, params).fetchall()
    out = []
    for r in rows:
        d = row_to_dict(r) or {}
        d["segments"] = json.loads(d.pop("segments_json", "[]"))
        d["topics"] = json.loads(d.pop("topics_json", "[]"))
        out.append(d)
    return out


@router.post("/upload-analyze")
async def upload_and_analyze_lecture(
    file: UploadFile = File(...),
    course_id: str | None = Form(None),
    title: str = Form(""),
    model: str = Form("qwen2.5:3b"),
    ui_language: str = Form("en"),
) -> dict:
    """Transcribe an uploaded lecture recording locally, extract summary/topics/notes, and persist."""
    raw = await file.read()
    clean_name = sanitize_filename(file.filename or "lecture.wav")
    validate_file_bytes(clean_name, file.content_type or "audio/wav", raw)

    # Index audio inside documents + doc_chunks using audio_adapter
    doc = await ingest_bytes_immediate(
        raw_bytes=raw,
        filename=clean_name,
        mime_type=file.content_type or "audio/wav",
        pipeline="ocr",
        course_id=course_id,
    )

    with db_session() as conn:
        chunk_rows = conn.execute(
            "SELECT content FROM doc_chunks WHERE doc_id = ? ORDER BY page_num ASC", (doc["id"],)
        ).fetchall()
    transcript_text = "\n".join(r["content"] for r in chunk_rows)
    segments = [
        {"line": idx, "text": ln.strip()}
        for idx, ln in enumerate(transcript_text.splitlines(), start=1)
        if ln.strip()
    ]

    summary = ""
    topics: list[str] = []
    lang_note = "Respond in clean Unicode Bangla." if ui_language == "bn" else "Respond concisely in English."
    prompt = (
        f"Analyze this university lecture transcript.\n{transcript_text[:2500]}\n\n"
        f'Return ONLY JSON: {{"summary": "3-sentence lecture notes summary", "topics": ["Topic 1", "Topic 2", "Topic 3"]}}. {lang_note}'
    )
    try:
        raw_ai, _, _ = await generate_with_fallback(model, [{"role": "user", "content": prompt}])
        m = re.search(r"\{.*\}", raw_ai, re.DOTALL)
        if m:
            parsed = json.loads(m.group(0))
            summary = str(parsed.get("summary", ""))
            topics = [str(t) for t in parsed.get("topics", [])][:8]
    except Exception:
        pass

    if not summary:
        summary = transcript_text[:320] or f"Uploaded lecture audio: {clean_name}"
    if not topics:
        topics = [title.strip() or Path(clean_name).stem]

    lid = new_id("lec")
    now = time.time()
    lec_title = title.strip() or clean_name
    with db_session() as conn:
        conn.execute(
            """
            INSERT INTO lecture_transcripts (id, course_id, title, audio_path, segments_json, summary, topics_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (lid, course_id, lec_title, doc.get("file_path"), json.dumps(segments), summary, json.dumps(topics), now),
        )
        row = conn.execute("SELECT * FROM lecture_transcripts WHERE id = ?", (lid,)).fetchone()
    out = row_to_dict(row) or {}
    out["segments"] = json.loads(out.pop("segments_json", "[]"))
    out["topics"] = json.loads(out.pop("topics_json", "[]"))
    out["document_id"] = doc.get("id")
    return out


@router.delete("/{lecture_id}")
def delete_lecture(lecture_id: str) -> dict:
    with db_session() as conn:
        cur = conn.execute("DELETE FROM lecture_transcripts WHERE id = ?", (lecture_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Lecture not found")
    return {"deleted": lecture_id}
