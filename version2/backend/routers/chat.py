"""100% Offline Chat sessions, Intelligent Model Router, streaming Socratic inference & RAG citations."""

from __future__ import annotations

import json
import re
import time
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..config import DEFAULT_QWEN_MODEL
from ..db import db_session, get_setting, new_id, row_to_dict
from ..ollama_client import parse_hint_ladder, strip_hint_tags
from ..rag import clean_bangla_text, retrieve_relevant_chunks
from ..services.bhai_agent import (
    build_bhai_system_prompt,
    load_student_course_context,
    stream_with_fallback,
)
from ..services.model_router import route_model

router = APIRouter(prefix="/api", tags=["chat"])

SUBJECT_KEYWORDS = {
    "Physics": ["newton", "force", "velocity", "projectile", "momentum", "gravity", "optics", "circuit", "বল", "বেগ", "ত্বরণ", "পদার্থ"],
    "Chemistry": ["mole", "acid", "base", "equilibrium", "enthalpy", "gibbs", "organic", "bond", "রসায়ন", "অম্ল", "ক্ষার"],
    "Math": ["integral", "derivative", "calculus", "matrix", "vector", "trigonometry", "limit", "probability", "সমাকলন", "অন্তরীকরণ", "গণিত"],
    "Biology": ["cell", "dna", "rna", "mitosis", "enzyme", "photosynthesis", "genetics", "কোষ", "জীববিজ্ঞান"],
    "ICT": ["boolean", "logic gate", "binary", "html", "sql", "algorithm", "network", "আইসিটি"],
    "Bangla": ["সমাস", "সন্ধি", "কারক", "বিভক্তি", "বাংলা", "ব্যাকরণ"],
    "English": ["grammar", "tense", "clause", "essay", "modifier", "narration", "preposition"],
}


def detect_subject(text: str) -> str:
    lower = text.lower()
    for subject, keywords in SUBJECT_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return subject
    return "General"


class CreateChatRequest(BaseModel):
    title: str = "New Study Session"
    subject: str = "General"
    mode: str = "guide"
    model: str = DEFAULT_QWEN_MODEL


class ChatStreamRequest(BaseModel):
    chat_id: str | None = None
    message: str
    mode: str = "guide"
    model: str = DEFAULT_QWEN_MODEL
    intelligence_mode: str | None = None  # auto | qwen | nemotron | lightweight
    vision_model: str = DEFAULT_QWEN_MODEL
    image_base64: str | None = None
    doc_id: str | None = None
    course_id: str | None = None
    agent_mode: str = "tutor"
    answer_policy: str = "balanced"
    language: str = "en"
    show_thinking: bool = False


class TruncateRequest(BaseModel):
    message_id: str


class SuggestRequest(BaseModel):
    language: str = "en"
    subject: str | None = None


@router.get("/chats")
def list_chats() -> list[dict]:
    with db_session() as conn:
        rows = conn.execute(
            """
            SELECT c.*, COUNT(m.id) AS message_count, COALESCE(SUM(m.tokens), 0) AS total_tokens
            FROM chats c
            LEFT JOIN messages m ON m.chat_id = c.id
            GROUP BY c.id
            ORDER BY c.updated_at DESC
            """
        ).fetchall()
    return [row_to_dict(r) for r in rows if r]


