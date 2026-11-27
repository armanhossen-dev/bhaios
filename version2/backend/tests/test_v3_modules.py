"""Comprehensive v3 tests: Migrations 2-3, Security, Ingestion Adapters, Hybrid FTS5 RAG, Visual QR, KG, Lecture Studio & Privacy."""

from __future__ import annotations

import io
import os
import tempfile
import time
import wave
import zipfile
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pytest
from fastapi.testclient import TestClient

_tmp = tempfile.TemporaryDirectory()
os.environ["BHAIOS_DATA_DIR"] = _tmp.name
os.environ["BHAIOS_DB_PATH"] = str(Path(_tmp.name) / "test_v3.db")
os.environ["BHAIOS_DISABLE_EMBEDDINGS"] = "1"

from version2.backend.core.security import extract_zip_safely  # noqa: E402
from version2.backend.db import db_session, init_db  # noqa: E402
from version2.backend.main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    init_db()
    with TestClient(app) as c:
        yield c


def test_migrations_v3_tables_and_fts5_present(client: TestClient):
    with db_session() as conn:
        tables = {
            r[0]
            for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        }
        migrations = {r[0] for r in conn.execute("SELECT version FROM schema_migrations").fetchall()}
    assert {1, 2, 3}.issubset(migrations)
    for expected in (
        "ingestion_jobs",
        "document_pages",
        "document_assets",
        "knowledge_relationships",
        "lecture_transcripts",
        "doc_chunks_fts",
    ):
        assert expected in tables


def test_security_magic_bytes_and_zip_slip(client: TestClient):
    # Spoofed PDF bytes rejected with 415
    bad_pdf = client.post(
        "/api/documents/upload",
        files={"file": ("fake.pdf", b"<html>not a pdf</html>", "application/pdf")},
        data={"pipeline": "ocr"},
    )
    assert bad_pdf.status_code == 415

    # Zip-slip path traversal blocked
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("../../evil.txt", "pwned")
    with pytest.raises(Exception):
        extract_zip_safely(buf.getvalue())


