"""Study Studio APIs: Flashcards (SM-2 Spaced Repetition), Grounded Quizzes, Chapter Summaries & Topic Mastery."""

from __future__ import annotations

import json
import re
import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import db_session, new_id, row_to_dict
from ..rag import retrieve_relevant_chunks
from ..services.bhai_agent import generate_with_fallback

router = APIRouter(prefix="/api/study", tags=["study"])


class FlashcardCreate(BaseModel):
    course_id: str | None = None
    topic_id: str | None = None
    front: str
    back: str


class FlashcardReview(BaseModel):
    quality: int  # 0..5 SM-2 rating (1=Again, 3=Hard, 4=Good, 5=Easy)


class GenerateQuizRequest(BaseModel):
    course_id: str | None = None
    topic_id: str | None = None
    topic: str
    difficulty: str = "medium"
    question_type: str = "mcq"  # mcq | short | descriptive
    count: int = 4
    model: str = "qwen2.5:3b"


class QuizSubmitRequest(BaseModel):
    answers: dict[str, str]


class GenerateFlashcardsRequest(BaseModel):
    course_id: str | None = None
    topic_id: str | None = None
    topic: str
    count: int = 4
    model: str = "qwen2.5:3b"


class ChapterSummaryRequest(BaseModel):
    course_id: str | None = None
    topic: str
    model: str = "qwen2.5:3b"
    ui_language: str = "en"


