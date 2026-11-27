"""Structured data adapters: XLSX (openpyxl), CSV, XML, TXT, MD, RTF."""

from __future__ import annotations

import csv
import io
from pathlib import Path

from ...rag import clean_bangla_text
from .base import IngestResult, NormalizedChunk


def parse_data_or_text(
    doc_id: str,
    file_path: Path,
    raw_bytes: bytes,
    original_name: str,
    course_id: str | None = None,
) -> IngestResult:
    ext = Path(original_name).suffix.lower()

    if ext == ".xlsx":
        import openpyxl

        wb = openpyxl.load_workbook(str(file_path), data_only=True, read_only=True)
        chunks: list[NormalizedChunk] = []
        for idx, sheet in enumerate(wb.worksheets, start=1):
            rows_txt: list[str] = [f"[Sheet: {sheet.title}]"]
            tbl: list[list[str]] = []
            for row in sheet.iter_rows(values_only=True):
                cells = [str(c).strip() if c is not None else "" for c in row]
                if any(cells):
                    tbl.append(cells)
                    rows_txt.append(" | ".join(cells))
                if len(tbl) >= 300:
                    break
            txt = clean_bangla_text("\n".join(rows_txt))
            if txt:
                chunks.append(
                    NormalizedChunk(
                        document_id=doc_id,
                        filename=original_name,
                        file_type="xlsx",
                        course_id=course_id,
                        page_number=idx,
                        content_type="table",
                        extracted_text=txt,
                        tables=[tbl],
                        metadata={"sheet": sheet.title},
                        source_location=f"Sheet {sheet.title}",
                    )
                )
        wb.close()
        if not chunks:
            chunks.append(
                NormalizedChunk(
                    document_id=doc_id,
                    filename=original_name,
                    file_type="xlsx",
                    course_id=course_id,
                    page_number=1,
                    content_type="table",
                    extracted_text=f"[Empty XLSX workbook: {original_name}]",
                    source_location="Sheet 1",
                )
            )
        return IngestResult(
            file_type="xlsx",
            page_count=len(chunks),
            summary=chunks[0].extracted_text[:240],
            chunks=chunks,
        )

    if ext == ".csv":
        decoded = raw_bytes.decode("utf-8", errors="ignore")
        reader = csv.reader(io.StringIO(decoded))
        lines = []
        tbl = []
        for row in reader:
            if any(cell.strip() for cell in row):
                tbl.append(row)
                lines.append(" | ".join(c.strip() for c in row))
            if len(lines) >= 400:
                break
        txt = clean_bangla_text("\n".join(lines)) or f"[CSV: {original_name}]"
        return IngestResult(
            file_type="data",
            page_count=1,
            summary=txt[:240],
            chunks=[
                NormalizedChunk(
                    document_id=doc_id,
                    filename=original_name,
                    file_type="data",
                    course_id=course_id,
                    page_number=1,
                    content_type="table",
                    extracted_text=txt,
                    tables=[tbl],
                    source_location="Table 1",
                )
            ],
        )

    text_content = clean_bangla_text(raw_bytes.decode("utf-8", errors="ignore")) or f"[Document: {original_name}]"
    file_type = "data" if ext == ".xml" else "document"
    return IngestResult(
        file_type=file_type,
        page_count=1,
        summary=text_content[:240],
        chunks=[
            NormalizedChunk(
                document_id=doc_id,
                filename=original_name,
                file_type=file_type,
                course_id=course_id,
                page_number=1,
                content_type="text",
                extracted_text=text_content,
                source_location="Page 1",
            )
        ],
    )