def test_xlsx_zip_qr_and_background_batch_jobs(client: TestClient):
    import openpyxl

    crs_sample = client.post("/api/academics/sample-setup")
    assert crs_sample.status_code == 200
    course_id = client.get("/api/academics/tree").json()["courses"][0]["id"]

    # 1) XLSX workbook upload
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Grades"
    ws.append(["Topic", "Score"])
    ws.append(["PageRank", "95"])
    xbuf = io.BytesIO()
    wb.save(xbuf)
    xres = client.post(
        "/api/documents/upload",
        files={"file": ("scores.xlsx", xbuf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        data={"pipeline": "ocr", "course_id": course_id},
    )
    assert xres.status_code == 200
    assert xres.json()["file_type"] == "xlsx"

    # 2) Valid ZIP containing Python + Markdown
    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, "w") as zf:
        zf.writestr("lecture/algo.py", "def dijkstra(graph, src):\n    return {}\n")
        zf.writestr("lecture/readme.md", "# Shortest Path Notes\nDijkstra guarantees optimality for non-negative edges.")
    zres = client.post(
        "/api/documents/upload",
        files={"file": ("bundle.zip", zbuf.getvalue(), "application/zip")},
        data={"pipeline": "ocr", "course_id": course_id},
    )
    assert zres.status_code == 200
    assert zres.json()["file_type"] == "zip"
    assert len(zres.json().get("extracted_children", [])) == 2

    # 3) FTS5 bilingual search inside course
    hits = client.get("/api/documents/search", params={"q": "Dijkstra optimality", "course_id": course_id}).json()
    assert hits and any("readme.md" in h["filename"] for h in hits)

    # 4) OpenCV QR generation + Visual Studio safe decode (never auto-opens)
    img_bytes = np.full((120, 120, 3), 255, dtype=np.uint8)
    import cv2

    _, png_buf = cv2.imencode(".png", img_bytes)
    img_up = client.post(
        "/api/documents/upload",
        files={"file": ("board.png", png_buf.tobytes(), "image/png")},
        data={"pipeline": "ocr", "course_id": course_id},
    )
    assert img_up.status_code == 200
    doc_id = img_up.json()["id"]

    with patch("version2.backend.routers.documents.decode_qr_codes", return_value=["https://ocw.mit.edu/cs-notes"]):
        vis = client.post("/api/documents/analyze-visual", json={"doc_id": doc_id, "task": "qr"})
        assert vis.status_code == 200
        assert vis.json()["qr_payloads"] == ["https://ocw.mit.edu/cs-notes"]

    # 5) Background batch upload & job status polling
    batch = client.post(
        "/api/documents/batch-upload",
        files=[("files", ("batch1.txt", b"Virtual memory paging and TLB hit ratio.", "text/plain"))],
        data={"pipeline": "ocr", "course_id": course_id},
    )
    assert batch.status_code == 200
    job_id = batch.json()["jobs"][0]["id"]
    for _ in range(25):
        status_res = client.get(f"/api/documents/jobs/{job_id}").json()
        if status_res["status"] in ("completed", "failed"):
            break
        time.sleep(0.1)
    assert status_res["status"] == "completed"


def test_knowledge_graph_chapter_summary_quiz_mastery_lecture_and_export(client: TestClient):
    course_id = client.get("/api/academics/tree").json()["courses"][0]["id"]
    detail = client.get(f"/api/academics/courses/{course_id}").json()
    topic_id = detail["topics"][0]["id"]

    # Knowledge graph extract + student custom edge CRUD
    kg = client.post("/api/knowledge-graph/extract", json={"course_id": course_id}).json()
    assert len(kg["edges"]) >= 1
    custom = client.post(
        "/api/knowledge-graph/edges",
        json={
            "course_id": course_id,
            "source_label": "Paging",
            "target_label": "Page Fault",
            "relation_type": "prerequisite",
        },
    ).json()
    assert custom["is_user_edited"] == 1
    assert client.delete(f"/api/knowledge-graph/edges/{custom['id']}").status_code == 200

    # Short-answer quiz generation + grading + topic_mastery persistence
    qz = client.post(
        "/api/study/quizzes/generate",
        json={
            "course_id": course_id,
            "topic_id": topic_id,
            "topic": "Deadlocks",
            "difficulty": "medium",
            "question_type": "short",
            "count": 1,
        },
    ).json()
    qid = qz["questions"][0]["id"]
    sub = client.post(f"/api/study/quizzes/{qz['id']}/submit", json={"answers": {qid: "Deadlocks mechanism example"}}).json()
    assert "score" in sub

    with db_session() as conn:
        tm = conn.execute("SELECT * FROM topic_mastery WHERE topic_id = ?", (topic_id,)).fetchone()
        assert tm is not None and tm["quizzes_taken"] >= 1

    # Chapter summary
    chap = client.post("/api/study/chapter-summary", json={"course_id": course_id, "topic": "Deadlocks"}).json()
    assert "summary" in chap and len(chap["summary"]) > 10

    # Lecture Studio audio upload & analyze (mocking whisper inference for fast unit test)
    wbuf = io.BytesIO()
    with wave.open(wbuf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        wf.writeframes(np.zeros(16000, dtype=np.int16).tobytes())

    with patch(
        "version2.backend.services.ingestion.audio_adapter._transcribe_audio_sync",
        return_value=([{"start": 0.0, "end": 1.0, "text": "Today we cover Banker algorithm."}], "Today we cover Banker algorithm."),
    ):
        lec = client.post(
            "/api/lectures/upload-analyze",
            files={"file": ("os_lec1.wav", wbuf.getvalue(), "audio/wav")},
            data={"course_id": course_id, "title": "OS Lecture 1"},
        )
        assert lec.status_code == 200
        assert "Banker" in lec.json()["summary"] or len(lec.json()["segments"]) >= 1

    # Workspace export
    exp = client.get("/api/settings/export")
    assert exp.status_code == 200
    assert exp.json()["schema_version"] == 3
    assert len(exp.json()["courses"]) >= 2