def _bump_topic_mastery(conn, topic_id: str | None, *, correct: int = 0, total: int = 0, flashcards: int = 0) -> None:
    if not topic_id:
        return
    if not conn.execute("SELECT id FROM course_topics WHERE id = ?", (topic_id,)).fetchone():
        return
    now = time.time()
    existing = conn.execute("SELECT * FROM topic_mastery WHERE topic_id = ?", (topic_id,)).fetchone()
    if existing:
        conn.execute(
            """
            UPDATE topic_mastery
            SET quizzes_taken = quizzes_taken + ?,
                correct_count = correct_count + ?,
                total_attempted = total_attempted + ?,
                flashcards_reviewed = flashcards_reviewed + ?,
                last_studied_at = ?
            WHERE topic_id = ?
            """,
            (1 if total > 0 else 0, correct, total, flashcards, now, topic_id),
        )
    else:
        conn.execute(
            """
            INSERT INTO topic_mastery (topic_id, quizzes_taken, correct_count, total_attempted, flashcards_reviewed, last_studied_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (topic_id, 1 if total > 0 else 0, correct, total, flashcards, now),
        )


@router.get("/flashcards")
def list_flashcards(course_id: str | None = None) -> list[dict]:
    with db_session() as conn:
        sql = "SELECT * FROM flashcards"
        params: tuple = ()
        if course_id:
            sql += " WHERE course_id = ?"
            params = (course_id,)
        sql += " ORDER BY next_review_at ASC, created_at DESC"
        rows = conn.execute(sql, params).fetchall()
    return [row_to_dict(r) for r in rows if r]


@router.post("/flashcards")
def create_flashcard(req: FlashcardCreate) -> dict:
    fid = new_id("fc")
    now = time.time()
    with db_session() as conn:
        conn.execute(
            """
            INSERT INTO flashcards (id, course_id, topic_id, front, back, next_review_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (fid, req.course_id, req.topic_id, req.front.strip(), req.back.strip(), now, now),
        )
        row = conn.execute("SELECT * FROM flashcards WHERE id = ?", (fid,)).fetchone()
    return row_to_dict(row) or {}


@router.post("/flashcards/{card_id}/review")
def review_flashcard(card_id: str, req: FlashcardReview) -> dict:
    """Update SM-2 spaced repetition interval and topic mastery."""
    q = max(0, min(5, req.quality))
    with db_session() as conn:
        row = conn.execute("SELECT * FROM flashcards WHERE id = ?", (card_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Flashcard not found")
        ef = float(row["ease_factor"])
        reps = int(row["repetitions"])
        interval = int(row["interval_days"])

        if q < 3:
            reps = 0
            interval = 1
        else:
            if reps == 0:
                interval = 1
            elif reps == 1:
                interval = 6
            else:
                interval = round(interval * ef)
            reps += 1

        ef = max(1.3, ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
        next_review = time.time() + interval * 86400
        conn.execute(
            """
            UPDATE flashcards
            SET ease_factor = ?, interval_days = ?, repetitions = ?, next_review_at = ?
            WHERE id = ?
            """,
            (round(ef, 2), interval, reps, next_review, card_id),
        )
        _bump_topic_mastery(conn, row["topic_id"], flashcards=1)
        updated = conn.execute("SELECT * FROM flashcards WHERE id = ?", (card_id,)).fetchone()
    return row_to_dict(updated) or {}


@router.delete("/flashcards/{card_id}")
def delete_flashcard(card_id: str) -> dict:
    with db_session() as conn:
        conn.execute("DELETE FROM flashcards WHERE id = ?", (card_id,))
    return {"deleted": card_id}


@router.post("/flashcards/generate")
async def generate_flashcards(req: GenerateFlashcardsRequest) -> list[dict]:
    chunks = retrieve_relevant_chunks(req.topic, top_k=4, course_id=req.course_id)
    context = "\n".join(f"[{c['filename']} p.{c['page_num']}] {c['content']}" for c in chunks)
    prompt = (
        f"Generate {req.count} concise study flashcards on '{req.topic}'.\n"
        f"Context:\n{context or 'General university CS/science curriculum.'}\n\n"
        f'Return ONLY JSON array: [{{"front": "...", "back": "..."}}]'
    )
    items: list[dict[str, str]] = []
    try:
        raw, _, _ = await generate_with_fallback(req.model, [{"role": "user", "content": prompt}])
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if match:
            items = json.loads(match.group(0))
    except Exception:
        pass

    if not items:
        items = [
            {
                "front": f"Key concept in {req.topic}",
                "back": chunks[0]["content"][:220] if chunks else f"Review core definition and formula of {req.topic}.",
            }
        ]

    created = []
    now = time.time()
    source_doc = chunks[0]["doc_id"] if chunks else None
    with db_session() as conn:
        for it in items[: req.count]:
            fid = new_id("fc")
            conn.execute(
                "INSERT INTO flashcards (id, course_id, topic_id, source_doc_id, front, back, next_review_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    fid,
                    req.course_id,
                    req.topic_id,
                    source_doc,
                    str(it.get("front", "")).strip(),
                    str(it.get("back", "")).strip(),
                    now,
                    now,
                ),
            )
            created.append(row_to_dict(conn.execute("SELECT * FROM flashcards WHERE id = ?", (fid,)).fetchone()))
    return [c for c in created if c]


@router.get("/quizzes")
def list_quizzes(course_id: str | None = None) -> list[dict]:
    with db_session() as conn:
        sql = "SELECT * FROM quiz_sessions"
        params: tuple = ()
        if course_id:
            sql += " WHERE course_id = ?"
            params = (course_id,)
        sql += " ORDER BY created_at DESC LIMIT 20"
        rows = conn.execute(sql, params).fetchall()
    return [row_to_dict(r) for r in rows if r]


@router.post("/quizzes/generate")
async def generate_quiz(req: GenerateQuizRequest) -> dict:
    chunks = retrieve_relevant_chunks(req.topic, top_k=4, course_id=req.course_id)
    citations = ", ".join({f"{c['filename']} p.{c['page_num']}" for c in chunks})
    context = "\n".join(f"[{c['filename']} p.{c['page_num']}] {c['content']}" for c in chunks)
    qtype = req.question_type if req.question_type in {"mcq", "short", "descriptive"} else "mcq"

    format_spec = (
        '[{"prompt": "...", "options": ["A", "B", "C", "D"], "correct_answer": "A", "explanation": "..."}]'
        if qtype == "mcq"
        else '[{"prompt": "...", "options": [], "correct_answer": "Key model answer...", "explanation": "..."}]'
    )
    prompt = (
        f"Create {req.count} {req.difficulty}-difficulty {qtype.upper()} questions about '{req.topic}'.\n"
        f"Source material:\n{context or 'Standard university curriculum.'}\n\n"
        f"Return ONLY JSON array: {format_spec}"
    )
    questions_data: list[dict] = []
    try:
        raw, _, _ = await generate_with_fallback(req.model, [{"role": "user", "content": prompt}])
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if match:
            questions_data = json.loads(match.group(0))
    except Exception:
        pass

    if not questions_data:
        if qtype == "mcq":
            questions_data = [
                {
                    "prompt": f"Which statement best describes {req.topic}?",
                    "options": [
                        f"Core principle of {req.topic}",
                        "Unrelated random noise",
                        "Deprecated legacy syntax",
                        "None of the above",
                    ],
                    "correct_answer": f"Core principle of {req.topic}",
                    "explanation": chunks[0]["content"][:200] if chunks else f"Grounded in {req.topic} fundamentals.",
                }
            ]
        else:
            questions_data = [
                {
                    "prompt": f"Explain {req.topic} concisely with one concrete example.",
                    "options": [],
                    "correct_answer": chunks[0]["content"][:240] if chunks else f"Core mechanism and example of {req.topic}.",
                    "explanation": "Compare key terms, steps, and edge cases.",
                }
            ]

    qid = new_id("qz")
    now = time.time()
    saved_questions = []
    with db_session() as conn:
        conn.execute(
            "INSERT INTO quiz_sessions (id, course_id, topic_id, difficulty, total_questions, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (qid, req.course_id, req.topic_id, req.difficulty, len(questions_data[: req.count]), now),
        )
        for q in questions_data[: req.count]:
            q_item_id = new_id("qq")
            opts = q.get("options", []) if qtype == "mcq" else []
            conn.execute(
                """
                INSERT INTO quiz_questions (id, quiz_id, question_type, prompt, options_json, correct_answer, explanation, source_citation)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    q_item_id,
                    qid,
                    qtype,
                    str(q.get("prompt", "")),
                    json.dumps(opts),
                    str(q.get("correct_answer", opts[0] if opts else "")),
                    str(q.get("explanation", "")),
                    citations,
                ),
            )
            row = row_to_dict(conn.execute("SELECT * FROM quiz_questions WHERE id = ?", (q_item_id,)).fetchone())
            if row:
                row["options"] = json.loads(row.pop("options_json", "[]"))
                saved_questions.append(row)
        quiz_row = row_to_dict(conn.execute("SELECT * FROM quiz_sessions WHERE id = ?", (qid,)).fetchone()) or {}
    quiz_row["questions"] = saved_questions
    return quiz_row


@router.post("/quizzes/{quiz_id}/submit")
def submit_quiz(quiz_id: str, req: QuizSubmitRequest) -> dict:
    with db_session() as conn:
        quiz = conn.execute("SELECT * FROM quiz_sessions WHERE id = ?", (quiz_id,)).fetchone()
        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")
        q_rows = conn.execute("SELECT * FROM quiz_questions WHERE quiz_id = ?", (quiz_id,)).fetchall()
        correct = 0
        graded = []
        for qr in q_rows:
            ans = req.answers.get(qr["id"], "").strip()
            expected = qr["correct_answer"].strip()
            if qr["question_type"] == "mcq":
                is_ok = 1 if ans.lower() == expected.lower() else 0
            else:
                # Keyword overlap grading for offline short/descriptive practice
                exp_words = {w for w in re.findall(r"\w{4,}", expected.lower())}
                ans_words = {w for w in re.findall(r"\w{4,}", ans.lower())}
                overlap = len(exp_words.intersection(ans_words))
                is_ok = 1 if ans and (overlap >= max(1, min(2, len(exp_words)))) else 0
            correct += is_ok
            conn.execute(
                "UPDATE quiz_questions SET user_answer = ?, is_correct = ? WHERE id = ?",
                (ans, is_ok, qr["id"]),
            )
            item = row_to_dict(conn.execute("SELECT * FROM quiz_questions WHERE id = ?", (qr["id"],)).fetchone())
            if item:
                item["options"] = json.loads(item.pop("options_json", "[]"))
                graded.append(item)
        total = max(1, len(q_rows))
        score = round((correct / total) * 100, 1)
        conn.execute(
            "UPDATE quiz_sessions SET score = ?, completed_at = ? WHERE id = ?",
            (score, time.time(), quiz_id),
        )
        _bump_topic_mastery(conn, quiz["topic_id"], correct=correct, total=len(q_rows))
    return {"quiz_id": quiz_id, "score": score, "correct": correct, "total": len(q_rows), "questions": graded}


@router.post("/chapter-summary")
async def generate_chapter_summary(req: ChapterSummaryRequest) -> dict:
    """Produce structured exam-ready revision summary + citations grounded in course materials."""
    chunks = retrieve_relevant_chunks(req.topic, top_k=5, course_id=req.course_id)
    citations = [
        {"doc_id": c["doc_id"], "filename": c["filename"], "page_num": c["page_num"], "score": c["score"]}
        for c in chunks
    ]
    context = "\n\n".join(f"[{c['filename']} · {c.get('source_location', f'Page {c['page_num']}')}]\n{c['content']}" for c in chunks)
    lang_note = "Write in clean Unicode Bangla with English technical terms." if req.ui_language == "bn" else "Write concisely in structured Markdown."
    prompt = (
        f"Create a concise university exam revision summary for '{req.topic}'. Include Key Definitions, Formulas ($...$), and Common Pitfalls.\n"
        f"Source Excerpts:\n{context or 'No specific excerpts uploaded yet.'}\n\n{lang_note}"
    )
    try:
        summary, _, used_model = await generate_with_fallback(req.model, [{"role": "user", "content": prompt}])
    except Exception:
        used_model = "extractive-offline"
        summary = (
            f"### {req.topic} — Key Source Excerpts\n\n"
            + ("\n\n".join(f"- **{c['filename']} p.{c['page_num']}**: {c['content'][:220]}" for c in chunks) or "Upload course notes to summarize.")
        )
    return {"topic": req.topic, "summary": summary, "model_used": used_model, "citations": citations}