@router.post("/chats")
def create_chat(req: CreateChatRequest) -> dict:
    chat_id = new_id("chat")
    now = time.time()
    with db_session() as conn:
        conn.execute(
            """
            INSERT INTO chats (id, title, subject, mode, model, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (chat_id, req.title, req.subject, req.mode, req.model, now, now),
        )
        row = conn.execute("SELECT * FROM chats WHERE id = ?", (chat_id,)).fetchone()
    return row_to_dict(row) or {}


@router.get("/chats/{chat_id}")
def get_chat(chat_id: str) -> dict:
    with db_session() as conn:
        chat_row = conn.execute("SELECT * FROM chats WHERE id = ?", (chat_id,)).fetchone()
        if not chat_row:
            raise HTTPException(status_code=404, detail="Chat not found")
        msg_rows = conn.execute(
            "SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC", (chat_id,)
        ).fetchall()
    chat = row_to_dict(chat_row) or {}
    chat["messages"] = [row_to_dict(m) for m in msg_rows if m]
    return chat


@router.delete("/chats/{chat_id}")
def delete_chat(chat_id: str) -> dict:
    with db_session() as conn:
        cur = conn.execute("DELETE FROM chats WHERE id = ?", (chat_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Chat not found")
    return {"deleted": chat_id}


@router.post("/chats/{chat_id}/truncate")
def truncate_chat_from_message(chat_id: str, req: TruncateRequest) -> dict:
    with db_session() as conn:
        target = conn.execute(
            "SELECT created_at FROM messages WHERE id = ? AND chat_id = ?",
            (req.message_id, chat_id),
        ).fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="Message not found")
        conn.execute(
            "DELETE FROM messages WHERE chat_id = ? AND created_at >= ?",
            (chat_id, target["created_at"]),
        )
    return {"truncated": True}


@router.post("/suggest")
def get_suggestions(req: SuggestRequest) -> dict:
    if req.language == "bn":
        chips = [
            "আংশিক সমাকলন (Integration by Parts) ধাপে ধাপে বোঝাও",
            "নিউটনের দ্বিতীয় সূত্রের একটি সমস্যা সমাধান করতে সাহায্য করো",
            "গিবস মুক্ত শক্তি (ΔG) কীভাবে স্বতঃস্ফূর্ততা নির্ধারণ করে?",
            "আমার আপলোড করা নোট থেকে একটি কুইজ তৈরি করো",
        ]
    else:
        chips = [
            "Guide me through Integration by Parts using LIATE",
            "Help me solve a projectile motion problem step-by-step",
            "Explain De Morgan's Theorems with a truth table",
            "Quiz me on my uploaded study notes",
        ]
    return {"suggestions": chips}


@router.post("/chat")
async def stream_chat(req: ChatStreamRequest) -> StreamingResponse:
    now = time.time()
    user_text = clean_bangla_text(req.message)
    if not user_text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    chunks = retrieve_relevant_chunks(user_text, top_k=4, doc_id=req.doc_id, course_id=req.course_id)
    citations = [
        {"doc_id": c["doc_id"], "filename": c["filename"], "page_num": c["page_num"], "score": c["score"]}
        for c in chunks
    ]

    intel_mode = req.intelligence_mode or get_setting("ai_intelligence_mode", "auto")
    routing = await route_model(
        user_text=user_text,
        intelligence_mode=intel_mode,
        preferred_model=req.model,
        ui_language=req.language,
        agent_mode=req.agent_mode,
        has_image=bool(req.image_base64),
        has_docs=bool(chunks),
    )

    chat_id = req.chat_id
    with db_session() as conn:
        if not chat_id:
            chat_id = new_id("chat")
            title = re.sub(r"\s+", " ", user_text)[:48]
            subject = detect_subject(user_text)
            conn.execute(
                """
                INSERT INTO chats (id, title, subject, mode, model, created_at, updated_at, course_id, agent_mode, answer_policy)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (chat_id, title, subject, req.mode, routing.selected_model, now, now, req.course_id, req.agent_mode, req.answer_policy),
            )
        else:
            existing = conn.execute("SELECT id FROM chats WHERE id = ?", (chat_id,)).fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="Chat not found")
            conn.execute(
                "UPDATE chats SET mode = ?, model = ?, agent_mode = ?, answer_policy = ?, updated_at = ? WHERE id = ?",
                (req.mode, routing.selected_model, req.agent_mode, req.answer_policy, now, chat_id),
            )

        course_ctx = load_student_course_context(req.course_id)
        user_msg_id = new_id("msg")
        conn.execute(
            """
            INSERT INTO messages (id, chat_id, role, content, citations_json, tokens, created_at)
            VALUES (?, ?, 'user', ?, '[]', 0, ?)
            """,
            (user_msg_id, chat_id, user_text, now),
        )
        history_rows = conn.execute(
            "SELECT role, content FROM messages WHERE chat_id = ? ORDER BY created_at ASC",
            (chat_id,),
        ).fetchall()

    if req.answer_policy == "source_only" and not chunks and not req.image_base64:
        refusal = (
            "আপনার আপলোড করা কোর্স নোট বা ডকুমেন্টে এই প্রশ্নের পর্যাপ্ত তথ্য পাওয়া যায়নি। অনুগ্রহ করে সংশ্লিষ্ট নোট আপলোড করুন অথবা Balanced মোডে চেষ্টা করুন।"
            if req.language == "bn"
            else "Your uploaded course materials do not contain sufficient information to answer this in **Source-Only** mode. Upload relevant notes or switch to **Balanced** mode."
        )
        asst_id = new_id("msg")
        done_t = time.time()
        with db_session() as conn:
            conn.execute(
                "INSERT INTO messages (id, chat_id, role, content, citations_json, tokens, created_at) VALUES (?, ?, 'assistant', ?, '[]', 0, ?)",
                (asst_id, chat_id, refusal, done_t),
            )

        async def refusal_stream():
            yield json.dumps(
                {
                    "type": "meta",
                    "chat_id": chat_id,
                    "user_message_id": user_msg_id,
                    "citations": [],
                    "routing": routing.to_dict(),
                }
            ) + "\n"
            yield json.dumps({"type": "token", "content": refusal}) + "\n"
            yield json.dumps(
                {
                    "type": "done",
                    "chat_id": chat_id,
                    "message": {
                        "id": asst_id,
                        "chat_id": chat_id,
                        "role": "assistant",
                        "content": refusal,
                        "hints": None,
                        "citations": [],
                        "tokens": 0,
                        "created_at": done_t,
                    },
                }
            ) + "\n"

        return StreamingResponse(refusal_stream(), media_type="application/x-ndjson")

    sys_prompt = build_bhai_system_prompt(
        mode=req.mode,
        user_text=user_text,
        ui_language=req.language,
        agent_mode=req.agent_mode,
        answer_policy=req.answer_policy,
        course_ctx=course_ctx or None,
        chunks=chunks,
    )

    ollama_messages: list[dict[str, Any]] = [{"role": "system", "content": sys_prompt}]
    for idx, row in enumerate(history_rows[-10:]):
        msg_obj: dict[str, Any] = {"role": row["role"], "content": row["content"]}
        if idx == len(history_rows[-10:]) - 1 and req.image_base64 and row["role"] == "user":
            msg_obj["images"] = [req.image_base64]
        ollama_messages.append(msg_obj)

    async def event_stream():
        yield json.dumps(
            {
                "type": "meta",
                "chat_id": chat_id,
                "user_message_id": user_msg_id,
                "citations": citations,
                "routing": routing.to_dict(),
            }
        ) + "\n"

        full_response = ""
        thinking_text = ""
        in_think_block = False
        total_tokens = 0
        try:
            async for chunk in stream_with_fallback(
                routing.selected_model,
                ollama_messages,
                candidates_override=routing.candidates,
                think=req.show_thinking,
            ):
                msg_chunk = chunk.get("message", {})
                think_delta = msg_chunk.get("thinking", "")
                if think_delta:
                    thinking_text += think_delta
                    yield json.dumps({"type": "thinking", "content": think_delta}) + "\n"

                delta = msg_chunk.get("content", "")
                if delta:
                    full_response += delta

                    # Parse <think>...</think> tags from streamed tokens
                    # We track whether we're inside a think block and emit
                    # the right event type for each delta.
                    buf = delta
                    while buf:
                        if not in_think_block:
                            # Look for <think> opening tag
                            open_idx = buf.lower().find("<think>")
                            if open_idx != -1:
                                # Emit any content before the tag as normal token
                                before = buf[:open_idx]
                                if before:
                                    yield json.dumps({"type": "token", "content": before}) + "\n"
                                in_think_block = True
                                buf = buf[open_idx + 7:]  # skip past <think>
                            else:
                                # No think tag in this chunk — emit as token
                                yield json.dumps({"type": "token", "content": buf}) + "\n"
                                buf = ""
                        else:
                            # Inside think block — look for </think> closing tag
                            close_idx = buf.lower().find("</think>")
                            if close_idx != -1:
                                # Emit thinking content before the closing tag
                                think_part = buf[:close_idx]
                                if think_part:
                                    thinking_text += think_part
                                    yield json.dumps({"type": "thinking", "content": think_part}) + "\n"
                                in_think_block = False
                                buf = buf[close_idx + 8:]  # skip past </think>
                            else:
                                # Still inside — all of buf is thinking
                                thinking_text += buf
                                yield json.dumps({"type": "thinking", "content": buf}) + "\n"
                                buf = ""

                if chunk.get("done"):
                    total_tokens = int(chunk.get("eval_count", 0) or 0) + int(
                        chunk.get("prompt_eval_count", 0) or 0
                    )
        except Exception as exc:
            yield json.dumps({"type": "error", "error": str(exc)}) + "\n"
            return

        # Strip <think>...</think> blocks from the display content
        stripped = re.sub(r"<think>[\s\S]*?</think>", "", full_response, flags=re.IGNORECASE).strip()
        cleaned_response = clean_bangla_text(stripped)
        hints = parse_hint_ladder(cleaned_response) if req.mode == "guide" else None
        display_content = strip_hint_tags(cleaned_response) if (req.mode != "guide" or hints is None) else cleaned_response
        asst_msg_id = new_id("msg")
        done_time = time.time()

        with db_session() as conn:
            conn.execute(
                """
                INSERT INTO messages (id, chat_id, role, content, thinking, hints_json, citations_json, tokens, created_at)
                VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?, ?)
                """,
                (
                    asst_msg_id,
                    chat_id,
                    display_content,
                    thinking_text or "",
                    json.dumps(hints) if hints else None,
                    json.dumps(citations),
                    total_tokens,
                    done_time,
                ),
            )
            conn.execute("UPDATE chats SET updated_at = ? WHERE id = ?", (done_time, chat_id))

        yield json.dumps(
            {
                "type": "done",
                "chat_id": chat_id,
                "message": {
                    "id": asst_msg_id,
                    "chat_id": chat_id,
                    "role": "assistant",
                    "content": display_content,
                    "thinking": thinking_text or "",
                    "hints": hints,
                    "citations": citations,
                    "tokens": total_tokens,
                    "created_at": done_time,
                },
            }
        ) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")
