"""Base NormalizedChunk and IngestResult structures for BhaiOS v3 ingestion adapters."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class NormalizedChunk:
    document_id: str
    filename: str
    file_type: str
    course_id: str | None = None
    page_number: int = 1
    slide_number: int | None = None
    content_type: str = "text"
    extracted_text: str = ""
    tables: list[Any] = field(default_factory=list)
    equations: list[str] = field(default_factory=list)
    image_references: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    source_location: str = "Page 1"


@dataclass
class ExtractedAsset:
    page_number: int
    asset_type: str  # 'image' | 'qr' | 'diagram' | 'equation'
    extracted_payload: str
    file_path: str | None = None


@dataclass
class IngestResult:
    file_type: str
    page_count: int
    summary: str
    chunks: list[NormalizedChunk] = field(default_factory=list)
    assets: list[ExtractedAsset] = field(default_factory=list)
    archive_children: list[tuple[str, bytes]] = field(default_factory=list)
