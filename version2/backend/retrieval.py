"""Hybrid search (FTS5 BM25 + Vector Cosine + RRF) & Grounded Answering Engine."""

from __future__ import annotations

import re
import time
from typing import Any

import httpx
import numpy as np

from .db import Database
from .hardware import OLLAMA_BASE
from .ingest import compute_embedding

SYSTEM_PROMPTS: dict[str, dict[str, str]] = {
    "guide": {
        "en": (
            "You are BhaiOS, a calm, Socratic university CSE/engineering tutor. "
            "Ground every claim strictly in the provided course excerpts using numbered citations like [1], [2]. "
            "Never invent page or slide numbers. Do NOT give away the full final answer immediately—provide a 3-step "
            "progressive ladder: (1) Nudge, (2) Hint, (3) Scaffold."
        ),
        "bn": (
            "তুমি BhaiOS, বিশ্ববিদ্যালয়ের CSE/ইঞ্জিনিয়ারিং শিক্ষার্থীদের জন্য শান্ত ও ধাপে ধাপে শেখানোর টিউটর। "
            "প্রদত্ত কোর্স নোট থেকে [1], [2] সাইটেশনসহ উত্তর দাও। ইংরেজি টেকনিক্যাল টার্ম (যেমন Recursion, Pointer, Complexity) "
            "ইংরেজিতে রাখো। সরাসরি সম্পূর্ণ উত্তর না দিয়ে ৩ ধাপে সাহায্য করো: (১) সংকেত (Nudge), (২) সূত্র/ধারণা (Hint), (৩) কাঠামো (Scaffold)।"
        ),
    },
    "answer": {
        "en": (
            "You are BhaiOS, a concise academic assistant. Answer directly using ONLY the provided course excerpts, "
            "citing every factual claim with [1], [2]. Never fabricate slide or page numbers."
        ),
        "bn": (
            "তুমি BhaiOS। প্রদত্ত কোর্স ম্যাটেরিয়াল অনুযায়ী সরাসরি ও সংক্ষিপ্ত উত্তর দাও এবং প্রতিটি তথ্যে [1], [2] সাইটেশন দাও। "
            "ইংরেজি টেকনিক্যাল শব্দগুলো অপরিবর্তিত রাখো।"
        ),
    },
    "explain_slide": {
        "en": (
            "Explain the selected slide/page in clear, plain academic language, followed by one concrete worked example "
            "grounded in the excerpt. Cite the slide with [1]."
        ),
        "bn": (
            "নির্বাচিত স্লাইড/পৃষ্ঠাটি সহজ ভাষায় ব্যাখ্যা করো এবং একটি বাস্তব উদাহরণসহ দেখাও। স্লাইডটি [1] দিয়ে উল্লেখ করো।"
        ),
    },
    "exam": {
        "en": (
            "Generate a university exam-style question (with mark distribution and grading rubric) based strictly on the "
            "provided course excerpts, citing source slides with [1], [2]."
        ),
        "bn": (
            "প্রদত্ত কোর্স নোটের ওপর ভিত্তি করে বিশ্ববিদ্যালয় পরীক্ষার উপযোগী একটি প্রশ্ন, নম্বর বণ্টন ও মূল্যায়ন নির্দেশিকা তৈরি করো। [1], [2] সাইটেশন দাও।"
        ),
    },
    "compare": {
        "en": (
            "Contrast the two requested concepts side-by-side using a structured Markdown table grounded strictly in "
            "the retrieved course excerpts with [1], [2] citations."
        ),
        "bn": (
            "প্রদত্ত নোট থেকে দুটি ধারণার তুলনা একটি পরিষ্কার Markdown টেবিলে দেখাও এবং [1], [2] সাইটেশন দাও।"
        ),
    },
}


