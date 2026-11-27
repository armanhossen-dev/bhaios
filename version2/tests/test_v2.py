"""Unit and API integration tests for BhaiOS v2."""

from __future__ import annotations

import asyncio
import os
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from backend.db import Database
from backend.ingest import ingest_file, structure_aware_chunk
from backend.retrieval import hybrid_search
from backend.study import apply_sm2, calculate_attendance_stats, calculate_course_grade_summary


class BhaiOSV2Tests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Database(self.tmp.name)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_schema_migrations_and_backup_roundtrip(self) -> None:
        with self.db.connect() as conn:
            v = conn.execute("SELECT MAX(version) FROM schema_migrations").fetchone()[0]
            self.assertEqual(v, 1)
            conn.execute(
                "INSERT INTO courses (id, semester_id, code, title, created_at) VALUES ('c1', 'sem_default', 'CSE2201', 'DSA', 1.0)"
            )
        blob = self.db.export_backup(passphrase="secret123")
        with self.db.connect() as conn:
            conn.execute("DELETE FROM courses WHERE id='c1'")
        counts = self.db.import_backup(blob, passphrase="secret123")
        self.assertGreaterEqual(counts.get("courses", 0), 1)

    def test_structure_aware_chunking_preserves_code(self) -> None:
        sections = [
            {
                "page_or_slide": 4,
                "section_title": "Binary Search",
                "content": "Intro text.\n\n```python\ndef bs(a, x):\n    return 0\n```\n\nMore explanation.",
            }
        ]
        chunks = structure_aware_chunk(sections, min_tokens=5, max_tokens=200)
        self.assertTrue(any("```python" in c["content"] and "return 0" in c["content"] for c in chunks))

    def test_ingestion_and_hybrid_search(self) -> None:
        sample = Path(self.tmp.name) / "dsa_lec5.md"
        sample.write_text("# Merge Sort\nMerge sort runs in O(n log n) worst-case time using divide and conquer.\n", encoding="utf-8")
        with self.db.connect() as conn:
            conn.execute(
                "INSERT INTO courses (id, semester_id, code, title, created_at) VALUES ('c_dsa', 'sem_default', 'CSE2201', 'DSA', 1.0)"
            )
            conn.execute(
                "INSERT INTO files (id, course_id, filename, ext, size_bytes, file_hash, storage_path, status, created_at) "
                "VALUES ('f1', 'c_dsa', 'dsa_lec5.md', '.md', 80, 'h1', ?, 'queued', 1.0)",
                (str(sample),),
            )
        res = asyncio.run(ingest_file(self.db, "f1"))
        self.assertEqual(res["status"], "ready")
        hits = hybrid_search(self.db, "Merge sort worst-case time", course_id="c_dsa", scope="course")
        self.assertTrue(len(hits) >= 1)
        self.assertEqual(hits[0]["filename"], "dsa_lec5.md")

    def test_sm2_and_grade_attendance_math(self) -> None:
        ef, iv, reps, _ = apply_sm2(2.5, 0, 0, rating=3)
        self.assertEqual((iv, reps), (1, 1))
        self.assertGreaterEqual(ef, 1.3)

        g = calculate_course_grade_summary(
            [{"weight_pct": 20, "max_marks": 20, "obtained_marks": 16}, {"weight_pct": 80, "max_marks": 100, "obtained_marks": None}],
            target_pct=80.0,
        )
        self.assertEqual(g["earned_pct"], 16.0)
        self.assertEqual(g["needed_pct_on_remaining"], 80.0)

        att = calculate_attendance_stats(
            [{"status": "present"}, {"status": "present"}, {"status": "present"}, {"status": "absent"}],
            min_pct=75.0,
        )
        self.assertEqual(att["percentage"], 75.0)
        self.assertEqual(att["can_miss"], 0)

    def test_fastapi_endpoints(self) -> None:
        os.environ["BHAIOS_DATA_DIR"] = self.tmp.name
        from backend import server
        server.db = self.db
        client = TestClient(server.app)

        self.assertEqual(client.get("/api/health").status_code, 200)
        c_res = client.post("/api/courses", json={"code": "CSE3101", "title": "OS", "credits": 3.0})
        self.assertEqual(c_res.status_code, 200)
        cid = c_res.json()["course"]["id"]

        up = client.post(
            "/api/files/upload",
            data={"course_id": cid},
            files={"file": ("os_notes.txt", b"Deadlock requires mutual exclusion, hold and wait, no preemption, circular wait.", "text/plain")},
        )
        self.assertEqual(up.status_code, 200)
        self.assertEqual(client.get("/api/planner/export.ics").status_code, 200)


if __name__ == "__main__":
    unittest.main()
