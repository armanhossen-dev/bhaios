"""Integration tests for BhaiOS v2 FastAPI backend."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Isolate DB & uploads in temp directory before importing app
_tmp = tempfile.TemporaryDirectory()
os.environ["BHAIOS_DATA_DIR"] = _tmp.name
os.environ["BHAIOS_DB_PATH"] = str(Path(_tmp.name) / "test_bhaios.db")

from version2.backend.db import init_db  # noqa: E402
from version2.backend.main import app  # noqa: E402
from version2.backend.ollama_client import parse_hint_ladder  # noqa: E402
from version2.backend.rag import clean_bangla_text  # noqa: E402


@pytest.fixture(scope="module")
def client():
    init_db()
    with TestClient(app) as c:
        yield c


def test_health_endpoint(client: TestClient):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "ram_total_gb" in data
    assert "ollama_online" in data


def test_tasks_crud_and_focus_session(client: TestClient):
    create = client.post(
        "/api/tasks",
        json={"title": "Solve Physics Ch-3", "subject": "Physics", "priority": "high"},
    )
    assert create.status_code == 200
    task = create.json()
    assert task["title"] == "Solve Physics Ch-3"
    assert task["completed"] is False

    patch = client.patch(f"/api/tasks/{task['id']}", json={"completed": True})
    assert patch.status_code == 200
    assert patch.json()["completed"] is True

    focus = client.post("/api/focus-sessions", json={"duration_minutes": 25, "subject": "Physics"})
    assert focus.status_code == 200
    assert focus.json()["duration_minutes"] == 25

    delete = client.delete(f"/api/tasks/{task['id']}")
    assert delete.status_code == 200


def test_resources_seeded_and_custom_crud(client: TestClient):
    resp = client.get("/api/resources")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) >= 5

    create = client.post(
        "/api/resources",
        json={
            "title": "Ohm's Law",
            "subject": "Physics",
            "category": "Formula Sheet",
            "content": "$V = IR$",
        },
    )
    assert create.status_code == 200
    rid = create.json()["id"]
    assert client.delete(f"/api/resources/{rid}").status_code == 200


def test_document_upload_chunking_and_search(client: TestClient):
    resp = client.post(
        "/api/documents/upload",
        files={"file": ("kinematics_note.txt", b"Projectile motion range R = u^2 sin(2 theta) / g. Maximum height H.", "text/plain")},
        data={"pipeline": "ocr"},
    )
    assert resp.status_code == 200
    doc = resp.json()
    assert doc["original_name"] == "kinematics_note.txt"
    assert doc["chunk_count"] >= 1

    search = client.get("/api/documents/search", params={"q": "projectile range"})
    assert search.status_code == 200
    hits = search.json()
    assert len(hits) >= 1
    assert hits[0]["doc_id"] == doc["id"]

    assert client.delete(f"/api/documents/{doc['id']}").status_code == 200


def test_chat_crud_and_hint_ladder_parser(client: TestClient):
    chat_resp = client.post(
        "/api/chats",
        json={"title": "Calculus Practice", "subject": "Math", "mode": "guide"},
    )
    assert chat_resp.status_code == 200
    cid = chat_resp.json()["id"]

    detail = client.get(f"/api/chats/{cid}")
    assert detail.status_code == 200
    assert detail.json()["title"] == "Calculus Practice"

    assert client.delete(f"/api/chats/{cid}").status_code == 200

    parsed = parse_hint_ladder("[NUDGE]Check LIATE.[/NUDGE][HINT]Let u = x.[/HINT][SCAFFOLD]Integrate dv.[/SCAFFOLD]")
    assert parsed == {
        "nudge": "Check LIATE.",
        "hint": "Let u = x.",
        "scaffold": "Integrate dv.",
    }
    # Tolerate missing closing slash ([NUDGE]...[NUDGE]) emitted by local models
    malformed = parse_hint_ladder("Sure!\n[NUDGE]\nCan you give an example?\n[NUDGE]")
    assert malformed == {"nudge": "Can you give an example?", "hint": "", "scaffold": ""}


def test_analytics_endpoint(client: TestClient):
    resp = client.get("/api/analytics")
    assert resp.status_code == 200
    data = resp.json()
    assert "totals" in data
    assert len(data["weekly_rhythm"]) == 7


def test_settings_and_bangla_sanitizer(client: TestClient):
    assert clean_bangla_text("সব্ে জানা যুুউব") == "সবে জানা যুউব"
    for valid_bn in ("বাংলা", "ইংরেজি", "হ্যাঁ", "চাঁদ", "দুঃখ", "অংশ", "ব্যাংক"):
        assert clean_bangla_text(valid_bn) == valid_bn

    save = client.post("/api/settings", json={"google_api_key": "AIzaTestKey123456"})
    assert save.status_code == 200
    assert save.json()["has_google_api_key"] is True

    models = client.get("/api/models").json()
    names = [m["name"] for m in models["installed"]]
    assert "gemini:gemini-2.5-flash" in names
    assert "qwen2.5:0.5b" not in names

    clear = client.post("/api/settings", json={"google_api_key": ""})
    assert clear.status_code == 200
    assert clear.json()["has_google_api_key"] is False

    voice = client.get("/api/voice/models")
    assert voice.status_code == 200
    assert any(m["name"] == "small" for m in voice.json()["models"])

    tts = client.get("/api/tts/models")
    assert tts.status_code == 200
    assert any(m["id"] == "facebook/mms-tts-ben" for m in tts.json()["models"])


def test_v3_academics_study_codelab_and_dedup(client: TestClient):
    # Sample university hierarchy
    sample = client.post("/api/academics/sample-setup")
    assert sample.status_code == 200
    tree = client.get("/api/academics/tree").json()
    assert len(tree["courses"]) >= 2
    course_id = tree["courses"][0]["id"]

    detail = client.get(f"/api/academics/courses/{course_id}").json()
    assert len(detail["topics"]) >= 1

    # Source code upload + SHA-256 deduplication
    py_bytes = b"def binary_search(arr, x):\n    return 0\n"
    up1 = client.post(
        "/api/documents/upload",
        files={"file": ("search.py", py_bytes, "text/x-python")},
        data={"pipeline": "ocr", "course_id": course_id},
    )
    assert up1.status_code == 200
    assert up1.json()["file_type"] == "code"

    up2 = client.post(
        "/api/documents/upload",
        files={"file": ("search.py", py_bytes, "text/x-python")},
        data={"pipeline": "ocr", "course_id": course_id},
    )
    assert up2.status_code == 200
    assert up2.json().get("duplicate") is True

    # Flashcard CRUD & SM-2 review
    fc = client.post(
        "/api/study/flashcards",
        json={"course_id": course_id, "front": "What is a deadlock?", "back": "Circular wait on resources."},
    ).json()
    rev = client.post(f"/api/study/flashcards/{fc['id']}/review", json={"quality": 5}).json()
    assert rev["repetitions"] == 1 and rev["interval_days"] == 1

    # Isolated Python sandbox execution
    run_res = client.post(
        "/api/codelab/run",
        json={"language": "python", "code": "print(sum([1, 2, 3]))"},
    )
    assert run_res.status_code == 200
    assert run_res.json()["executed"] is True
    assert run_res.json()["stdout"].strip() == "6"

    # Cleanup uploaded doc & flashcard
    client.delete(f"/api/documents/{up1.json()['id']}")
    client.delete(f"/api/study/flashcards/{fc['id']}")

    # PPTX slide + speaker notes extraction test
    import io
    import zipfile

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("ppt/slides/slide1.xml", "<p:sld xmlns:a='a' xmlns:p='p'><a:t>Intro to Deadlocks</a:t></p:sld>")
        zf.writestr("ppt/slides/slide2.xml", "<p:sld xmlns:a='a' xmlns:p='p'><a:t>Banker Algorithm Safety Check</a:t></p:sld>")
        zf.writestr("ppt/notesSlides/notesSlide2.xml", "<p:notes xmlns:a='a' xmlns:p='p'><a:t>Important for final exam</a:t></p:notes>")
    pptx_up = client.post(
        "/api/documents/upload",
        files={"file": ("os_lecture.pptx", buf.getvalue(), "application/vnd.openxmlformats-officedocument.presentationml.presentation")},
        data={"pipeline": "ocr", "course_id": course_id},
    )
    assert pptx_up.status_code == 200
    assert pptx_up.json()["file_type"] == "pptx"
    assert pptx_up.json()["page_count"] == 2
    hits = client.get("/api/documents/search", params={"q": "Banker Algorithm", "course_id": course_id}).json()
    assert hits and hits[0]["page_num"] == 2
    client.delete(f"/api/documents/{pptx_up.json()['id']}")
