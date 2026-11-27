"""Archive adapter: safe ZIP inspection & nested file extraction."""

from __future__ import annotations

from ...core.security import extract_zip_safely
from .base import IngestResult, NormalizedChunk


def parse_zip_manifest(
    doc_id: str,
    zip_bytes: bytes,
    original_name: str,
    course_id: str | None = None,
) -> IngestResult:
    entries = extract_zip_safely(zip_bytes)
    manifest = "\n".join(f"- {name} ({len(data)} bytes)" for name, data in entries) or "Empty archive"
    chunk = NormalizedChunk(
        document_id=doc_id,
        filename=original_name,
        file_type="zip",
        course_id=course_id,
        page_number=1,
        content_type="archive",
        extracted_text=f"[ZIP Archive: {original_name} · {len(entries)} files]\n{manifest}",
        metadata={"file_count": len(entries)},
        source_location="Archive Manifest",
    )
    return IngestResult(
        file_type="zip",
        page_count=1,
        summary=f"ZIP archive ({len(entries)} extracted files)",
        chunks=[chunk],
        archive_children=entries,
    )
