"""BhaiOS v3 FastAPI Application Entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import FRONTEND_DIST_DIR
from .db import init_db
from .routers import (
    academics,
    analytics,
    bhai,
    chat,
    codelab,
    documents,
    health,
    knowledge_graph,
    lectures,
    models,
    resources,
    study,
    tasks,
    voice,
)
from speech_engine.api import router as speech_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="BhaiOS v3 University Intelligence Workspace", version="3.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(127\.0\.0\.1|localhost)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(academics.router)
app.include_router(bhai.router)
app.include_router(models.router)
app.include_router(voice.router)
app.include_router(documents.router)
app.include_router(tasks.router)
app.include_router(resources.router)
app.include_router(study.router)
app.include_router(codelab.router)
app.include_router(knowledge_graph.router)
app.include_router(lectures.router)
app.include_router(analytics.router)
app.include_router(chat.router)
app.include_router(speech_router)

if FRONTEND_DIST_DIR.exists():
    assets_dir = FRONTEND_DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        target = FRONTEND_DIST_DIR / full_path
        if full_path and target.is_file():
            return FileResponse(str(target))
        return FileResponse(str(FRONTEND_DIST_DIR / "index.html"))
