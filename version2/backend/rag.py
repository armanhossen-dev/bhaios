"""Local RAG chunker, FTS5 + Hybrid RAG integration, and Bangla text normalizer."""

from __future__ import annotations

import re
import unicodedata
from collections import Counter
from typing import Any

from .db import db_session, new_id
from .services.hybrid_rag import (
    compute_embeddings_batch,
    hybrid_retrieve,
    sync_chunk_to_fts,
)


def clean_bangla_text(text: str) -> str:
    """Normalize Unicode Bangla and strip genuinely orphaned/doubled vowel signs while preserving valid ং/ঃ/ঁ."""
    text = unicodedata.normalize("NFC", text)
    text = re.sub(r"্{2,}", "্", text)
    text = re.sub(r"্([া-ৌ])", r"\1", text)
    text = re.sub(r"([া-ৌ])\1+", r"\1", text)
    text = re.sub(r"্(?=\s|$)", "", text)
    # Strip orphaned leading vowel signs / hasanta only at word starts (never strip ং/ঃ/ঁ after vowels/matras!)
    text = re.sub(r"(^|[\s.,!?;:()\[\]{}\"'“”‘’—–-])([া-ৌ্]+)", r"\1", text)
    return text.strip()


def tokenize(text: str) -> list[str]:
    """Tokenize English + Bangla words for local keyword & BM25 retrieval."""
    cleaned = clean_bangla_text(text.lower())
    return re.findall(r"[\w\u0980-\u09FF]+", cleaned)


def chunk_text(text: str, max_chars: int = 800, overlap: int = 120) -> list[str]:
    """Split page text into overlapping chunks without breaking words."""
    text = text.strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(len(text), start + max_chars)
        if end < len(text):
            last_space = text.rfind(" ", start, end)
            if last_space > start + max_chars // 2:
                end = last_space
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks


def store_normalized_chunks(doc_id: str, normalized_chunks: list[Any]) -> int:
    """Chunk NormalizedChunk objects, compute optional local embeddings, and persist to doc_chunks + FTS5."""
    flat_records: list[dict[str, Any]] = []
    for item in normalized_chunks:
        for piece in chunk_text(item.extracted_text):
            tokens = tokenize(piece)
            top_keywords = " ".join([w for w, _ in Counter(tokens).most_common(20)])
            flat_records.append(
                {
                    "chunk_id": new_id("chk"),
                    "doc_id": doc_id,
                    "page_num": item.page_number,
                    "slide_number": item.slide_number,
                    "content": piece,
                    "keywords": top_keywords,
                    "course_id": item.course_id,
                    "content_type": item.content_type,
                    "source_location": item.source_location or f"Page {item.page_number}",
                }
            )

    if not flat_records:
        return 0

    embeddings = compute_embeddings_batch([r["content"] for r in flat_records])
    with db_session() as conn:
        for rec, emb in zip(flat_records, embeddings):
            conn.execute(
                """
                INSERT INTO doc_chunks (
                    id, doc_id, page_num, slide_number, content, keywords,
                    course_id, content_type, source_location, embedding
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    rec["chunk_id"],
                    rec["doc_id"],
                    rec["page_num"],
                    rec["slide_number"],
                    rec["content"],
                    rec["keywords"],
                    rec["course_id"],
                    rec["content_type"],
                    rec["source_location"],
                    emb,
                ),
            )
            sync_chunk_to_fts(
                conn,
                chunk_id=rec["chunk_id"],
                doc_id=rec["doc_id"],
                course_id=rec["course_id"],
                content=rec["content"],
            )
    return len(flat_records)


def store_document_chunks(
    doc_id: str,
    pages: list[tuple[int, str]],
    course_id: str | None = None,
    content_type: str = "text",
) -> int:
    """Persist (page_num, text) tuples into doc_chunks + FTS5 (backward-compatible helper)."""
    from .services.ingestion.base import NormalizedChunk

    items = [
        NormalizedChunk(
            document_id=doc_id,
            filename="",
            file_type=content_type,
            course_id=course_id,
            page_number=page_num,
            content_type=content_type,
            extracted_text=page_text,
            source_location=f"Page {page_num}",
        )
        for page_num, page_text in pages
    ]
    return store_normalized_chunks(doc_id, items)


def retrieve_relevant_chunks(
    query: str,
    top_k: int = 4,
    doc_id: str | None = None,
    course_id: str | None = None,
    semester_id: str | None = None,
    file_type: str | None = None,
    content_type: str | None = None,
) -> list[dict[str, Any]]:
    """Retrieve top-k relevant document chunks using Hybrid FTS5 + Embedding RRF scoring."""
    return hybrid_retrieve(
        query,
        top_k=top_k,
        doc_id=doc_id,
        course_id=course_id,
        semester_id=semester_id,
        file_type=file_type,
        content_type=content_type,
    )
