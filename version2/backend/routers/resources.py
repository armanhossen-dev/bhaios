"""Study resources & formula vault endpoints."""

from __future__ import annotations

import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import db_session, new_id, row_to_dict

router = APIRouter(prefix="/api/resources", tags=["resources"])


class ResourceCreate(BaseModel):
    title: str
    subject: str
    category: str = "Formula Sheet"
    content: str


@router.get("")
def list_resources() -> list[dict]:
    with db_session() as conn:
        rows = conn.execute(
            "SELECT * FROM resources ORDER BY is_custom DESC, created_at DESC"
        ).fetchall()
    return [row_to_dict(r) for r in rows if r]


@router.post("")
def create_resource(req: ResourceCreate) -> dict:
    rid = new_id("res")
    now = time.time()
    with db_session() as conn:
        conn.execute(
            """
            INSERT INTO resources (id, title, subject, category, content, is_custom, created_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)
            """,
            (rid, req.title.strip(), req.subject, req.category, req.content, now),
        )
        row = conn.execute("SELECT * FROM resources WHERE id = ?", (rid,)).fetchone()
    return row_to_dict(row) or {}


@router.delete("/{resource_id}")
def delete_resource(resource_id: str) -> dict:
    with db_session() as conn:
        cur = conn.execute("DELETE FROM resources WHERE id = ?", (resource_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Resource not found")
    return {"deleted": resource_id}
