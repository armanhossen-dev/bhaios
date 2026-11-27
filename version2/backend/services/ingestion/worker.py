"""Background ingestion queue worker, normalized chunk persistence & multi-format router."""

from __future__ import annotations

import asyncio
import json
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from ...core.security import (
    compute_sha256,
    safe_resolve_upload_path,
    sanitize_filename,
    validate_file_bytes,
)
from ...db import db_session, new_id, row_to_dict
from ...rag import clean_bangla_text, store_normalized_chunks
from .archive_adapter import parse_zip_manifest
from .audio_adapter import parse_audio
from .base import IngestResult
from .code_adapter import EXT_LANG, parse_code
from .data_adapter import parse_data_or_text
from .image_qr_adapter import parse_image
from .office_adapter import parse_docx, parse_pptx
from .pdf_adapter import parse_pdf

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".tif", ".gif"}
AUDIO_EXTS = {".wav", ".mp3", ".m4a", ".ogg", ".webm", ".flac"}
TEXT_EXTS = {".txt", ".md", ".csv", ".xlsx", ".rtf", ".xml", ".yaml", ".yml"}

_EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="bhaios-ingest")


async def run_adapters(
    *,
    doc_id: str,
    file_path: Path,
    raw_bytes: bytes,
    original_name: str,
    mime_type: str,
    pipeline: str = "ocr",
    vision_model: str = "llava-phi3:latest",
    course_id: str | None = None,
) -> IngestResult:
    ext = Path(original_name).suffix.lower()
    if ext == ".pdf" or mime_type == "application/pdf":
        return await asyncio.to_thread(parse_pdf, doc_id, file_path, original_name, course_id)
    if ext == ".pptx":
        return await asyncio.to_thread(parse_pptx, doc_id, file_path, original_name, course_id)
    if ext == ".docx":
        return await asyncio.to_thread(parse_docx, doc_id, file_path, original_name, course_id)
    if ext in EXT_LANG:
        return parse_code(doc_id, raw_bytes, original_name, course_id)
    if ext in IMAGE_EXTS or mime_type.startswith("image/"):
        return await parse_image(doc_id, raw_bytes, original_name, pipeline, vision_model, course_id)
    if ext in AUDIO_EXTS or mime_type.startswith("audio/"):
        return await parse_audio(doc_id, file_path, original_name, course_id)
    if ext == ".zip":
        return parse_zip_manifest(doc_id, raw_bytes, original_name, course_id)
    return await asyncio.to_thread(parse_data_or_text, doc_id, file_path, raw_bytes, original_name, course_id)


def _persist_pages_and_assets(doc_id: str, result: IngestResult) -> None:
    now = time.time()
    with db_session() as conn:
        for ch in result.chunks:
            conn.execute(
                """
                INSERT INTO document_pages (
                    id, document_id, page_number, slide_number, title,
                    extracted_text, tables_json, equations_json, metadata_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    new_id("pg"),
                    doc_id,
                    ch.page_number,
                    ch.slide_number,
                    ch.metadata.get("title", ""),
                    ch.extracted_text,
                    json.dumps(ch.tables),
                    json.dumps(ch.equations),
                    json.dumps(ch.metadata),
                ),
            )
        for asset in result.assets:
            conn.execute(
                """
                INSERT INTO document_assets (id, document_id, page_number, asset_type, file_path, extracted_payload, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    new_id("ast"),
                    doc_id,
                    asset.page_number,
                    asset.asset_type,
                    asset.file_path,
                    asset.extracted_payload,
                    now,
                ),
            )


async def ingest_bytes_immediate(
    *,
    raw_bytes: bytes,
    filename: str,
    mime_type: str,
    pipeline: str = "ocr",
    vision_model: str = "llava-phi3:latest",
    course_id: str | None = None,
    topic_id: str | None = None,
    existing_doc_id: str | None = None,
) -> dict[str, Any]:
    """Validate, deduplicate, parse, and persist a single file (and unpacked ZIP children if archive)."""
    clean_name = sanitize_filename(filename)
    ext = validate_file_bytes(clean_name, mime_type, raw_bytes)
    sha256 = compute_sha256(raw_bytes)

    if not existing_doc_id:
        with db_session() as conn:
            dup = conn.execute(
                "SELECT * FROM documents WHERE sha256 = ? AND COALESCE(course_id, '') = COALESCE(?, '') AND status = 'completed'",
                (sha256, course_id),
            ).fetchone()
            if dup:
                out = row_to_dict(dup) or {}
                out["duplicate"] = True
                return out

    doc_id = existing_doc_id or new_id("doc")
    stored_name = f"{doc_id}{ext}"
    file_path = safe_resolve_upload_path(doc_id, ext)
    file_path.write_bytes(raw_bytes)

    result = await run_adapters(
        doc_id=doc_id,
        file_path=file_path,
        raw_bytes=raw_bytes,
        original_name=clean_name,
        mime_type=mime_type,
        pipeline=pipeline,
        vision_model=vision_model,
        course_id=course_id,
    )

    now = time.time()
    with db_session() as conn:
        if existing_doc_id:
            conn.execute(
                """
                UPDATE documents
                SET page_count = ?, summary = ?, file_type = ?, sha256 = ?, status = 'completed', error_message = NULL
                WHERE id = ?
                """,
                (result.page_count, clean_bangla_text(result.summary), result.file_type, sha256, doc_id),
            )
            conn.execute("DELETE FROM document_pages WHERE document_id = ?", (doc_id,))
            conn.execute("DELETE FROM document_assets WHERE document_id = ?", (doc_id,))
            conn.execute("DELETE FROM doc_chunks WHERE doc_id = ?", (doc_id,))
        else:
            conn.execute(
                """
                INSERT INTO documents (
                    id, filename, original_name, mime_type, size_bytes, pipeline,
                    page_count, summary, file_path, created_at, course_id, topic_id, file_type, sha256, status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
                """,
                (
                    doc_id,
                    stored_name,
                    clean_name,
                    mime_type,
                    len(raw_bytes),
                    pipeline,
                    result.page_count,
                    clean_bangla_text(result.summary),
                    str(file_path),
                    now,
                    course_id,
                    topic_id,
                    result.file_type,
                    sha256,
                ),
            )

    _persist_pages_and_assets(doc_id, result)
    chunk_count = store_normalized_chunks(doc_id, result.chunks)

    # Dispatch nested archive files cleanly (one level deep, non-zip)
    extracted_children: list[dict[str, Any]] = []
    for child_name, child_bytes in result.archive_children[:30]:
        if Path(child_name).suffix.lower() == ".zip":
            continue
        try:
            child_doc = await ingest_bytes_immediate(
                raw_bytes=child_bytes,
                filename=child_name,
                mime_type="application/octet-stream",
                pipeline=pipeline,
                vision_model=vision_model,
                course_id=course_id,
                topic_id=topic_id,
            )
            extracted_children.append(child_doc)
        except Exception:
            continue

    with db_session() as conn:
        row = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    doc = row_to_dict(row) or {}
    doc["chunk_count"] = chunk_count
    if result.assets:
        doc["assets"] = [
            {"asset_type": a.asset_type, "page_number": a.page_number, "payload": a.extracted_payload}
            for a in result.assets
        ]
    if extracted_children:
        doc["extracted_children"] = extracted_children
    return doc


