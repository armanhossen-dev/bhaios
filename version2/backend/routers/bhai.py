"""Bhai Academic Guide Agent API router: Weak topics, Course Roadmap & Revision Scheduler."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services.bhai_agent import (
    build_revision_schedule,
    detect_weak_topics,
    generate_course_roadmap,
)

router = APIRouter(prefix="/api/bhai", tags=["bhai-agent"])


class RoadmapRequest(BaseModel):
    course_id: str
    model: str = "qwen2.5:3b"
    language: str = "en"


class RevisionScheduleRequest(BaseModel):
    course_id: str
    hours_per_day: float = 2.0
    days_ahead: int = 7
    save_tasks: bool = False


@router.get("/weak-topics/{course_id}")
def get_weak_topics(course_id: str) -> dict:
    return {"course_id": course_id, "weak_topics": detect_weak_topics(course_id)}


@router.post("/roadmap")
async def create_course_roadmap(req: RoadmapRequest) -> dict:
    try:
        return await generate_course_roadmap(req.course_id, model=req.model, ui_language=req.language)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/revision-schedule")
def create_revision_schedule(req: RevisionScheduleRequest) -> dict:
    try:
        return build_revision_schedule(
            req.course_id,
            hours_per_day=req.hours_per_day,
            days_ahead=req.days_ahead,
            save_tasks=req.save_tasks,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
