"""SQLite persistence layer for BhaiOS v2."""

from __future__ import annotations

import json
import sqlite3
import time
import uuid
from contextlib import contextmanager
from typing import Any, Generator

from .config import DB_PATH

SEED_RESOURCES = [
    {
        "id": "res-physics-kinematics",
        "title": "Kinematics & Projectile Motion",
        "subject": "Physics",
        "category": "Formula Sheet",
        "content": (
            "### Equations of Motion (Constant Acceleration)\n"
            "- $v = u + at$\n"
            "- $s = ut + \\frac{1}{2}at^2$\n"
            "- $v^2 = u^2 + 2as$\n\n"
            "### Projectile Motion\n"
            "- Time of flight: $T = \\frac{2u\\sin\\theta}{g}$\n"
            "- Maximum height: $H = \\frac{u^2\\sin^2\\theta}{2g}$\n"
            "- Horizontal range: $R = \\frac{u^2\\sin 2\\theta}{g}$"
        ),
    },
    {
        "id": "res-math-calculus",
        "title": "Integration by Parts & Standard Integrals",
        "subject": "Math",
        "category": "Formula Sheet",
        "content": (
            "### Integration by Parts (LIATE Rule)\n"
            "$$\\int u\\,dv = uv - \\int v\\,du$$\n\n"
            "**LIATE Priority:** Logarithmic > Inverse Trig > Algebraic > Trigonometric > Exponential.\n\n"
            "### Key Standard Integrals\n"
            "- $\\int \\frac{1}{x^2 + a^2}\\,dx = \\frac{1}{a}\\tan^{-1}\\left(\\frac{x}{a}\\right) + C$\n"
            "- $\\int e^x [f(x) + f'(x)]\\,dx = e^x f(x) + C$"
        ),
    },
    {
        "id": "res-chem-thermodynamics",
        "title": "Chemical Thermodynamics & Equilibrium",
        "subject": "Chemistry",
        "category": "Formula Sheet",
        "content": (
            "### First Law & Gibbs Free Energy\n"
            "- $\\Delta U = q + w$\n"
            "- $\\Delta G = \\Delta H - T\\Delta S$\n"
            "- $\\Delta G^\\circ = -RT\\ln K_{eq}$\n\n"
            "### Ideal Gas & Kp/Kc Relation\n"
            "- $PV = nRT$\n"
            "- $K_p = K_c (RT)^{\\Delta n}$"
        ),
    },
    {
        "id": "res-bangla-byakoron",
        "title": "বাংলা ব্যাকরণ: সমাস ও সন্ধি (HSC Quick Reference)",
        "subject": "Bangla",
        "category": "Reference",
        "content": (
            "### সমাস (প্রধান ৬ প্রকার)\n"
            "১. **দ্বন্দ্ব সমাস**: উভয় পদ প্রধান (যেমন: মা-বাবা, দোয়াত-কলম)\n"
            "২. **কর্মধারয় সমাস**: পরপদ প্রধান, বিশেষণ-বিশেষ্য সম্পর্ক (যেমন: নীলপদ্ম)\n"
            "৩. **তৎপুরুষ সমাস**: পূর্বপদের বিভক্তি লোপ পায় (যেমন: রাজপুত্র)\n"
            "৪. **বহুব্রীহি সমাস**: কোনো পদের অর্থই প্রধান নয়, নতুন অর্থ প্রকাশ করে (যেমন: পীতাম্বর)\n"
            "৫. **দ্বিগু সমাস**: সংখ্যাবাচক শব্দ পূর্বে থাকে (যেমন: ত্রিফলা)\n"
            "৬. **অব্যয়ীভাব সমাস**: পূর্বপদে অব্যয় প্রধান (যেমন: যথাবিধি)"
        ),
    },
    {
        "id": "res-ict-boolean",
        "title": "ICT: Boolean Algebra & Logic Gates",
        "subject": "ICT",
        "category": "Reference",
        "content": (
            "### De Morgan's Theorems\n"
            "- $\\overline{A + B} = \\overline{A} \\cdot \\overline{B}$\n"
            "- $\\overline{A \\cdot B} = \\overline{A} + \\overline{B}$\n\n"
            "### Universal Gates\n"
            "**NAND** and **NOR** gates are universal gates because any Boolean function can be implemented using only NAND or only NOR gates."
        ),
    },
]


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


