"""Hybrid RAG Engine: SQLite FTS5 BM25 + Local Sentence-Transformer Embeddings + RRF Fusion."""

from __future__ import annotations

import logging
import os
import re
import sqlite3
from collections import defaultdict
from typing import Any

import numpy as np

from ..db import db_session

logger = logging.getLogger(__name__)

_EMBED_MODEL: Any = None
_EMBED_LOAD_TRIED = False


def _get_local_embedder():
    """Lazy-load a cached SentenceTransformer strictly offline (local_files_only=True)."""
    global _EMBED_MODEL, _EMBED_LOAD_TRIED
    if _EMBED_LOAD_TRIED:
        return _EMBED_MODEL
    _EMBED_LOAD_TRIED = True

    if os.environ.get("BHAIOS_DISABLE_EMBEDDINGS") == "1":
        return None

    from ..config import DEFAULT_EMBEDDING_MODEL

    candidates = [
        DEFAULT_EMBEDDING_MODEL,
        "BAAI/bge-m3",
        "intfloat/multilingual-e5-small",
        "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        "sentence-transformers/all-MiniLM-L6-v2",
    ]
    try:
        from sentence_transformers import SentenceTransformer

        for name in candidates:
            try:
                _EMBED_MODEL = SentenceTransformer(name, local_files_only=True, device="cpu")
                logger.info("Hybrid RAG loaded cached embedding model: %s", name)
                return _EMBED_MODEL
            except Exception:
                continue
    except Exception as exc:
        logger.debug("SentenceTransformer unavailable: %s", exc)
    return None


def compute_embedding_bytes(text: str) -> bytes | None:
    model = _get_local_embedder()
    if model is None or not text.strip():
        return None
    try:
        vec = model.encode([text[:1500]], normalize_embeddings=True)[0]
        return np.asarray(vec, dtype=np.float32).tobytes()
    except Exception:
        return None


def compute_embeddings_batch(texts: list[str]) -> list[bytes | None]:
    model = _get_local_embedder()
    if model is None or not texts:
        return [None] * len(texts)
    try:
        clipped = [t[:1500] for t in texts]
        vecs = model.encode(clipped, normalize_embeddings=True)
        return [np.asarray(v, dtype=np.float32).tobytes() for v in vecs]
    except Exception:
        return [None] * len(texts)


def sync_chunk_to_fts(
    conn: sqlite3.Connection,
    *,
    chunk_id: str,
    doc_id: str,
    course_id: str | None,
    content: str,
) -> None:
    try:
        conn.execute(
            "INSERT INTO doc_chunks_fts (chunk_id, doc_id, course_id, content) VALUES (?, ?, ?, ?)",
            (chunk_id, doc_id, course_id or "", content),
        )
    except sqlite3.OperationalError:
        pass


def _build_fts_query(tokens: list[str]) -> str:
    safe_tokens = [re.sub(r'["\'()*:]', "", t) for t in tokens if len(t) >= 2]
    if not safe_tokens:
        return ""
    return " OR ".join(f'"{t}"' for t in safe_tokens[:16])


