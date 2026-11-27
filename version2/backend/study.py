"""Study tools: SM-2 spaced repetition flashcards, quizzes, weak-topic detector, CGPA & attendance."""

from __future__ import annotations

import time
from typing import Any

from .db import Database, new_id


def apply_sm2(ease_factor: float, interval_days: int, repetitions: int, rating: int) -> tuple[float, int, int, float]:
    """
    SM-2 spaced repetition algorithm.
    rating: 1=Again, 2=Hard, 3=Good, 4=Easy
    """
    q = {1: 1, 2: 3, 3: 4, 4: 5}.get(rating, 4)
    if q < 3:
        repetitions = 0
        interval_days = 1
    else:
        if repetitions == 0:
            interval_days = 1
        elif repetitions == 1:
            interval_days = 6
        else:
            interval_days = max(1, round(interval_days * ease_factor))
        repetitions += 1

    new_ef = ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    new_ef = max(1.3, round(new_ef, 2))
    next_due = time.time() + interval_days * 86400
    return new_ef, interval_days, repetitions, next_due


def generate_flashcards_from_course(db: Database, course_id: str, limit: int = 8) -> list[dict[str, Any]]:
    """Create grounded flashcards directly from course chunks (instant offline extraction)."""
    with db.connect() as conn:
        rows = conn.execute(
            """
            SELECT c.id, c.file_id, c.page_or_slide, c.section_title, c.content, f.filename
            FROM chunks c
            JOIN files f ON f.id = c.file_id
            WHERE c.course_id = ?
            ORDER BY c.page_or_slide ASC
            LIMIT ?
            """,
            (course_id, limit),
        ).fetchall()

    created: list[dict[str, Any]] = []
    now = time.time()
    with db.connect() as conn:
        for r in rows:
            d = dict(r)
            title = d["section_title"] or f"Concept from {d['filename']} (p.{d['page_or_slide']})"
            front = f"Explain: {title}"
            back = d["content"][:320].strip()
            fid = new_id("fc")
            conn.execute(
                """
                INSERT INTO flashcards (id, course_id, file_id, page_or_slide, front, back, due_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (fid, course_id, d["file_id"], d["page_or_slide"], front, back, now, now),
            )
            created.append({
                "id": fid,
                "course_id": course_id,
                "file_id": d["file_id"],
                "page_or_slide": d["page_or_slide"],
                "front": front,
                "back": back,
                "filename": d["filename"],
            })
    return created


def calculate_course_grade_summary(assessments: list[dict[str, Any]], target_pct: float = 80.0) -> dict[str, Any]:
    """Compute weighted running total and marks needed in remaining assessments for target grade."""
    earned_weight = 0.0
    completed_weight = 0.0
    total_weight = 0.0

    for a in assessments:
        w = float(a.get("weight_pct", 0))
        max_m = float(a.get("max_marks", 100)) or 100.0
        obt = a.get("obtained_marks")
        total_weight += w
        if obt is not None and obt != "":
            pct = float(obt) / max_m
            earned_weight += pct * w
            completed_weight += w

    remaining_weight = max(0.0, total_weight - completed_weight)
    needed_in_remaining = target_pct - earned_weight
    needed_pct_on_remaining = (needed_in_remaining / remaining_weight * 100.0) if remaining_weight > 0 else 0.0

    return {
        "earned_pct": round(earned_weight, 2),
        "completed_weight": round(completed_weight, 2),
        "remaining_weight": round(remaining_weight, 2),
        "target_pct": target_pct,
        "needed_pct_on_remaining": round(needed_pct_on_remaining, 1),
        "achievable": needed_pct_on_remaining <= 100.0,
    }


def calculate_attendance_stats(records: list[dict[str, Any]], min_pct: float = 75.0) -> dict[str, Any]:
    total = len(records)
    present = sum(1 for r in records if r["status"] in ("present", "late"))
    pct = round((present / total) * 100.0, 1) if total > 0 else 100.0
    # How many consecutive classes can still be missed while staying >= min_pct
    can_miss = 0
    if total > 0 and min_pct > 0:
        max_total_for_current = int(present / (min_pct / 100.0))
        can_miss = max(0, max_total_for_current - total)
    return {
        "total": total,
        "present": present,
        "absent": total - present,
        "percentage": pct,
        "can_miss": can_miss,
        "at_risk": pct < min_pct,
    }
