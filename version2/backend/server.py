"""BhaiOS v2 FastAPI sidecar: REST + WebSocket backend for desktop & local use."""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import time
import zipfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .db import Database, new_id
from .hardware import MODEL_CATALOG, check_ollama, detect_hardware
from .ingest import SUPPORTED_EXTS, ingest_file
from .retrieval import generate_grounded_answer, hybrid_search
from .study import (
    apply_sm2,
    calculate_attendance_stats,
    calculate_course_grade_summary,
    generate_flashcards_from_course,
)

WEB_OUT_DIR = Path(__file__).resolve().parent.parent / "web" / "out"
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
STATIC_ROOT = WEB_OUT_DIR if WEB_OUT_DIR.exists() else FRONTEND_DIR

app = FastAPI(title="BhaiOS v2 Sidecar", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8765", "http://localhost:8765", "http://127.0.0.1:3000", "http://localhost:3000", "tauri://localhost", "http://localhost:1420"],
    allow_methods=["*"],
    allow_headers=["*"],
)

db = Database()
ws_clients: set[WebSocket] = set()


async def broadcast_job(event: dict[str, Any]) -> None:
    dead = []
    msg = json.dumps(event)
    for ws in list(ws_clients):
        try:
            await ws.send_text(msg)
        except Exception:
            dead.append(ws)
    for ws in dead:
        ws_clients.discard(ws)


# ---------------------------------------------------------------------------
# Health, Hardware & Onboarding
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def get_health() -> dict[str, Any]:
    hw = detect_hardware()
    ol = await check_ollama()
    with db.connect() as conn:
        user = dict(conn.execute("SELECT * FROM users LIMIT 1").fetchone())
        jobs_active = conn.execute("SELECT COUNT(*) AS c FROM jobs WHERE status IN ('queued','parsing','chunking','embedding')").fetchone()["c"]
    return {
        "status": "ok",
        "version": "2.0.0",
        "network_policy": "localhost-only" if db.get_setting("network_lock", True) else "opt-in-model-pull",
        "hardware": hw,
        "ollama": ol,
        "catalog": MODEL_CATALOG,
        "user": user,
        "active_jobs": jobs_active,
        "active_model": db.get_setting("active_model", "qwen2.5:3b"),
        "embedding_model": db.get_setting("embedding_model", "local-trigram-v1"),
    }


class OnboardingPayload(BaseModel):
    name: str = "Student"
    university: str = ""
    department: str = "CSE"
    language: str = "en"
    theme: str = "light"
    semester_name: str = "Spring 2026"
    active_model: str = "qwen2.5:3b"


@app.post("/api/onboarding")
def save_onboarding(body: OnboardingPayload) -> dict[str, Any]:
    with db.connect() as conn:
        conn.execute(
            "UPDATE users SET name=?, university=?, department=?, language=?, theme=?, onboarding_completed=1 WHERE id='u_default'",
            (body.name, body.university, body.department, body.language, body.theme),
        )
        conn.execute("UPDATE semesters SET name=? WHERE is_current=1", (body.semester_name,))
    db.set_setting("active_model", body.active_model)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Semesters & Courses
# ---------------------------------------------------------------------------
@app.get("/api/semesters")
def list_semesters() -> dict[str, Any]:
    with db.connect() as conn:
        sems = [dict(r) for r in conn.execute("SELECT * FROM semesters ORDER BY created_at DESC").fetchall()]
        courses = [dict(r) for r in conn.execute("SELECT * FROM courses ORDER BY code ASC").fetchall()]
    return {"semesters": sems, "courses": courses}


class CourseCreate(BaseModel):
    semester_id: str = "sem_default"
    code: str
    title: str
    credits: float = 3.0
    teacher: str = ""
    room: str = ""
    color: str = "teal"
    min_attendance_pct: float = 75.0
    target_grade: str = "A"
    schedule: list[dict[str, str]] = []


