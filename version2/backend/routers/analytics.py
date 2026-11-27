"""Study progress analytics, metric-backed course readiness & local benchmark endpoints."""

from __future__ import annotations

import json
import re
import time
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import db_session, new_id, row_to_dict
from ..ollama_client import build_system_prompt, generate_ollama_once

router = APIRouter(prefix="/api", tags=["analytics"])


class BenchmarkRunRequest(BaseModel):
    model: str = "qwen2.5:3b"
    pipeline: str = "guide"
    question: str


@router.get("/analytics")
def get_analytics() -> dict:
    with db_session() as conn:
        total_chats = conn.execute("SELECT COUNT(*) FROM chats").fetchone()[0]
        total_messages = conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
        total_tokens = conn.execute("SELECT COALESCE(SUM(tokens), 0) FROM messages").fetchone()[0]
        total_docs = conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
        total_tasks = conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
        completed_tasks = conn.execute("SELECT COUNT(*) FROM tasks WHERE completed = 1").fetchone()[0]
        focus_minutes = conn.execute(
            "SELECT COALESCE(SUM(duration_minutes), 0) FROM focus_sessions"
        ).fetchone()[0]

        guide_chats = conn.execute("SELECT COUNT(*) FROM chats WHERE mode = 'guide'").fetchone()[0]
        answer_chats = conn.execute("SELECT COUNT(*) FROM chats WHERE mode = 'answer'").fetchone()[0]

        subject_rows = conn.execute(
            "SELECT subject, COUNT(*) AS count FROM chats GROUP BY subject ORDER BY count DESC"
        ).fetchall()

        courses = conn.execute("SELECT id, code, title, exam_date FROM courses ORDER BY created_at DESC").fetchall()
        course_readiness = []
        for crs in courses:
            cid = crs["id"]
            topics_total = conn.execute("SELECT COUNT(*) FROM course_topics WHERE course_id = ?", (cid,)).fetchone()[0]
            topics_mastered = conn.execute(
                "SELECT COUNT(*) FROM course_topics WHERE course_id = ? AND status = 'mastered'", (cid,)
            ).fetchone()[0]
            avg_quiz = conn.execute(
                "SELECT AVG(score) FROM quiz_sessions WHERE course_id = ? AND score IS NOT NULL", (cid,)
            ).fetchone()[0]
            fc_total = conn.execute("SELECT COUNT(*) FROM flashcards WHERE course_id = ?", (cid,)).fetchone()[0]
            fc_reviewed = conn.execute(
                "SELECT COUNT(*) FROM flashcards WHERE course_id = ? AND repetitions > 0", (cid,)
            ).fetchone()[0]
            docs_count = conn.execute("SELECT COUNT(*) FROM documents WHERE course_id = ?", (cid,)).fetchone()[0]
            course_readiness.append(
                {
                    "course_id": cid,
                    "code": crs["code"],
                    "title": crs["title"],
                    "exam_date": crs["exam_date"],
                    "topics_mastered": topics_mastered,
                    "topics_total": topics_total,
                    "avg_quiz_score": round(float(avg_quiz), 1) if avg_quiz is not None else None,
                    "flashcards_reviewed": fc_reviewed,
                    "flashcards_total": fc_total,
                    "documents_count": docs_count,
                }
            )

        today = datetime.now().date()
        weekly = []
        for offset in range(6, -1, -1):
            day = today - timedelta(days=offset)
            day_start = datetime(day.year, day.month, day.day).timestamp()
            day_end = day_start + 86400
            msg_count = conn.execute(
                "SELECT COUNT(*) FROM messages WHERE created_at >= ? AND created_at < ?",
                (day_start, day_end),
            ).fetchone()[0]
            foc_mins = conn.execute(
                "SELECT COALESCE(SUM(duration_minutes), 0) FROM focus_sessions WHERE completed_at >= ? AND completed_at < ?",
                (day_start, day_end),
            ).fetchone()[0]
            weekly.append(
                {
                    "date": day.strftime("%a"),
                    "full_date": day.isoformat(),
                    "messages": msg_count,
                    "focus_minutes": foc_mins,
                }
            )

    return {
        "totals": {
            "chats": total_chats,
            "messages": total_messages,
            "tokens": total_tokens,
            "documents": total_docs,
            "tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "focus_minutes": focus_minutes,
        },
        "mode_split": {
            "guide": guide_chats,
            "answer": answer_chats,
        },
        "subjects": [dict(r) for r in subject_rows],
        "course_readiness": course_readiness,
        "weekly_rhythm": weekly,
    }


@router.get("/benchmarks")
def list_benchmarks() -> list[dict]:
    with db_session() as conn:
        rows = conn.execute("SELECT * FROM benchmarks ORDER BY created_at DESC LIMIT 30").fetchall()
    return [row_to_dict(r) for r in rows if r]


@router.post("/benchmarks/run")
async def run_benchmark(req: BenchmarkRunRequest) -> dict:
    sys_prompt = build_system_prompt(req.pipeline, req.question, "en")
    messages = [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": req.question},
    ]
    t0 = time.perf_counter()
    try:
        content, tokens = await generate_ollama_once(req.model, messages)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Benchmark inference failed: {exc}") from exc
    latency_ms = int((time.perf_counter() - t0) * 1000)

    bid = new_id("bmk")
    now = time.time()
    preview = content[:300]
    with db_session() as conn:
        conn.execute(
            """
            INSERT INTO benchmarks (id, pipeline, model, question, latency_ms, tokens, response_preview, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (bid, req.pipeline, req.model, req.question, latency_ms, tokens, preview, now),
        )
        row = conn.execute("SELECT * FROM benchmarks WHERE id = ?", (bid,)).fetchone()
    return row_to_dict(row) or {}