@contextmanager
def db_session() -> Generator[sqlite3.Connection, None, None]:
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with db_session() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS chats (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                subject TEXT NOT NULL DEFAULT 'General',
                mode TEXT NOT NULL DEFAULT 'guide',
                model TEXT NOT NULL DEFAULT 'qwen2.5:3b',
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                chat_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                hints_json TEXT,
                citations_json TEXT,
                tokens INTEGER NOT NULL DEFAULT 0,
                created_at REAL NOT NULL,
                FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                original_name TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                pipeline TEXT NOT NULL DEFAULT 'ocr',
                page_count INTEGER NOT NULL DEFAULT 1,
                summary TEXT NOT NULL DEFAULT '',
                file_path TEXT NOT NULL,
                created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS doc_chunks (
                id TEXT PRIMARY KEY,
                doc_id TEXT NOT NULL,
                page_num INTEGER NOT NULL DEFAULT 1,
                content TEXT NOT NULL,
                keywords TEXT NOT NULL DEFAULT '',
                FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                subject TEXT NOT NULL DEFAULT 'General',
                due_date TEXT,
                priority TEXT NOT NULL DEFAULT 'medium',
                completed INTEGER NOT NULL DEFAULT 0,
                created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS focus_sessions (
                id TEXT PRIMARY KEY,
                duration_minutes INTEGER NOT NULL,
                subject TEXT NOT NULL DEFAULT 'General',
                completed_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS resources (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                subject TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'Formula Sheet',
                content TEXT NOT NULL,
                is_custom INTEGER NOT NULL DEFAULT 0,
                created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS benchmarks (
                id TEXT PRIMARY KEY,
                pipeline TEXT NOT NULL,
                model TEXT NOT NULL,
                question TEXT NOT NULL,
                latency_ms INTEGER NOT NULL,
                tokens INTEGER NOT NULL DEFAULT 0,
                response_preview TEXT NOT NULL DEFAULT '',
                created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            """
        )

        # Seed default resources once if empty
        count = conn.execute("SELECT COUNT(*) FROM resources").fetchone()[0]
        if count == 0:
            now = time.time()
            for res in SEED_RESOURCES:
                conn.execute(
                    """
                    INSERT INTO resources (id, title, subject, category, content, is_custom, created_at)
                    VALUES (?, ?, ?, ?, ?, 0, ?)
                    """,
                    (res["id"], res["title"], res["subject"], res["category"], res["content"], now),
                )

        from .migrations import run_migrations

        run_migrations(conn)


def new_id(prefix: str = "") -> str:
    uid = uuid.uuid4().hex[:12]
    return f"{prefix}-{uid}" if prefix else uid


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    d = dict(row)
    if "hints_json" in d:
        d["hints"] = json.loads(d["hints_json"]) if d["hints_json"] else None
        del d["hints_json"]
    if "citations_json" in d:
        d["citations"] = json.loads(d["citations_json"]) if d["citations_json"] else []
        del d["citations_json"]
    if "completed" in d:
        d["completed"] = bool(d["completed"])
    if "is_custom" in d:
        d["is_custom"] = bool(d["is_custom"])
    return d


def get_setting(key: str, default: str = "") -> str:
    with db_session() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def set_setting(key: str, value: str) -> None:
    with db_session() as conn:
        if value == "":
            conn.execute("DELETE FROM settings WHERE key = ?", (key,))
        else:
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, value),
            )