@app.post("/api/courses")
def create_course(body: CourseCreate) -> dict[str, Any]:
    cid = new_id("crs")
    now = time.time()
    with db.connect() as conn:
        conn.execute(
            """
            INSERT INTO courses (id, semester_id, code, title, credits, teacher, room, color, min_attendance_pct, target_grade, schedule_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                cid, body.semester_id, body.code.strip().upper(), body.title.strip(),
                body.credits, body.teacher, body.room, body.color,
                body.min_attendance_pct, body.target_grade, json.dumps(body.schedule), now,
            ),
        )
        row = dict(conn.execute("SELECT * FROM courses WHERE id=?", (cid,)).fetchone())
    return {"course": row}


@app.delete("/api/courses/{course_id}")
def delete_course(course_id: str) -> dict[str, Any]:
    with db.connect() as conn:
        conn.execute("DELETE FROM courses WHERE id=?", (course_id,))
    return {"ok": True}


# ---------------------------------------------------------------------------
# Library, Ingestion & Background Job Queue
# ---------------------------------------------------------------------------
@app.get("/api/files")
def list_files(course_id: str | None = None) -> dict[str, Any]:
    with db.connect() as conn:
        if course_id:
            rows = conn.execute(
                "SELECT f.*, (SELECT COUNT(*) FROM chunks c WHERE c.file_id=f.id) AS chunk_count FROM files f WHERE f.course_id=? ORDER BY f.created_at DESC",
                (course_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT f.*, (SELECT COUNT(*) FROM chunks c WHERE c.file_id=f.id) AS chunk_count FROM files f ORDER BY f.created_at DESC"
            ).fetchall()
    return {"files": [dict(r) for r in rows]}


@app.get("/api/files/{file_id}/chunks")
def get_file_chunks(file_id: str, page: int | None = None) -> dict[str, Any]:
    with db.connect() as conn:
        frow = conn.execute("SELECT * FROM files WHERE id=?", (file_id,)).fetchone()
        if not frow:
            raise HTTPException(404, "File not found")
        if page is not None:
            chunks = conn.execute(
                "SELECT * FROM chunks WHERE file_id=? AND page_or_slide=? ORDER BY rowid ASC",
                (file_id, page),
            ).fetchall()
        else:
            chunks = conn.execute(
                "SELECT * FROM chunks WHERE file_id=? ORDER BY page_or_slide ASC, rowid ASC",
                (file_id,),
            ).fetchall()
    return {"file": dict(frow), "chunks": [dict(c) for c in chunks]}


@app.post("/api/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    course_id: str = Form(""),
) -> dict[str, Any]:
    orig_name = Path(file.filename or "document.txt").name
    ext = Path(orig_name).suffix.lower()
    if ext not in SUPPORTED_EXTS:
        raise HTTPException(400, f"Unsupported file type: {ext}")

    content = await file.read()
    now = time.time()

    # Handle .zip bulk import
    if ext == ".zip":
        tmp_zip = db.uploads_dir / f"{new_id('zip')}_{orig_name}"
        tmp_zip.write_bytes(content)
        created_jobs = []
        with zipfile.ZipFile(tmp_zip) as zf:
            for member in zf.namelist():
                m_ext = Path(member).suffix.lower()
                if member.endswith("/") or m_ext not in SUPPORTED_EXTS or m_ext == ".zip":
                    continue
                m_bytes = zf.read(member)
                m_name = Path(member).name
                fid, jid = _register_upload(m_name, m_ext, m_bytes, course_id or None, now)
                created_jobs.append((fid, jid))
                asyncio.create_task(ingest_file(db, fid, jid, broadcast_job))
        tmp_zip.unlink(missing_ok=True)
        return {"queued": len(created_jobs), "jobs": [j for _, j in created_jobs]}

    fid, jid = _register_upload(orig_name, ext, content, course_id or None, now)
    asyncio.create_task(ingest_file(db, fid, jid, broadcast_job))
    return {"file_id": fid, "job_id": jid, "status": "queued"}


def _register_upload(filename: str, ext: str, content: bytes, course_id: str | None, now: float) -> tuple[str, str]:
    fhash = hashlib.sha256(content).hexdigest()
    fid = new_id("fil")
    jid = new_id("job")
    dest = db.uploads_dir / f"{fid}_{filename}"
    dest.write_bytes(content)
    with db.connect() as conn:
        conn.execute(
            """
            INSERT INTO files (id, course_id, filename, ext, size_bytes, file_hash, storage_path, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?)
            """,
            (fid, course_id, filename, ext, len(content), fhash, str(dest), now),
        )
        conn.execute(
            """
            INSERT INTO jobs (id, job_type, target_id, label, status, progress, created_at, updated_at)
            VALUES (?, 'ingest', ?, ?, 'queued', 0.0, ?, ?)
            """,
            (jid, fid, f"Indexing {filename}", now, now),
        )
    return fid, jid


@app.post("/api/files/{file_id}/retry")
async def retry_file(file_id: str) -> dict[str, Any]:
    jid = new_id("job")
    now = time.time()
    with db.connect() as conn:
        frow = conn.execute("SELECT filename FROM files WHERE id=?", (file_id,)).fetchone()
        if not frow:
            raise HTTPException(404, "File not found")
        conn.execute(
            "INSERT INTO jobs (id, job_type, target_id, label, status, progress, created_at, updated_at) VALUES (?, 'ingest', ?, ?, 'queued', 0.0, ?, ?)",
            (jid, file_id, f"Retry {frow['filename']}", now, now),
        )
    asyncio.create_task(ingest_file(db, file_id, jid, broadcast_job))
    return {"job_id": jid, "status": "queued"}


@app.delete("/api/files/{file_id}")
def delete_file(file_id: str) -> dict[str, Any]:
    with db.connect() as conn:
        frow = conn.execute("SELECT storage_path FROM files WHERE id=?", (file_id,)).fetchone()
        if frow:
            Path(frow["storage_path"]).unlink(missing_ok=True)
        conn.execute("DELETE FROM chunks_fts WHERE file_id=?", (file_id,))
        conn.execute("DELETE FROM files WHERE id=?", (file_id,))
    return {"ok": True}


@app.get("/api/jobs")
def list_jobs() -> dict[str, Any]:
    with db.connect() as conn:
        rows = conn.execute("SELECT * FROM jobs ORDER BY updated_at DESC LIMIT 30").fetchall()
    return {"jobs": [dict(r) for r in rows]}


# ---------------------------------------------------------------------------
# Grounded Ask & Hybrid Search
# ---------------------------------------------------------------------------
class AskPayload(BaseModel):
    query: str
    mode: str = "guide"
    course_id: str | None = None
    scope: str = "course"
    file_ids: list[str] | None = None
    language: str = "en"
    chat_id: str | None = None
    history: list[dict[str, str]] = []


@app.post("/api/ask")
async def ask_question(body: AskPayload) -> dict[str, Any]:
    res = await generate_grounded_answer(
        db=db,
        query=body.query,
        mode=body.mode,
        course_id=body.course_id,
        scope=body.scope,
        file_ids=body.file_ids,
        language=body.language,
        history=body.history,
    )
    now = time.time()
    chat_id = body.chat_id or new_id("cht")
    with db.connect() as conn:
        if not conn.execute("SELECT 1 FROM chats WHERE id=?", (chat_id,)).fetchone():
            conn.execute(
                "INSERT INTO chats (id, course_id, title, scope, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                (chat_id, body.course_id, body.query[:55], body.scope, now, now),
            )
        u_msg_id = new_id("msg")
        a_msg_id = new_id("msg")
        conn.execute(
            "INSERT INTO messages (id, chat_id, role, mode, content, grounded, created_at) VALUES (?, ?, 'user', ?, ?, 1, ?)",
            (u_msg_id, chat_id, body.mode, body.query, now),
        )
        conn.execute(
            "INSERT INTO messages (id, chat_id, role, mode, content, grounded, created_at) VALUES (?, ?, 'assistant', ?, ?, ?, ?)",
            (a_msg_id, chat_id, body.mode, res["reply"], 1 if res["grounded"] else 0, now + 0.001),
        )
        for c in res["citations"]:
            conn.execute(
                "INSERT INTO citations (id, message_id, chunk_id, file_id, filename, page_or_slide, passage, score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (new_id("cit"), a_msg_id, c["chunk_id"], c["file_id"], c["filename"], c["page_or_slide"], c["passage"], c["score"]),
            )
    res["chat_id"] = chat_id
    res["message_id"] = a_msg_id
    return res


@app.get("/api/search")
def global_search(q: str, course_id: str | None = None, scope: str = "all") -> dict[str, Any]:
    hits = hybrid_search(db, q, course_id=course_id, scope=scope, top_k=8)
    return {"results": hits}


# ---------------------------------------------------------------------------
# Study Tools: Flashcards (SM-2)
# ---------------------------------------------------------------------------
@app.get("/api/flashcards")
def list_flashcards(course_id: str | None = None, due_only: bool = False) -> dict[str, Any]:
    now = time.time()
    sql = "SELECT * FROM flashcards"
    conds = []
    params: list[Any] = []
    if course_id:
        conds.append("course_id=?")
        params.append(course_id)
    if due_only:
        conds.append("due_at <= ?")
        params.append(now)
    if conds:
        sql += " WHERE " + " AND ".join(conds)
    sql += " ORDER BY due_at ASC"
    with db.connect() as conn:
        rows = [dict(r) for r in conn.execute(sql, params).fetchall()]
    return {"flashcards": rows}


@app.post("/api/flashcards/generate")
def gen_flashcards(course_id: str) -> dict[str, Any]:
    cards = generate_flashcards_from_course(db, course_id)
    return {"created": len(cards), "flashcards": cards}


class ReviewPayload(BaseModel):
    rating: int  # 1..4


@app.post("/api/flashcards/{card_id}/review")
def review_flashcard(card_id: str, body: ReviewPayload) -> dict[str, Any]:
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM flashcards WHERE id=?", (card_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Flashcard not found")
        ef, interval, reps, due = apply_sm2(row["ease_factor"], row["interval_days"], row["repetitions"], body.rating)
        conn.execute(
            "UPDATE flashcards SET ease_factor=?, interval_days=?, repetitions=?, due_at=? WHERE id=?",
            (ef, interval, reps, due, card_id),
        )
        conn.execute(
            "INSERT INTO reviews (id, flashcard_id, rating, reviewed_at) VALUES (?, ?, ?, ?)",
            (new_id("rev"), card_id, body.rating, time.time()),
        )
    return {"ease_factor": ef, "interval_days": interval, "repetitions": reps, "due_at": due}


# ---------------------------------------------------------------------------
# Planner: Tasks & .ics Export
# ---------------------------------------------------------------------------
@app.get("/api/tasks")
def list_tasks(course_id: str | None = None) -> dict[str, Any]:
    with db.connect() as conn:
        if course_id:
            rows = conn.execute("SELECT * FROM tasks WHERE course_id=? ORDER BY due_date ASC", (course_id,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM tasks ORDER BY due_date ASC").fetchall()
    return {"tasks": [dict(r) for r in rows]}


class TaskPayload(BaseModel):
    course_id: str | None = None
    title: str
    task_type: str = "assignment"
    due_date: str = ""
    priority: str = "medium"
    estimated_mins: int = 60


@app.post("/api/tasks")
def create_task(body: TaskPayload) -> dict[str, Any]:
    tid = new_id("tsk")
    with db.connect() as conn:
        conn.execute(
            "INSERT INTO tasks (id, course_id, title, task_type, due_date, priority, status, estimated_mins, created_at) VALUES (?, ?, ?, ?, ?, ?, 'todo', ?, ?)",
            (tid, body.course_id, body.title, body.task_type, body.due_date, body.priority, body.estimated_mins, time.time()),
        )
        row = dict(conn.execute("SELECT * FROM tasks WHERE id=?", (tid,)).fetchone())
    return {"task": row}


@app.patch("/api/tasks/{task_id}")
def update_task_status(task_id: str, status: str) -> dict[str, Any]:
    with db.connect() as conn:
        conn.execute("UPDATE tasks SET status=? WHERE id=?", (status, task_id))
    return {"ok": True}


@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: str) -> dict[str, Any]:
    with db.connect() as conn:
        conn.execute("DELETE FROM tasks WHERE id=?", (task_id,))
    return {"ok": True}


@app.get("/api/planner/export.ics")
def export_ics() -> Response:
    with db.connect() as conn:
        tasks = [dict(r) for r in conn.execute("SELECT * FROM tasks WHERE due_date != ''").fetchall()]
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BhaiOS//v2//EN"]
    for t in tasks:
        dt = t["due_date"].replace("-", "")[:8]
        if len(dt) == 8:
            lines.extend([
                "BEGIN:VEVENT",
                f"UID:{t['id']}@bhaios.local",
                f"DTSTART;VALUE=DATE:{dt}",
                f"SUMMARY:[{t['task_type'].upper()}] {t['title']}",
                "END:VEVENT",
            ])
    lines.append("END:VCALENDAR")
    return Response("\r\n".join(lines), media_type="text/calendar", headers={"Content-Disposition": "attachment; filename=bhaios_schedule.ics"})


# ---------------------------------------------------------------------------
# Grades, Assessments & Attendance
# ---------------------------------------------------------------------------
@app.get("/api/grades/{course_id}")
def get_course_grades(course_id: str, target_pct: float = 80.0) -> dict[str, Any]:
    with db.connect() as conn:
        assessments = [dict(r) for r in conn.execute("SELECT * FROM assessments WHERE course_id=?", (course_id,)).fetchall()]
        attendance = [dict(r) for r in conn.execute("SELECT * FROM attendance WHERE course_id=? ORDER BY class_date DESC", (course_id,)).fetchall()]
        crs = conn.execute("SELECT min_attendance_pct FROM courses WHERE id=?", (course_id,)).fetchone()
    min_att = float(crs["min_attendance_pct"]) if crs else 75.0
    return {
        "assessments": assessments,
        "summary": calculate_course_grade_summary(assessments, target_pct),
        "attendance": attendance,
        "attendance_stats": calculate_attendance_stats(attendance, min_att),
    }


class AssessmentPayload(BaseModel):
    course_id: str
    name: str
    category: str = "ct"
    weight_pct: float = 10.0
    max_marks: float = 20.0
    obtained_marks: float | None = None


@app.post("/api/assessments")
def add_assessment(body: AssessmentPayload) -> dict[str, Any]:
    aid = new_id("asm")
    with db.connect() as conn:
        conn.execute(
            "INSERT INTO assessments (id, course_id, name, category, weight_pct, max_marks, obtained_marks) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (aid, body.course_id, body.name, body.category, body.weight_pct, body.max_marks, body.obtained_marks),
        )
    return {"id": aid}


class AttendancePayload(BaseModel):
    course_id: str
    class_date: str
    status: str = "present"


@app.post("/api/attendance")
def mark_attendance(body: AttendancePayload) -> dict[str, Any]:
    aid = new_id("att")
    with db.connect() as conn:
        conn.execute(
            "INSERT INTO attendance (id, course_id, class_date, status) VALUES (?, ?, ?, ?)",
            (aid, body.course_id, body.class_date, body.status),
        )
    return {"id": aid}


# ---------------------------------------------------------------------------
# Notes
# ---------------------------------------------------------------------------
@app.get("/api/notes")
def list_notes(course_id: str | None = None) -> dict[str, Any]:
    with db.connect() as conn:
        if course_id:
            rows = conn.execute("SELECT * FROM notes WHERE course_id=? ORDER BY updated_at DESC", (course_id,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM notes ORDER BY updated_at DESC").fetchall()
    return {"notes": [dict(r) for r in rows]}


class NotePayload(BaseModel):
    id: str | None = None
    course_id: str | None = None
    title: str
    content: str = ""
    indexed: bool = True


@app.post("/api/notes")
def save_note(body: NotePayload) -> dict[str, Any]:
    nid = body.id or new_id("not")
    now = time.time()
    with db.connect() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO notes (id, course_id, title, content, indexed, updated_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM notes WHERE id=?), ?))
            """,
            (nid, body.course_id, body.title, body.content, 1 if body.indexed else 0, now, nid, now),
        )
    return {"id": nid}


