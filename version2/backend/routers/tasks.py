"""Tasks & Pomodoro focus session endpoints."""

from __future__ import annotations

import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import db_session, new_id, row_to_dict

router = APIRouter(prefix="/api", tags=["tasks"])


class TaskCreate(BaseModel):
    title: str
    subject: str = "General"
    due_date: str | None = None
    priority: str = "medium"
    course_id: str | None = None
    task_type: str = "assignment"


class TaskUpdate(BaseModel):
    title: str | None = None
    subject: str | None = None
    due_date: str | None = None
    priority: str | None = None
    completed: bool | None = None


class FocusSessionCreate(BaseModel):
    duration_minutes: int
    subject: str = "General"


@router.get("/tasks")
def list_tasks(course_id: str | None = None) -> list[dict]:
    with db_session() as conn:
        sql = "SELECT * FROM tasks"
        params: tuple = ()
        if course_id:
            sql += " WHERE course_id = ?"
            params = (course_id,)
        sql += " ORDER BY completed ASC, created_at DESC"
        rows = conn.execute(sql, params).fetchall()
    return [row_to_dict(r) for r in rows if r]


@router.post("/tasks")
def create_task(req: TaskCreate) -> dict:
    task_id = new_id("tsk")
    now = time.time()
    with db_session() as conn:
        conn.execute(
            """
            INSERT INTO tasks (id, title, subject, due_date, priority, completed, created_at, course_id, task_type)
            VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
            """,
            (task_id, req.title.strip(), req.subject, req.due_date, req.priority, now, req.course_id, req.task_type),
        )
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    return row_to_dict(row) or {}


@router.patch("/tasks/{task_id}")
def update_task(task_id: str, req: TaskUpdate) -> dict:
    with db_session() as conn:
        existing = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Task not found")

        updates = []
        values = []
        if req.title is not None:
            updates.append("title = ?")
            values.append(req.title.strip())
        if req.subject is not None:
            updates.append("subject = ?")
            values.append(req.subject)
        if req.due_date is not None:
            updates.append("due_date = ?")
            values.append(req.due_date)
        if req.priority is not None:
            updates.append("priority = ?")
            values.append(req.priority)
        if req.completed is not None:
            updates.append("completed = ?")
            values.append(1 if req.completed else 0)

        if updates:
            values.append(task_id)
            conn.execute(f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?", tuple(values))
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    return row_to_dict(row) or {}


@router.delete("/tasks/{task_id}")
def delete_task(task_id: str) -> dict:
    with db_session() as conn:
        cur = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Task not found")
    return {"deleted": task_id}


@router.get("/focus-sessions")
def list_focus_sessions() -> list[dict]:
    with db_session() as conn:
        rows = conn.execute(
            "SELECT * FROM focus_sessions ORDER BY completed_at DESC LIMIT 50"
        ).fetchall()
    return [row_to_dict(r) for r in rows if r]


@router.post("/focus-sessions")
def log_focus_session(req: FocusSessionCreate) -> dict:
    sid = new_id("foc")
    now = time.time()
    with db_session() as conn:
        conn.execute(
            "INSERT INTO focus_sessions (id, duration_minutes, subject, completed_at) VALUES (?, ?, ?, ?)",
            (sid, req.duration_minutes, req.subject, now),
        )
        row = conn.execute("SELECT * FROM focus_sessions WHERE id = ?", (sid,)).fetchone()
    return row_to_dict(row) or {}