def hybrid_retrieve(
    query: str,
    *,
    top_k: int = 5,
    doc_id: str | None = None,
    course_id: str | None = None,
    semester_id: str | None = None,
    file_type: str | None = None,
    content_type: str | None = None,
) -> list[dict[str, Any]]:
    """Combine FTS5 BM25 lexical matching + cosine embedding similarity via Reciprocal Rank Fusion."""
    from ..rag import tokenize

    q_tokens = tokenize(query)
    if not q_tokens:
        return []

    clauses: list[str] = []
    params: list[Any] = []
    if doc_id:
        clauses.append("c.doc_id = ?")
        params.append(doc_id)
    if course_id:
        clauses.append("COALESCE(c.course_id, d.course_id) = ?")
        params.append(course_id)
    if semester_id:
        clauses.append("crs.semester_id = ?")
        params.append(semester_id)
    if file_type:
        clauses.append("d.file_type = ?")
        params.append(file_type)
    if content_type:
        clauses.append("c.content_type = ?")
        params.append(content_type)

    where_sql = (" WHERE " + " AND ".join(clauses)) if clauses else ""

    with db_session() as conn:
        # 1) Fetch candidate chunks in scope
        sql = f"""
            SELECT c.id, c.doc_id, c.page_num, c.slide_number, c.content, c.source_location,
                   c.content_type, c.embedding, d.original_name, d.file_type
            FROM doc_chunks c
            JOIN documents d ON d.id = c.doc_id
            LEFT JOIN courses crs ON crs.id = COALESCE(c.course_id, d.course_id)
            {where_sql}
        """
        rows = conn.execute(sql, tuple(params)).fetchall()
        if not rows:
            return []

        row_by_id = {r["id"]: r for r in rows}

        # 2) Lexical rank via SQLite FTS5 BM25
        fts_ranks: dict[str, int] = {}
        fts_query = _build_fts_query(q_tokens)
        if fts_query:
            try:
                fts_rows = conn.execute(
                    """
                    SELECT chunk_id, bm25(doc_chunks_fts) AS rank_score
                    FROM doc_chunks_fts
                    WHERE doc_chunks_fts MATCH ?
                    ORDER BY rank_score ASC
                    LIMIT 60
                    """,
                    (fts_query,),
                ).fetchall()
                scoped_rank = 1
                for fr in fts_rows:
                    if fr["chunk_id"] in row_by_id:
                        fts_ranks[fr["chunk_id"]] = scoped_rank
                        scoped_rank += 1
            except sqlite3.OperationalError:
                pass

    # Fallback BM25 if FTS5 returned nothing (e.g. single-char Bangla or partial substrings)
    if not fts_ranks:
        q_set = set(q_tokens)
        bm25_fallback = []
        for r in rows:
            c_tokens = tokenize(r["content"])
            overlap = len(q_set.intersection(c_tokens))
            if overlap > 0:
                bm25_fallback.append((overlap, r["id"]))
        bm25_fallback.sort(key=lambda x: x[0], reverse=True)
        for rank_idx, (_, cid) in enumerate(bm25_fallback[:40], start=1):
            fts_ranks[cid] = rank_idx

    # 3) Semantic vector rank via normalized float32 embeddings
    vec_ranks: dict[str, int] = {}
    q_bytes = compute_embedding_bytes(query)
    if q_bytes is not None:
        q_vec = np.frombuffer(q_bytes, dtype=np.float32)
        sim_scores: list[tuple[float, str]] = []
        for r in rows:
            emb = r["embedding"]
            if emb:
                d_vec = np.frombuffer(emb, dtype=np.float32)
                if d_vec.shape == q_vec.shape:
                    sim = float(np.dot(q_vec, d_vec))
                    if sim > 0.22:
                        sim_scores.append((sim, r["id"]))
        sim_scores.sort(key=lambda x: x[0], reverse=True)
        for rank_idx, (_, cid) in enumerate(sim_scores[:40], start=1):
            vec_ranks[cid] = rank_idx

    # 4) Reciprocal Rank Fusion (k=60)
    rrf_scores: dict[str, float] = defaultdict(float)
    rrf_k = 60.0
    for cid, rank in fts_ranks.items():
        rrf_scores[cid] += 1.0 / (rrf_k + rank)
    for cid, rank in vec_ranks.items():
        rrf_scores[cid] += 1.0 / (rrf_k + rank)

    if not rrf_scores:
        return []

    ranked = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
    results: list[dict[str, Any]] = []
    for cid, score in ranked:
        r = row_by_id[cid]
        results.append(
            {
                "chunk_id": r["id"],
                "doc_id": r["doc_id"],
                "filename": r["original_name"],
                "file_type": r["file_type"],
                "page_num": r["page_num"],
                "slide_number": r["slide_number"],
                "source_location": r["source_location"] or f"Page {r['page_num']}",
                "content_type": r["content_type"],
                "content": r["content"],
                "score": round(score * 100, 3),
            }
        )
    return results
