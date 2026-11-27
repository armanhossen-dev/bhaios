"""Intelligent AI Model Router: intent, language, complexity, RAM-aware selection & fallback."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Any, Literal

from ..config import (
    DEFAULT_LIGHTWEIGHT_MODEL,
    DEFAULT_NEMOTRON_MODEL,
    DEFAULT_QWEN_MODEL,
    WEAK_MODELS,
)
from .model_manager import get_ollama_state

IntelligenceMode = Literal["auto", "qwen", "nemotron", "lightweight"]


@dataclass
class RouteDecision:
    selected_model: str
    role: str
    intelligence_mode: str
    intent: str
    language: str
    complexity: str  # 'low' | 'medium' | 'high'
    reason: str
    fallback_used: bool
    candidates: list[str]
    activity_steps: list[str]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


_COMPLEX_MATH_PATTERNS = [
    r"\b(prove|proof|induction|derive|eigenvalue|eigenvector|laplace|fourier|taylor|differential equation|integral|convergence|matrix rank)\b",
    r"\b(recurrence|master theorem|asymptotic|big-o|np-complete|dynamic programming|dijkstra|bellman|kruskal|red-black|avl|b\+ tree)\b",
    r"\b(traceback|segmentation fault|race condition|memory leak|time complexity|space complexity|debug|refactor|optimize)\b",
    r"\b(plan|roadmap|multi-step|step-by-step architecture|compare.*tradeoffs)\b",
]

_SIMPLE_DEFINITION_PATTERNS = [
    r"^(what is|define|who is|meaning of|explain simply|সংজ্ঞা|কি|কাকে বলে)\b",
    r"(গুলো বলো|বলো|বোঝাও|বুঝিয়ে দাও|কি\??$)",
]


def detect_language(text: str, ui_language: str = "en") -> str:
    has_bn = bool(re.search(r"[\u0980-\u09FF]", text))
    has_en = bool(re.search(r"[A-Za-z]{3,}", text))
    if has_bn and has_en:
        return "banglish"
    if has_bn or ui_language == "bn":
        return "bn"
    return "en"


def evaluate_task_complexity(
    text: str,
    *,
    agent_mode: str = "tutor",
    has_code: bool = False,
) -> tuple[str, str]:
    """Return (intent, complexity) without blindly routing simple math/code mentions to Nemotron."""
    lower = text.lower().strip()
    words = len(lower.split())

    is_simple_def = any(re.search(p, lower) for p in _SIMPLE_DEFINITION_PATTERNS) and words <= 14
    has_complex_signal = any(re.search(p, lower) for p in _COMPLEX_MATH_PATTERNS)
    has_code_block = "```" in text or has_code or bool(re.search(r"\b(def |class |#include|int main|SELECT .* FROM)\b", text))

    if agent_mode in ("coding_mentor",) and (has_code_block or has_complex_signal):
        return "code_debug", "high"
    if has_code_block and ("debug" in lower or "fix" in lower or "error" in lower or words > 20):
        return "code_debug", "high"
    if has_complex_signal and not is_simple_def:
        intent = "math_cs_reasoning" if any(k in lower for k in ("prove", "integral", "matrix", "algorithm", "complexity", "deadlock")) else "planning"
        return intent, "high"
    if words <= 6 and not has_code_block:
        return "classification_or_short", "low"
    if re.search(r"\b(summarize|summary|notes|pdf|slide|chapter|document|explain)\b", lower):
        return "doc_study", "medium"
    return "general_study", "medium"


async def route_model(
    *,
    user_text: str,
    intelligence_mode: str = "auto",
    preferred_model: str | None = None,
    ui_language: str = "en",
    agent_mode: str = "tutor",
    has_image: bool = False,
    has_docs: bool = False,
    free_ram_gb: float = 10.0,
) -> RouteDecision:
    """Select the optimal local Ollama model with availability, RAM & fallback checks."""
    lang = detect_language(user_text, ui_language)
    intent, complexity = evaluate_task_complexity(user_text, agent_mode=agent_mode)
    online, tags, _ = await get_ollama_state()
    installed = [m.get("name", "") for m in tags if m.get("name")]

    mode = (intelligence_mode or "auto").lower()
    if mode not in ("auto", "qwen", "nemotron", "lightweight"):
        mode = "auto"

    # Respect explicit manual model choice unless Auto mode is active
    if preferred_model and preferred_model in installed and mode == "auto" and preferred_model not in (DEFAULT_QWEN_MODEL, DEFAULT_NEMOTRON_MODEL):
        # User manually picked another installed model in the chat selector
        pass

    desired = DEFAULT_QWEN_MODEL
    role = "Main Study Assistant (Qwen)"
    reason = "Default bilingual study & document explanation."

    if mode == "lightweight":
        desired = DEFAULT_LIGHTWEIGHT_MODEL
        role = "Lightweight Mode"
        reason = "User selected Lightweight Mode for minimal RAM."
    elif mode == "qwen":
        desired = DEFAULT_QWEN_MODEL
        role = "Main Study Assistant (Qwen)"
        reason = "User explicitly selected Qwen."
    elif mode == "nemotron":
        desired = DEFAULT_NEMOTRON_MODEL
        role = "Advanced Reasoning (Nemotron)"
        reason = "User explicitly selected Nemotron."
    else:
        # Auto intelligent routing
        if has_image:
            vision_candidates = [m for m in installed if any(v in m.lower() for v in ("vl", "llava", "vision", "qwen3.5"))]
            desired = vision_candidates[0] if vision_candidates else DEFAULT_QWEN_MODEL
            role = "Vision / Multimodal Study"
            reason = "Image input detected; routing to local vision-capable model."
        elif complexity == "high" and intent in ("code_debug", "math_cs_reasoning", "planning") and free_ram_gb >= 4.5:
            desired = DEFAULT_NEMOTRON_MODEL
            role = "Advanced Reasoning (Nemotron)"
            reason = f"High-complexity {intent} task detected with sufficient unified memory."
        else:
            desired = DEFAULT_QWEN_MODEL
            role = "Main Study Assistant (Qwen)"
            reason = (
                f"Standard {lang} study query ({intent}); Qwen handles Bangla/English & RAG efficiently."
                if not has_docs
                else "Document-grounded explanation (Qwen + Local RAG)."
            )

    # Build ordered fallback candidates strictly from local Ollama models
    non_weak_installed = [m for m in installed if m not in WEAK_MODELS]
    raw_candidates = [desired, DEFAULT_QWEN_MODEL, "qwen2.5:7b", "qwen2.5:3b"] + non_weak_installed + installed
    seen: set[str] = set()
    candidates = [m for m in raw_candidates if m and not (m in seen or seen.add(m))]

    chosen = desired
    fallback_used = False
    if online and installed:
        if desired in installed:
            chosen = desired
        else:
            avail = [m for m in candidates if m in installed]
            if avail:
                chosen = avail[0]
                fallback_used = True
                reason += f" ('{desired}' unavailable; fell back to '{chosen}')."

    steps = [
        "Understanding request",
        "Retrieving documents" if has_docs else "Checking course context",
        f"Selecting model ({chosen})",
        "Generating response",
    ]
    return RouteDecision(
        selected_model=chosen,
        role=role,
        intelligence_mode=mode,
        intent=intent,
        language=lang,
        complexity=complexity,
        reason=reason,
        fallback_used=fallback_used,
        candidates=candidates,
        activity_steps=steps,
    )
