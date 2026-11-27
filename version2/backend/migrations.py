"""Non-destructive SQLite schema migrations for BhaiOS v2 -> v3."""

from __future__ import annotations

import shutil
import sqlite3
import time
from pathlib import Path

from .config import DB_PATH


def _column_exists(conn: sqlite3.Connection, table: str, column: str) -> bool:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return any(r[1] == column for r in rows)


def _add_column_if_missing(conn: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    if not _column_exists(conn, table, column):
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def run_migrations(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at REAL NOT NULL
        )
        """
    )
    applied = {r[0] for r in conn.execute("SELECT version FROM schema_migrations").fetchall()}

    if 1 not in applied:
        db_file = Path(DB_PATH)
        if db_file.exists() and db_file.stat().st_size > 0:
            bak = db_file.with_suffix(".db.bak.v2")
            if not bak.exists():
                try:
                    shutil.copy2(db_file, bak)
                except Exception:
                    pass

        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS universities (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                short_name TEXT DEFAULT '',
                created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS departments (
                id TEXT PRIMARY KEY,
                university_id TEXT NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                code TEXT DEFAULT '',
                created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS academic_years (
                id TEXT PRIMARY KEY,
                department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
                label TEXT NOT NULL,
                created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS semesters (
                id TEXT PRIMARY KEY,
                academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 0,
                start_date TEXT,
                end_date TEXT,
                created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS courses (
                id TEXT PRIMARY KEY,
                semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
                code TEXT NOT NULL,
                title TEXT NOT NULL,
                instructor TEXT DEFAULT '',
                credits REAL DEFAULT 3.0,
                syllabus TEXT DEFAULT '',
                description TEXT DEFAULT '',
                objectives TEXT DEFAULT '',
                exam_date TEXT,
                created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS course_topics (
                id TEXT PRIMARY KEY,
                course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                chapter_index INTEGER NOT NULL DEFAULT 1,
                title TEXT NOT NULL,
                summary TEXT DEFAULT '',
                status TEXT NOT NULL DEFAULT 'not_started',
                created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS flashcards (
                id TEXT PRIMARY KEY,
                course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
                topic_id TEXT REFERENCES course_topics(id) ON DELETE SET NULL,
                source_doc_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
                front TEXT NOT NULL,
                back TEXT NOT NULL,
                ease_factor REAL NOT NULL DEFAULT 2.5,
                interval_days INTEGER NOT NULL DEFAULT 0,
                repetitions INTEGER NOT NULL DEFAULT 0,
                next_review_at REAL NOT NULL,
                created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS quiz_sessions (
                id TEXT PRIMARY KEY,
                course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
                topic_id TEXT REFERENCES course_topics(id) ON DELETE SET NULL,
                difficulty TEXT NOT NULL DEFAULT 'medium',
                score REAL,
                total_questions INTEGER NOT NULL DEFAULT 0,
                created_at REAL NOT NULL,
                completed_at REAL
            );

            CREATE TABLE IF NOT EXISTS quiz_questions (
                id TEXT PRIMARY KEY,
                quiz_id TEXT NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
                question_type TEXT NOT NULL DEFAULT 'mcq',
                prompt TEXT NOT NULL,
                options_json TEXT DEFAULT '[]',
                correct_answer TEXT NOT NULL,
                explanation TEXT NOT NULL DEFAULT '',
                source_citation TEXT DEFAULT '',
                user_answer TEXT,
                is_correct INTEGER
            );

            CREATE TABLE IF NOT EXISTS topic_mastery (
                topic_id TEXT PRIMARY KEY REFERENCES course_topics(id) ON DELETE CASCADE,
                quizzes_taken INTEGER NOT NULL DEFAULT 0,
                correct_count INTEGER NOT NULL DEFAULT 0,
                total_attempted INTEGER NOT NULL DEFAULT 0,
                flashcards_reviewed INTEGER NOT NULL DEFAULT 0,
                last_studied_at REAL
            );
            """
        )

        _add_column_if_missing(conn, "chats", "course_id", "TEXT")
        _add_column_if_missing(conn, "chats", "agent_mode", "TEXT NOT NULL DEFAULT 'tutor'")
        _add_column_if_missing(conn, "chats", "answer_policy", "TEXT NOT NULL DEFAULT 'balanced'")

        _add_column_if_missing(conn, "documents", "course_id", "TEXT")
        _add_column_if_missing(conn, "documents", "topic_id", "TEXT")
        _add_column_if_missing(conn, "documents", "file_type", "TEXT NOT NULL DEFAULT 'document'")
        _add_column_if_missing(conn, "documents", "sha256", "TEXT")
        _add_column_if_missing(conn, "documents", "status", "TEXT NOT NULL DEFAULT 'completed'")

        _add_column_if_missing(conn, "doc_chunks", "course_id", "TEXT")
        _add_column_if_missing(conn, "doc_chunks", "content_type", "TEXT NOT NULL DEFAULT 'text'")
        _add_column_if_missing(conn, "doc_chunks", "source_location", "TEXT NOT NULL DEFAULT ''")

        _add_column_if_missing(conn, "tasks", "course_id", "TEXT")
        _add_column_if_missing(conn, "tasks", "task_type", "TEXT NOT NULL DEFAULT 'assignment'")

        conn.execute("CREATE INDEX IF NOT EXISTS idx_documents_course ON documents(course_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_documents_sha256 ON documents(sha256)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_chunks_course ON doc_chunks(course_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_tasks_course ON tasks(course_id)")

        conn.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (1, 'v3_academics_study_columns', ?)",
            (time.time(),),
        )

    if 2 not in applied:
        _add_column_if_missing(conn, "documents", "error_message", "TEXT")
        _add_column_if_missing(conn, "doc_chunks", "slide_number", "INTEGER")
        _add_column_if_missing(conn, "doc_chunks", "embedding", "BLOB")

        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS ingestion_jobs (
                id TEXT PRIMARY KEY,
                document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
                course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
                filename TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'queued',
                progress INTEGER NOT NULL DEFAULT 0,
                error_message TEXT,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS document_pages (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                page_number INTEGER,
                slide_number INTEGER,
                title TEXT DEFAULT '',
                extracted_text TEXT NOT NULL DEFAULT '',
                tables_json TEXT DEFAULT '[]',
                equations_json TEXT DEFAULT '[]',
                metadata_json TEXT DEFAULT '{}'
            );

            CREATE TABLE IF NOT EXISTS document_assets (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                page_number INTEGER,
                asset_type TEXT NOT NULL,
                file_path TEXT,
                extracted_payload TEXT DEFAULT '',
                created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS knowledge_relationships (
                id TEXT PRIMARY KEY,
                course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                source_label TEXT NOT NULL,
                target_label TEXT NOT NULL,
                relation_type TEXT NOT NULL,
                evidence_doc_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
                evidence_excerpt TEXT DEFAULT '',
                is_user_edited INTEGER NOT NULL DEFAULT 0,
                created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS lecture_transcripts (
                id TEXT PRIMARY KEY,
                course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
                title TEXT NOT NULL,
                audio_path TEXT,
                segments_json TEXT NOT NULL,
                summary TEXT DEFAULT '',
                topics_json TEXT DEFAULT '[]',
                created_at REAL NOT NULL
            );
            """
        )

        conn.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (2, 'v3_ingestion_pages_kg_lectures', ?)",
            (time.time(),),
        )

    if 3 not in applied:
        conn.executescript(
            """
            CREATE INDEX IF NOT EXISTS idx_chunks_doc ON doc_chunks(doc_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_course_due ON tasks(course_id, due_date);
            CREATE INDEX IF NOT EXISTS idx_flashcards_review ON flashcards(course_id, next_review_at);

            CREATE VIRTUAL TABLE IF NOT EXISTS doc_chunks_fts USING fts5(
                chunk_id UNINDEXED,
                doc_id UNINDEXED,
                course_id UNINDEXED,
                content,
                tokenize='unicode61'
            );
            """
        )

        # Backfill existing chunks into FTS5 index once
        existing_fts = conn.execute("SELECT COUNT(*) FROM doc_chunks_fts").fetchone()[0]
        if existing_fts == 0:
            conn.execute(
                """
                INSERT INTO doc_chunks_fts (chunk_id, doc_id, course_id, content)
                SELECT id, doc_id, COALESCE(course_id, ''), content FROM doc_chunks
                """
            )

        conn.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (3, 'v3_fts5_and_indexes', ?)",
            (time.time(),),
        )

    if 4 not in applied:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS agent_audit_log (
                id TEXT PRIMARY KEY,
                action TEXT NOT NULL,
                arguments_json TEXT DEFAULT '{}',
                approved INTEGER NOT NULL DEFAULT 1,
                status TEXT NOT NULL,
                result_preview TEXT DEFAULT '',
                created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS agent_pending_approvals (
                id TEXT PRIMARY KEY,
                action TEXT NOT NULL,
                target_path TEXT NOT NULL,
                details TEXT DEFAULT '',
                status TEXT NOT NULL DEFAULT 'pending',
                created_at REAL NOT NULL
            );
            """
        )
        conn.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (4, 'v3_agent_audit_and_approvals', ?)",
            (time.time(),),
        )
