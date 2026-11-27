"""Knowledge Graph APIs: document-extracted concept/prerequisite/formula relationships & student editing."""

from __future__ import annotations

import json
import re
import time
from collections import Counter
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import db_session, new_id, row_to_dict
from ..services.bhai_agent import generate_with_fallback

router = APIRouter(prefix="/api/knowledge-graph", tags=["knowledge-graph"])


class ExtractGraphRequest(BaseModel):
    course_id: str
    model: str = "qwen2.5:3b"


class CreateEdgeRequest(BaseModel):
    course_id: str
    source_label: str
    target_label: str
    relation_type: str = "related_to"  # prerequisite | related_to | formula_for | implements
    evidence_excerpt: str = ""


@router.get("")
def get_knowledge_graph(course_id: str) -> dict:
    with db_session() as conn:
        course = conn.execute("SELECT id, code, title FROM courses WHERE id = ?", (course_id,)).fetchone()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        edges = [
            row_to_dict(r)
            for r in conn.execute(
                "SELECT * FROM knowledge_relationships WHERE course_id = ? ORDER BY created_at DESC",
                (course_id,),
            ).fetchall()
            if r
        ]
        topics = [
            row_to_dict(r)
            for r in conn.execute(
                "SELECT id, chapter_index, title, status FROM course_topics WHERE course_id = ? ORDER BY chapter_index ASC",
                (course_id,),
            ).fetchall()
            if r
        ]

    degree: Counter[str] = Counter()
    for e in edges:
        degree[e["source_label"]] += 1
        degree[e["target_label"]] += 1
    for t in topics:
        degree.setdefault(t["title"], 0)

    nodes = [
        {"id": label, "label": label, "degree": deg}
        for label, deg in sorted(degree.items(), key=lambda x: (-x[1], x[0]))
    ]
    return {"course": row_to_dict(course), "nodes": nodes, "edges": edges}


@router.post("/extract")
async def extract_course_knowledge_graph(req: ExtractGraphRequest) -> dict:
    """Auto-extract concept prerequisites, formulas & relationships from uploaded course notes and topics."""
    with db_session() as conn:
        course = conn.execute("SELECT * FROM courses WHERE id = ?", (req.course_id,)).fetchone()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        topics = conn.execute(
            "SELECT chapter_index, title FROM course_topics WHERE course_id = ? ORDER BY chapter_index ASC",
            (req.course_id,),
        ).fetchall()
        chunks = conn.execute(
            """
            SELECT c.doc_id, d.original_name, c.content
            FROM doc_chunks c
            JOIN documents d ON d.id = c.doc_id
            WHERE COALESCE(c.course_id, d.course_id) = ?
            LIMIT 12
            """,
            (req.course_id,),
        ).fetchall()

    triples: list[dict] = []
    if chunks:
        excerpt = "\n".join(f"[{r['original_name']}] {r['content'][:260]}" for r in chunks[:6])
        prompt = (
            f"Extract 4 to 6 key concept relationships for course {course['code']} {course['title']}.\n"
            f"Excerpts:\n{excerpt}\n\n"
            'Return ONLY JSON array: [{"source": "...", "target": "...", "relation": "prerequisite|related_to|formula_for|implements", "evidence": "..."}]'
        )
        try:
            raw, _, _ = await generate_with_fallback(req.model, [{"role": "user", "content": prompt}])
            m = re.search(r"\[.*\]", raw, re.DOTALL)
            if m:
                triples = json.loads(m.group(0))
        except Exception:
            pass

    # Deterministic fallback linking consecutive chapters + extracted document formulas/headers
    if not triples:
        for i in range(len(topics) - 1):
            triples.append(
                {
                    "source": topics[i]["title"],
                    "target": topics[i + 1]["title"],
                    "relation": "prerequisite",
                    "evidence": f"Course syllabus order Chapter {topics[i]['chapter_index']} -> {topics[i+1]['chapter_index']}",
                }
            )
        for r in chunks[:4]:
            words = re.findall(r"[A-Z][A-Za-z0-9_+-]{3,}", r["content"])
            if len(words) >= 2:
                triples.append(
                    {
                        "source": words[0],
                        "target": words[1],
                        "relation": "related_to",
                        "doc_id": r["doc_id"],
                        "evidence": r["content"][:120],
                    }
                )

    now = time.time()
    doc_fallback = chunks[0]["doc_id"] if chunks else None
    with db_session() as conn:
        # Preserve student-edited edges; refresh auto-extracted ones
        conn.execute(
            "DELETE FROM knowledge_relationships WHERE course_id = ? AND is_user_edited = 0",
            (req.course_id,),
        )
        for tr in triples[:12]:
            src = str(tr.get("source", "")).strip()[:80]
            tgt = str(tr.get("target", "")).strip()[:80]
            rel = str(tr.get("relation", "related_to")).strip()
            if rel not in {"prerequisite", "related_to", "formula_for", "implements"}:
                rel = "related_to"
            if src and tgt and src != tgt:
                conn.execute(
                    """
                    INSERT INTO knowledge_relationships (
                        id, course_id, source_label, target_label, relation_type,
                        evidence_doc_id, evidence_excerpt, is_user_edited, created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
                    """,
                    (
                        new_id("kg"),
                        req.course_id,
                        src,
                        tgt,
                        rel,
                        tr.get("doc_id") or doc_fallback,
                        str(tr.get("evidence", ""))[:240],
                        now,
                    ),
                )
    return get_knowledge_graph(req.course_id)


@router.post("/edges")
def create_edge(req: CreateEdgeRequest) -> dict:
    eid = new_id("kg")
    now = time.time()
    rel = req.relation_type if req.relation_type in {"prerequisite", "related_to", "formula_for", "implements"} else "related_to"
    with db_session() as conn:
        if not conn.execute("SELECT id FROM courses WHERE id = ?", (req.course_id,)).fetchone():
            raise HTTPException(status_code=404, detail="Course not found")
        conn.execute(
            """
            INSERT INTO knowledge_relationships (
                id, course_id, source_label, target_label, relation_type, evidence_excerpt, is_user_edited, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, 1, ?)
            """,
            (eid, req.course_id, req.source_label.strip(), req.target_label.strip(), rel, req.evidence_excerpt.strip(), now),
        )
        row = conn.execute("SELECT * FROM knowledge_relationships WHERE id = ?", (eid,)).fetchone()
    return row_to_dict(row) or {}


@router.delete("/edges/{edge_id}")
def delete_edge(edge_id: str) -> dict:
    with db_session() as conn:
        cur = conn.execute("DELETE FROM knowledge_relationships WHERE id = ?", (edge_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Edge not found")
    return {"deleted": edge_id}
