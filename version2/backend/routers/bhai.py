"""Bhai Academic Guide Agent API router: Weak topics, Roadmap, Revision Scheduler & Agent Audit."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import DEFAULT_QWEN_MODEL
from ..services.agent_tools import (
    list_audit_log,
    list_pending_approvals,
    request_file_permission,
    resolve_file_permission,
)
from ..services.bhai_agent import (
    build_revision_schedule,
    detect_weak_topics,
    generate_course_roadmap,
)

router = APIRouter(prefix="/api/bhai", tags=["bhai-agent"])


class RoadmapRequest(BaseModel):
    course_id: str
    model: str = DEFAULT_QWEN_MODEL
    language: str = "en"


class RevisionScheduleRequest(BaseModel):
    course_id: str
    hours_per_day: float = 2.0
    days_ahead: int = 7
    save_tasks: bool = False


class FilePermissionRequest(BaseModel):
    action: str  # write_file | delete_file
    target_path: str
    details: str = ""


class ApprovalDecisionRequest(BaseModel):
    approve: bool


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


@router.get("/agent/audit-log")
def get_agent_audit_log() -> list[dict]:
    return list_audit_log()


@router.get("/agent/approvals")
def get_agent_approvals() -> list[dict]:
    return list_pending_approvals()


@router.post("/agent/approvals")
def create_agent_approval(req: FilePermissionRequest) -> dict:
    try:
        return request_file_permission(req.action, req.target_path, req.details)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.post("/agent/approvals/{approval_id}")
def decide_agent_approval(approval_id: str, req: ApprovalDecisionRequest) -> dict:
    try:
        return resolve_file_permission(approval_id, req.approve)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