# ---------------------------------------------------------------------------
# Backup & Settings
# ---------------------------------------------------------------------------
@app.post("/api/settings")
def update_settings(payload: dict[str, Any]) -> dict[str, Any]:
    for k, v in payload.items():
        db.set_setting(k, v)
    return {"ok": True}


@app.get("/api/backup/export")
def backup_export(passphrase: str = "") -> Response:
    blob = db.export_backup(passphrase)
    return Response(
        blob,
        media_type="application/octet-stream",
        headers={"Content-Disposition": "attachment; filename=bhaios_backup.bhaibackup"},
    )


@app.post("/api/backup/import")
async def backup_import(file: UploadFile = File(...), passphrase: str = Form("")) -> dict[str, Any]:
    blob = await file.read()
    try:
        counts = db.import_backup(blob, passphrase)
    except Exception as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"restored": counts}


# ---------------------------------------------------------------------------
# WebSocket: Live Jobs Progress
# ---------------------------------------------------------------------------
@app.websocket("/ws/jobs")
async def jobs_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    ws_clients.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_clients.discard(websocket)


# ---------------------------------------------------------------------------
# Static Frontend Serving (Next.js static export preferred, fallback to frontend/)
# ---------------------------------------------------------------------------
if STATIC_ROOT.exists():
    @app.get("/")
    def serve_index() -> FileResponse:
        return FileResponse(STATIC_ROOT / "index.html")

    app.mount("/", StaticFiles(directory=STATIC_ROOT, html=True), name="static")
