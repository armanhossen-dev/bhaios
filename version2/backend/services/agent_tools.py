"""Controlled Local Agent Tooling: Path Containment, Permission Approvals & Audit Logging."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from ..config import DATA_DIR, UPLOADS_DIR
from ..db import db_session, new_id, row_to_dict

APPROVED_DIRS = [DATA_DIR.resolve(), UPLOADS_DIR.resolve()]


def validate_approved_path(target_path: str) -> Path:
    """Ensure any agent filesystem path stays strictly inside approved local workspace directories."""
    resolved = Path(target_path).expanduser().resolve()
    if not any(str(resolved).startswith(str(root)) for root in APPROVED_DIRS):
        raise PermissionError(
            f"Access denied: '{resolved}' is outside approved BhaiOS workspace directories."
        )
    return resolved


def log_agent_action(
    action: str,
    arguments: dict[str, Any],
    *,
    approved: bool = True,
    status: str = "completed",
    result_preview: str = "",
) -> dict[str, Any]:
    aid = new_id("aud")
    now = time.time()
    with db_session() as conn:
        conn.execute(
            """
            INSERT INTO agent_audit_log (id, action, arguments_json, approved, status, result_preview, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (aid, action, json.dumps(arguments), 1 if approved else 0, status, result_preview[:300], now),
        )
        row = conn.execute("SELECT * FROM agent_audit_log WHERE id = ?", (aid,)).fetchone()
    return row_to_dict(row) or {}


def request_file_permission(action: str, target_path: str, details: str = "") -> dict[str, Any]:
    """Queue a pending approval before any filesystem modification or deletion."""
    safe_path = validate_approved_path(target_path)
    pid = new_id("perm")
    now = time.time()
    with db_session() as conn:
        conn.execute(
            """
            INSERT INTO agent_pending_approvals (id, action, target_path, details, status, created_at)
            VALUES (?, ?, ?, ?, 'pending', ?)
            """,
            (pid, action, str(safe_path), details, now),
        )
        row = conn.execute("SELECT * FROM agent_pending_approvals WHERE id = ?", (pid,)).fetchone()
    log_agent_action(action, {"target_path": str(safe_path), "details": details}, approved=False, status="awaiting_approval")
    return row_to_dict(row) or {}


def resolve_file_permission(approval_id: str, approve: bool) -> dict[str, Any]:
    with db_session() as conn:
        row = conn.execute("SELECT * FROM agent_pending_approvals WHERE id = ?", (approval_id,)).fetchone()
        if not row:
            raise ValueError("Approval request not found")
        if row["status"] != "pending":
            return row_to_dict(row) or {}

        new_status = "approved" if approve else "rejected"
        conn.execute("UPDATE agent_pending_approvals SET status = ? WHERE id = ?", (new_status, approval_id))

    safe_path = validate_approved_path(row["target_path"])
    if approve and row["action"] == "delete_file" and safe_path.exists():
        safe_path.unlink()
    elif approve and row["action"] == "write_file":
        safe_path.parent.mkdir(parents=True, exist_ok=True)
        safe_path.write_text(row["details"], encoding="utf-8")

    log_agent_action(
        row["action"],
        {"target_path": str(safe_path)},
        approved=approve,
        status=new_status,
        result_preview=f"User {new_status} {row['action']}",
    )
    with db_session() as conn:
        updated = conn.execute("SELECT * FROM agent_pending_approvals WHERE id = ?", (approval_id,)).fetchone()
    return row_to_dict(updated) or {}


def list_audit_log(limit: int = 50) -> list[dict[str, Any]]:
    with db_session() as conn:
        rows = conn.execute("SELECT * FROM agent_audit_log ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    return [row_to_dict(r) for r in rows if r]


def list_pending_approvals() -> list[dict[str, Any]]:
    with db_session() as conn:
        rows = conn.execute("SELECT * FROM agent_pending_approvals ORDER BY created_at DESC LIMIT 30").fetchall()
    return [row_to_dict(r) for r in rows if r]
