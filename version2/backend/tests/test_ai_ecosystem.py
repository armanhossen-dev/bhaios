"""Tests for BhaiOS Offline Guard, Model Router, Memory Guard, OCR Preprocessing, TTS, Agent Permissions & CS Benchmarks."""

from __future__ import annotations

import os
import socket
import tempfile
import time
from pathlib import Path
from unittest.mock import AsyncMock, patch

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

_tmp = tempfile.TemporaryDirectory()
os.environ["BHAIOS_DATA_DIR"] = _tmp.name
os.environ["BHAIOS_DB_PATH"] = str(Path(_tmp.name) / "test_eco.db")
os.environ["BHAIOS_DISABLE_EMBEDDINGS"] = "1"
os.environ["BHAIOS_OFFLINE_MODE"] = "1"

from version2.backend.core.offline_guard import (  # noqa: E402
    allow_install_network,
    clear_blocked_network_log,
    get_blocked_network_log,
    install_offline_socket_guard,
)
from version2.backend.db import init_db  # noqa: E402
from version2.backend.main import app  # noqa: E402
from version2.backend.services.model_manager import (  # noqa: E402
    check_model_compatibility,
    ensure_single_primary_llm,
)
from version2.backend.services.model_router import route_model  # noqa: E402
from version2.backend.services.ocr_pipeline import preprocess_image_for_ocr, run_ocr_on_bytes  # noqa: E402
from version2.backend.services.tts_engine import _apply_speed  # noqa: E402


@pytest.fixture(scope="module")
def client():
    install_offline_socket_guard()
    init_db()
    with TestClient(app) as c:
        yield c


def test_offline_socket_guard_blocks_external_hosts(client: TestClient):
    clear_blocked_network_log()
    with pytest.raises(ConnectionRefusedError):
        socket.create_connection(("api.openai.com", 443), timeout=1)
    log = get_blocked_network_log()
    assert any(entry["host"] == "api.openai.com" for entry in log)

    # Install context temporarily permits network
    with allow_install_network():
        assert len(get_blocked_network_log()) >= 1


def test_apple_silicon_16gb_model_compatibility():
    ok_qwen = check_model_compatibility("qwen3.5:4b", total_ram_gb=16.0, free_disk_gb=20.0)
    assert ok_qwen["compatible"] is True

    too_big = check_model_compatibility("nemotron-30b", total_ram_gb=16.0, free_disk_gb=50.0)
    assert too_big["compatible"] is False
    assert too_big["warnings"]


@pytest.mark.asyncio
async def test_intelligent_model_router_complexity_and_fallback():
    mock_tags = [{"name": "qwen3.5:4b"}, {"name": "qwen2.5:0.5b"}]  # nemotron not installed
    with patch("version2.backend.services.model_router.get_ollama_state", new=AsyncMock(return_value=(True, mock_tags, []))):
        # Simple question must stay on Qwen (never jump to Nemotron just because "code" or "math" is mentioned)
        simple = await route_model(user_text="What is Big-O notation?", intelligence_mode="auto")
        assert simple.selected_model == "qwen3.5:4b"
        assert simple.complexity in ("low", "medium")

        # Complex debugging/proof triggers Nemotron intent, then gracefully falls back to qwen3.5:4b when Nemotron isn't installed
        complex_r = await route_model(
            user_text="Prove the time complexity of Dijkstra's algorithm and debug this deadlock race condition:\n```c\nint main(){}\n```",
            intelligence_mode="auto",
        )
        assert complex_r.complexity == "high"
        assert complex_r.fallback_used is True
        assert complex_r.selected_model == "qwen3.5:4b"

        # Lightweight mode picks 0.5B
        lite = await route_model(user_text="Classify this note", intelligence_mode="lightweight")
        assert lite.selected_model == "qwen2.5:0.5b"


@pytest.mark.asyncio
async def test_single_primary_llm_unloads_previous_model():
    with (
        patch("version2.backend.services.model_manager.get_ollama_state", new=AsyncMock(return_value=(True, [], [{"name": "nemotron-3-nano:4b"}]))),
        patch("version2.backend.services.model_manager.unload_ollama_model", new=AsyncMock(return_value=True)) as mock_unload,
    ):
        unloaded = await ensure_single_primary_llm("qwen3.5:4b")
        assert unloaded == ["nemotron-3-nano:4b"]
        mock_unload.assert_awaited_once_with("nemotron-3-nano:4b")


def test_ocr_preprocessing_and_tts_speed():
    img = np.full((120, 300, 3), 255, dtype=np.uint8)
    cv2.putText(img, "CSE-301", (20, 70), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 0), 2)
    _, png = cv2.imencode(".png", img)

    prep = preprocess_image_for_ocr(png.tobytes())
    assert prep is not None and prep.shape[1] >= 300

    ocr_res = run_ocr_on_bytes(png.tobytes(), lang="ben+eng")
    assert "preprocessed" in ocr_res and ocr_res["preprocessed"] is True

    # TTS speed resampling
    wave = np.sin(np.linspace(0, 10, 1600)).astype(np.float32)
    faster, sr = _apply_speed(wave, 16000, 1.5)
    assert sr == 16000 and len(faster) < len(wave)


def test_agent_permissions_path_containment_and_audit_log(client: TestClient):
    # Outside approved workspace rejected with 403
    bad = client.post(
        "/api/bhai/agent/approvals",
        json={"action": "delete_file", "target_path": "/etc/passwd"},
    )
    assert bad.status_code == 403

    # Inside DATA_DIR creates pending approval, executes only when approved
    target = str(Path(_tmp.name) / "agent_note.txt")
    req = client.post(
        "/api/bhai/agent/approvals",
        json={"action": "write_file", "target_path": target, "details": "OS Deadlock summary"},
    )
    assert req.status_code == 200
    aid = req.json()["id"]
    assert not Path(target).exists()

    dec = client.post(f"/api/bhai/agent/approvals/{aid}", json={"approve": True})
    assert dec.status_code == 200
    assert dec.json()["status"] == "approved"
    assert Path(target).read_text(encoding="utf-8") == "OS Deadlock summary"

    logs = client.get("/api/bhai/agent/audit-log").json()
    assert len(logs) >= 2


@pytest.mark.asyncio
async def test_cs_university_benchmark_router_latency():
    prompts = [
        ("What is virtual memory?", "en"),
        ("বাংলায় CPU scheduling বুঝিয়ে দাও", "bn"),
        ("Prove Master Theorem Case 2 and analyze merge sort recurrence", "en"),
        ("Debug this segmentation fault in C linked list:\n```c\nNode* head = NULL;\n```", "en"),
        ("ভাই deadlock-এর Coffman conditions গুলো বলো", "bn"),
    ]
    mock_tags = [{"name": "qwen3.5:4b"}, {"name": "nemotron-3-nano:4b"}]
    with patch("version2.backend.services.model_router.get_ollama_state", new=AsyncMock(return_value=(True, mock_tags, []))):
        t0 = time.perf_counter()
        decisions = [await route_model(user_text=p, ui_language=lang) for p, lang in prompts]
        elapsed_ms = (time.perf_counter() - t0) * 1000
    assert elapsed_ms < 500
    assert decisions[0].selected_model == "qwen3.5:4b"
    assert decisions[1].language in ("bn", "banglish")
    assert decisions[2].selected_model == "nemotron-3-nano:4b"
    assert decisions[3].selected_model == "nemotron-3-nano:4b"
    assert decisions[4].selected_model == "qwen3.5:4b"