def enqueue_ingestion_job(
    *,
    raw_bytes: bytes,
    filename: str,
    mime_type: str,
    pipeline: str = "ocr",
    vision_model: str = "llava-phi3:latest",
    course_id: str | None = None,
    topic_id: str | None = None,
) -> dict[str, Any]:
    """Create a pending document + ingestion_jobs row and schedule background processing."""
    clean_name = sanitize_filename(filename)
    ext = validate_file_bytes(clean_name, mime_type, raw_bytes)
    sha256 = compute_sha256(raw_bytes)

    doc_id = new_id("doc")
    job_id = new_id("job")
    stored_name = f"{doc_id}{ext}"
    file_path = safe_resolve_upload_path(doc_id, ext)
    file_path.write_bytes(raw_bytes)
    now = time.time()

    with db_session() as conn:
        conn.execute(
            """
            INSERT INTO documents (
                id, filename, original_name, mime_type, size_bytes, pipeline,
                page_count, summary, file_path, created_at, course_id, topic_id, file_type, sha256, status
            )
            VALUES (?, ?, ?, ?, ?, ?, 1, 'Queued for background ingestion…', ?, ?, ?, ?, 'document', ?, 'queued')
            """,
            (
                doc_id,
                stored_name,
                clean_name,
                mime_type,
                len(raw_bytes),
                pipeline,
                str(file_path),
                now,
                course_id,
                topic_id,
                sha256,
            ),
        )
        conn.execute(
            """
            INSERT INTO ingestion_jobs (id, document_id, course_id, filename, status, progress, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'queued', 10, ?, ?)
            """,
            (job_id, doc_id, course_id, clean_name, now, now),
        )
        job_row = conn.execute("SELECT * FROM ingestion_jobs WHERE id = ?", (job_id,)).fetchone()

    _EXECUTOR.submit(
        _run_job_thread,
        job_id,
        doc_id,
        file_path,
        raw_bytes,
        clean_name,
        mime_type,
        pipeline,
        vision_model,
        course_id,
        topic_id,
    )
    return row_to_dict(job_row) or {}


def _run_job_thread(
    job_id: str,
    doc_id: str,
    file_path: Path,
    raw_bytes: bytes,
    clean_name: str,
    mime_type: str,
    pipeline: str,
    vision_model: str,
    course_id: str | None,
    topic_id: str | None,
) -> None:
    try:
        with db_session() as conn:
            cur = conn.execute("SELECT status FROM ingestion_jobs WHERE id = ?", (job_id,)).fetchone()
            if not cur or cur["status"] == "cancelled":
                return
            conn.execute(
                "UPDATE ingestion_jobs SET status = 'processing', progress = 35, updated_at = ? WHERE id = ?",
                (time.time(), job_id),
            )
            conn.execute("UPDATE documents SET status = 'processing' WHERE id = ?", (doc_id,))

        asyncio.run(
            ingest_bytes_immediate(
                raw_bytes=raw_bytes,
                filename=clean_name,
                mime_type=mime_type,
                pipeline=pipeline,
                vision_model=vision_model,
                course_id=course_id,
                topic_id=topic_id,
                existing_doc_id=doc_id,
            )
        )
        with db_session() as conn:
            cur = conn.execute("SELECT status FROM ingestion_jobs WHERE id = ?", (job_id,)).fetchone()
            if cur and cur["status"] != "cancelled":
                conn.execute(
                    "UPDATE ingestion_jobs SET status = 'completed', progress = 100, updated_at = ? WHERE id = ?",
                    (time.time(), job_id),
                )
    except Exception as exc:
        with db_session() as conn:
            conn.execute(
                "UPDATE ingestion_jobs SET status = 'failed', progress = 100, error_message = ?, updated_at = ? WHERE id = ?",
                (str(exc)[:400], time.time(), job_id),
            )
            conn.execute(
                "UPDATE documents SET status = 'failed', error_message = ? WHERE id = ?",
                (str(exc)[:400], doc_id),
            )