def hybrid_search(
    db: Database,
    query: str,
    course_id: str | None = None,
    scope: str = "course",
    file_ids: list[str] | None = None,
    top_k: int = 5,
) -> list[dict[str, Any]]:
    """
    Combine FTS5 keyword search and local/Ollama vector cosine similarity via Reciprocal Rank Fusion (RRF).
    """
    clean_q = re.sub(r"[^\w\s\u0980-\u09FF]", " ", query).strip()
    tokens = [t for t in clean_q.split() if len(t) > 1]
    fts_query = " OR ".join(tokens) if tokens else ""

    where_clauses: list[str] = []
    params: list[Any] = []
    if scope == "course" and course_id:
        where_clauses.append("c.course_id = ?")
        params.append(course_id)
    elif scope == "files" and file_ids:
        placeholders = ",".join("?" for _ in file_ids)
        where_clauses.append(f"c.file_id IN ({placeholders})")
        params.extend(file_ids)

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    fts_ranks: dict[str, int] = {}
    chunks_by_id: dict[str, dict[str, Any]] = {}

    with db.connect() as conn:
        # 1. FTS5 BM25 ranking
        if fts_query:
            try:
                fts_sql = f"""
                    SELECT c.id, c.course_id, c.file_id, c.page_or_slide, c.section_title, c.content,
                           f.filename, bm25(chunks_fts) AS bm25_score
                    FROM chunks_fts
                    JOIN chunks c ON c.id = chunks_fts.chunk_id
                    JOIN files f ON f.id = c.file_id
                    {where_sql + ' AND ' if where_sql else 'WHERE '} chunks_fts MATCH ?
                    ORDER BY bm25_score ASC
                    LIMIT 20
                """
                rows = conn.execute(fts_sql, params + [fts_query]).fetchall()
                for rank, r in enumerate(rows, start=1):
                    d = dict(r)
                    fts_ranks[d["id"]] = rank
                    chunks_by_id[d["id"]] = d
            except Exception:
                pass

        # 2. Vector similarity ranking
        vec_sql = f"""
            SELECT c.id, c.course_id, c.file_id, c.page_or_slide, c.section_title, c.content,
                   f.filename, e.embedding_model, e.dim, e.vector_blob
            FROM chunks c
            JOIN files f ON f.id = c.file_id
            JOIN embeddings e ON e.chunk_id = c.id
            {where_sql}
        """
        all_rows = conn.execute(vec_sql, params).fetchall()

    # Compute query vector synchronously using local trigram fallback for <300ms guaranteed speed
    from .ingest import EMBED_DIM, compute_local_embedding
    q_vec = np.frombuffer(compute_local_embedding(query, EMBED_DIM), dtype=np.float32)

    vec_scored: list[tuple[float, str]] = []
    for r in all_rows:
        d = dict(r)
        cid = d["id"]
        if cid not in chunks_by_id:
            chunks_by_id[cid] = {k: d[k] for k in ("id", "course_id", "file_id", "page_or_slide", "section_title", "content", "filename")}
        if d["dim"] == EMBED_DIM:
            c_vec = np.frombuffer(d["vector_blob"], dtype=np.float32)
            sim = float(np.dot(q_vec, c_vec))
        else:
            sim = 0.0
        vec_scored.append((sim, cid))

    vec_scored.sort(key=lambda x: x[0], reverse=True)
    vec_ranks = {cid: rank for rank, (_, cid) in enumerate(vec_scored[:20], start=1)}
    sim_map = {cid: score for score, cid in vec_scored}

    # 3. Reciprocal Rank Fusion (k=60)
    fused: list[tuple[float, dict[str, Any]]] = []
    for cid, meta in chunks_by_id.items():
        rrf = 0.0
        if cid in fts_ranks:
            rrf += 1.0 / (60 + fts_ranks[cid])
        if cid in vec_ranks:
            rrf += 1.0 / (60 + vec_ranks[cid])
        # Boost slightly when cosine similarity > 0.15
        cos = sim_map.get(cid, 0.0)
        if cos > 0.12:
            rrf += cos * 0.02
        meta["score"] = round(rrf, 5)
        meta["cosine"] = round(cos, 4)
        fused.append((rrf, meta))

    fused.sort(key=lambda x: x[0], reverse=True)
    results = [item[1] for item in fused[:top_k] if item[0] > 0]
    return results


