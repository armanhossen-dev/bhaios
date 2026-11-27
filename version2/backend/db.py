"""Versioned SQLite + FTS5 storage layer for BhaiOS v2."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import sqlite3
import time
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

DEFAULT_DATA_DIR = Path(os.environ.get("BHAIOS_DATA_DIR", Path(__file__).resolve().parent.parent / "data"))
SCHEMA_VERSION = 1

MIGRATIONS: dict[int, str] = {
    1: """
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;

    CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT 'Student',
        university TEXT DEFAULT '',
        department TEXT DEFAULT 'CSE',
        language TEXT NOT NULL DEFAULT 'en',
        theme TEXT NOT NULL DEFAULT 'light',
        grading_scale_json TEXT NOT NULL DEFAULT '{"A+":4.0,"A":3.75,"A-":3.5,"B+":3.25,"B":3.0,"B-":2.75,"C+":2.5,"C":2.25,"D":2.0,"F":0.0}',
        onboarding_completed INTEGER NOT NULL DEFAULT 0,
        created_at REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS semesters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        start_date TEXT DEFAULT '',
        end_date TEXT DEFAULT '',
        is_current INTEGER NOT NULL DEFAULT 1,
        created_at REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY,
        semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        title TEXT NOT NULL,
        credits REAL NOT NULL DEFAULT 3.0,
        teacher TEXT DEFAULT '',
        room TEXT DEFAULT '',
        color TEXT NOT NULL DEFAULT 'teal',
        min_attendance_pct REAL NOT NULL DEFAULT 75.0,
        target_grade TEXT DEFAULT 'A',
        schedule_json TEXT NOT NULL DEFAULT '[]',
        syllabus_file_id TEXT DEFAULT NULL,
        created_at REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        ext TEXT NOT NULL,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        file_hash TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        page_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'queued',
        error_msg TEXT DEFAULT '',
        last_used_at REAL,
        created_at REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
        file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
        page_or_slide INTEGER NOT NULL DEFAULT 1,
        section_title TEXT DEFAULT '',
        content TEXT NOT NULL,
        chunk_hash TEXT NOT NULL,
        language TEXT NOT NULL DEFAULT 'en',
        token_count INTEGER NOT NULL DEFAULT 0,
        embedding_model TEXT NOT NULL DEFAULT 'local-trigram-v1',
        created_at REAL NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        chunk_id UNINDEXED,
        course_id UNINDEXED,
        file_id UNINDEXED,
        section_title,
        content,
        tokenize='unicode61'
    );

    CREATE TABLE IF NOT EXISTS embeddings (
        chunk_id TEXT PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
        embedding_model TEXT NOT NULL,
        dim INTEGER NOT NULL,
        vector_blob BLOB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        course_id TEXT DEFAULT NULL,
        title TEXT NOT NULL DEFAULT 'New conversation',
        scope TEXT NOT NULL DEFAULT 'course',
        created_at REAL NOT NULL,
        updated_at REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'guide',
        content TEXT NOT NULL,
        grounded INTEGER NOT NULL DEFAULT 1,
        feedback TEXT DEFAULT NULL,
        created_at REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS citations (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        chunk_id TEXT NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
        file_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        page_or_slide INTEGER NOT NULL,
        passage TEXT NOT NULL,
        score REAL NOT NULL DEFAULT 0.0
    );

    CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        indexed INTEGER NOT NULL DEFAULT 1,
        updated_at REAL NOT NULL,
        created_at REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        task_type TEXT NOT NULL DEFAULT 'assignment',
        due_date TEXT DEFAULT '',
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'todo',
        subtasks_json TEXT NOT NULL DEFAULT '[]',
        estimated_mins INTEGER NOT NULL DEFAULT 60,
        logged_mins INTEGER NOT NULL DEFAULT 0,
        created_at REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assessments (
        id TEXT PRIMARY KEY,
        course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'ct',
        weight_pct REAL NOT NULL DEFAULT 10.0,
        max_marks REAL NOT NULL DEFAULT 20.0,
        obtained_marks REAL DEFAULT NULL,
        exam_date TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS grades (
        id TEXT PRIMARY KEY,
        semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
        course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        letter_grade TEXT DEFAULT '',
        grade_point REAL DEFAULT NULL,
        credits REAL NOT NULL DEFAULT 3.0,
        finalized INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY,
        course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        class_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'present',
        note TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS flashcards (
        id TEXT PRIMARY KEY,
        course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
        file_id TEXT DEFAULT NULL,
        page_or_slide INTEGER DEFAULT NULL,
        front TEXT NOT NULL,
        back TEXT NOT NULL,
        ease_factor REAL NOT NULL DEFAULT 2.5,
        interval_days INTEGER NOT NULL DEFAULT 0,
        repetitions INTEGER NOT NULL DEFAULT 0,
        due_at REAL NOT NULL,
        created_at REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        flashcard_id TEXT NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL,
        reviewed_at REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        job_type TEXT NOT NULL,
        target_id TEXT DEFAULT '',
        label TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        progress REAL NOT NULL DEFAULT 0.0,
        error_msg TEXT DEFAULT '',
        created_at REAL NOT NULL,
        updated_at REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_course ON chunks(course_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(file_id);
    CREATE INDEX IF NOT EXISTS idx_files_course ON files(course_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_flashcards_due ON flashcards(due_at);
    """
}


def new_id(prefix: str = "") -> str:
    uid = uuid.uuid4().hex[:12]
    return f"{prefix}_{uid}" if prefix else uid


class Database:
    def __init__(self, data_dir: Path | str | None = None) -> None:
        self.data_dir = Path(data_dir) if data_dir else DEFAULT_DATA_DIR
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.uploads_dir = self.data_dir / "uploads"
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = self.data_dir / "bhaios_v2.db"
        self.init_db()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def init_db(self) -> None:
        with self.connect() as conn:
            conn.execute(
                "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at REAL NOT NULL)"
            )
            cur = conn.execute("SELECT COALESCE(MAX(version), 0) AS v FROM schema_migrations")
            current_v = int(cur.fetchone()["v"])
            for v in sorted(MIGRATIONS.keys()):
                if v > current_v:
                    conn.executescript(MIGRATIONS[v])
                    conn.execute(
                        "INSERT OR REPLACE INTO schema_migrations (version, applied_at) VALUES (?, ?)",
                        (v, time.time()),
                    )
            # Ensure default user & settings exist
            if not conn.execute("SELECT 1 FROM users LIMIT 1").fetchone():
                conn.execute(
                    "INSERT INTO users (id, name, university, department, created_at) VALUES (?, ?, ?, ?, ?)",
                    ("u_default", "Student", "", "CSE", time.time()),
                )
            if not conn.execute("SELECT 1 FROM semesters LIMIT 1").fetchone():
                conn.execute(
                    "INSERT INTO semesters (id, name, is_current, created_at) VALUES (?, ?, 1, ?)",
                    ("sem_default", "Spring 2026", time.time()),
                )
            defaults = {
                "active_model": "qwen2.5:3b",
                "vision_model": "llava-phi3:latest",
                "embedding_model": "local-trigram-v1",
                "idle_unload_mins": 15,
                "network_lock": True,
                "week_start": "saturday",
            }
            for k, val in defaults.items():
                conn.execute(
                    "INSERT OR IGNORE INTO settings (key, value_json) VALUES (?, ?)",
                    (k, json.dumps(val)),
                )

    def get_setting(self, key: str, default: Any = None) -> Any:
        with self.connect() as conn:
            row = conn.execute("SELECT value_json FROM settings WHERE key = ?", (key,)).fetchone()
            return json.loads(row["value_json"]) if row else default

    def set_setting(self, key: str, value: Any) -> None:
        with self.connect() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value_json) VALUES (?, ?)",
                (key, json.dumps(value)),
            )

    def export_backup(self, passphrase: str = "") -> bytes:
        """Export all structured tables as a single portable .bhaibackup JSON/XOR payload."""
        tables = [
            "users", "semesters", "courses", "files", "chunks", "chats", "messages",
            "citations", "notes", "tasks", "assessments", "grades", "attendance",
            "flashcards", "reviews", "settings",
        ]
        payload: dict[str, Any] = {"schema_version": SCHEMA_VERSION, "exported_at": time.time(), "tables": {}}
        with self.connect() as conn:
            for t in tables:
                rows = [dict(r) for r in conn.execute(f"SELECT * FROM {t}").fetchall()]
                payload["tables"][t] = rows
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        if passphrase:
            key = hashlib.sha256(passphrase.encode("utf-8")).digest()
            obfuscated = bytes(b ^ key[i % len(key)] for i, b in enumerate(raw))
            envelope = {"encrypted": True, "data": base64.b64encode(obfuscated).decode("ascii")}
            return json.dumps(envelope).encode("utf-8")
        return json.dumps({"encrypted": False, "data": base64.b64encode(raw).decode("ascii")}).encode("utf-8")

    def import_backup(self, blob: bytes, passphrase: str = "") -> dict[str, int]:
        envelope = json.loads(blob.decode("utf-8"))
        raw = base64.b64decode(envelope["data"])
        if envelope.get("encrypted"):
            if not passphrase:
                raise ValueError("Passphrase required for encrypted backup")
            key = hashlib.sha256(passphrase.encode("utf-8")).digest()
            raw = bytes(b ^ key[i % len(key)] for i, b in enumerate(raw))
        payload = json.loads(raw.decode("utf-8"))
        counts: dict[str, int] = {}
        with self.connect() as conn:
            for t, rows in payload.get("tables", {}).items():
                if not rows:
                    continue
                cols = list(rows[0].keys())
                placeholders = ",".join("?" for _ in cols)
                col_sql = ",".join(cols)
                for row in rows:
                    conn.execute(
                        f"INSERT OR REPLACE INTO {t} ({col_sql}) VALUES ({placeholders})",
                        [row[c] for c in cols],
                    )
                counts[t] = len(rows)
            # Rebuild FTS5 index from chunks
            conn.execute("DELETE FROM chunks_fts")
            conn.execute(
                "INSERT INTO chunks_fts (chunk_id, course_id, file_id, section_title, content) "
                "SELECT id, COALESCE(course_id,''), file_id, section_title, content FROM chunks"
            )
        return counts