async def generate_grounded_answer(
    db: Database,
    query: str,
    mode: str = "guide",
    course_id: str | None = None,
    scope: str = "course",
    file_ids: list[str] | None = None,
    language: str = "en",
    model: str | None = None,
    history: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    """Retrieve citations and generate a grounded response via local Ollama (with offline structured fallback)."""
    retrieved = hybrid_search(db, query, course_id=course_id, scope=scope, file_ids=file_ids, top_k=4)
    active_model = model or str(db.get_setting("active_model", "qwen2.5:3b"))
    lang_key = "bn" if (language == "bn" or re.search(r"[\u0980-\u09FF]", query)) else "en"
    sys_prompt = SYSTEM_PROMPTS.get(mode, SYSTEM_PROMPTS["guide"])[lang_key]

    # Anti-hallucination confidence check
    low_confidence = len(retrieved) == 0 or (retrieved[0]["score"] < 0.015 and retrieved[0]["cosine"] < 0.10)

    context_blocks = []
    citations = []
    for idx, ch in enumerate(retrieved, start=1):
        context_blocks.append(f"[{idx}] Source: {ch['filename']} · Page/Slide {ch['page_or_slide']} ({ch['section_title']})\n{ch['content']}")
        citations.append({
            "index": idx,
            "chunk_id": ch["id"],
            "file_id": ch["file_id"],
            "filename": ch["filename"],
            "page_or_slide": ch["page_or_slide"],
            "section_title": ch["section_title"],
            "passage": ch["content"][:420],
            "score": ch["score"],
        })

    if low_confidence:
        user_prompt = (
            f"Question: {query}\n\n"
            "No matching passages were found in the student's uploaded course materials. "
            "Begin by clearly stating: 'I couldn't find this in your materials.' "
            "Then provide a helpful general knowledge explanation without inventing any file citations."
        )
        citations = []
    else:
        user_prompt = (
            "Course Materials Excerpts:\n"
            + "\n\n---\n\n".join(context_blocks)
            + f"\n\nStudent Question: {query}\n\n"
            "Cite sources strictly using [1], [2], etc. matching the excerpts above."
        )

    messages = [{"role": "system", "content": sys_prompt}]
    if history:
        messages.extend(history[-4:])
    messages.append({"role": "user", "content": user_prompt})

    t0 = time.time()
    reply_text = ""
    used_ollama = False
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            r = await client.post(
                f"{OLLAMA_BASE}/api/chat",
                json={"model": active_model, "messages": messages, "stream": False},
            )
            if r.status_code == 200:
                reply_text = r.json().get("message", {}).get("content", "").strip()
                used_ollama = True
    except Exception:
        pass

    if not reply_text:
        if low_confidence:
            reply_text = (
                "I couldn't find this in your materials.\n\n"
                "**General Knowledge Note** (Ollama offline — start `ollama serve` for full local LLM synthesis): "
                "Upload your course slides or notes in **Library** so BhaiOS can cite exact pages and slides."
            )
        else:
            top = citations[0]
            snippet = top["passage"][:240].replace("\n", " ")
            if mode == "guide":
                reply_text = (
                    f"**Step 1 · Nudge**: Check `{top['filename']}` (Page/Slide {top['page_or_slide']}) [1].\n\n"
                    f"**Step 2 · Hint**: Focus on *{top['section_title']}*: \"{snippet}…\" [1].\n\n"
                    f"**Step 3 · Scaffold**: Start Ollama (`ollama serve`) with `{active_model}` for full interactive synthesis."
                )
            else:
                reply_text = f"From **{top['filename']} · Page/Slide {top['page_or_slide']}** [1]:\n\n> {snippet}…"

    return {
        "reply": reply_text,
        "mode": mode,
        "grounded": not low_confidence,
        "citations": citations,
        "model_used": active_model if used_ollama else "local-retrieval-fallback",
        "latency_s": round(time.time() - t0, 2),
    }
