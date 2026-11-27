"""Office document adapters using python-pptx (slides, tables, speaker notes) & python-docx."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from ...rag import clean_bangla_text
from .base import IngestResult, NormalizedChunk


def parse_pptx(
    doc_id: str,
    file_path: Path,
    original_name: str,
    course_id: str | None = None,
) -> IngestResult:
    chunks: list[NormalizedChunk] = []

    try:
        from pptx import Presentation

        prs = Presentation(str(file_path))
        for idx, slide in enumerate(prs.slides, start=1):
            parts: list[str] = []
            tables_out: list[list[list[str]]] = []
            title_txt = slide.shapes.title.text.strip() if slide.shapes.title and slide.shapes.title.text else ""
            if title_txt:
                parts.append(title_txt)

            for shape in slide.shapes:
                if shape.has_text_frame:
                    t = "\n".join(p.text.strip() for p in shape.text_frame.paragraphs if p.text.strip())
                    if t and t != title_txt:
                        parts.append(t)
                if shape.has_table:
                    tbl_rows: list[list[str]] = []
                    for row in shape.table.rows:
                        cells = [c.text.strip() for c in row.cells]
                        tbl_rows.append(cells)
                        parts.append(" | ".join(cells))
                    tables_out.append(tbl_rows)

            if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
                notes = slide.notes_slide.notes_text_frame.text.strip()
                if notes:
                    parts.append(f"[Speaker Notes] {notes}")

            slide_txt = clean_bangla_text("\n".join(parts))
            if slide_txt:
                chunks.append(
                    NormalizedChunk(
                        document_id=doc_id,
                        filename=original_name,
                        file_type="pptx",
                        course_id=course_id,
                        page_number=idx,
                        slide_number=idx,
                        content_type="slide",
                        extracted_text=f"[Slide {idx}] {slide_txt}",
                        tables=tables_out,
                        metadata={"title": title_txt},
                        source_location=f"Slide {idx}",
                    )
                )
    except Exception:
        # Minimal XML zip fallback for lightweight/synthetic PPTX files
        with zipfile.ZipFile(str(file_path)) as zf:
            slide_names = sorted(
                [n for n in zf.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", n)],
                key=lambda s: int(re.findall(r"\d+", s)[-1]),
            )
            for idx, sname in enumerate(slide_names, start=1):
                root = ET.fromstring(zf.read(sname))
                texts = [el.text.strip() for el in root.iter() if el.tag.endswith("}t") and el.text and el.text.strip()]
                notes_name = f"ppt/notesSlides/notesSlide{idx}.xml"
                if notes_name in zf.namelist():
                    nroot = ET.fromstring(zf.read(notes_name))
                    ntexts = [el.text.strip() for el in nroot.iter() if el.tag.endswith("}t") and el.text and el.text.strip()]
                    if ntexts:
                        texts.append("[Speaker Notes] " + " ".join(ntexts))
                slide_txt = clean_bangla_text(" ".join(texts))
                if slide_txt:
                    chunks.append(
                        NormalizedChunk(
                            document_id=doc_id,
                            filename=original_name,
                            file_type="pptx",
                            course_id=course_id,
                            page_number=idx,
                            slide_number=idx,
                            content_type="slide",
                            extracted_text=f"[Slide {idx}] {slide_txt}",
                            source_location=f"Slide {idx}",
                        )
                    )

    if not chunks:
        chunks.append(
            NormalizedChunk(
                document_id=doc_id,
                filename=original_name,
                file_type="pptx",
                course_id=course_id,
                page_number=1,
                slide_number=1,
                content_type="slide",
                extracted_text=f"[PPTX: {original_name}]",
                source_location="Slide 1",
            )
        )

    return IngestResult(
        file_type="pptx",
        page_count=len(chunks),
        summary=chunks[0].extracted_text[:240],
        chunks=chunks,
    )


def parse_docx(
    doc_id: str,
    file_path: Path,
    original_name: str,
    course_id: str | None = None,
) -> IngestResult:
    import docx

    d_obj = docx.Document(str(file_path))
    blocks = [p.text.strip() for p in d_obj.paragraphs if p.text.strip()]
    tables_out: list[list[list[str]]] = []
    for tbl in d_obj.tables:
        t_rows = []
        for row in tbl.rows:
            cells = [cell.text.strip() for cell in row.cells]
            t_rows.append(cells)
            blocks.append(" | ".join(cells))
        tables_out.append(t_rows)

    full = clean_bangla_text("\n".join(blocks)) or f"[DOCX: {original_name}]"
    chunk = NormalizedChunk(
        document_id=doc_id,
        filename=original_name,
        file_type="docx",
        course_id=course_id,
        page_number=1,
        content_type="text",
        extracted_text=full,
        tables=tables_out,
        source_location="Page 1",
    )
    return IngestResult(
        file_type="docx",
        page_count=1,
        summary=full[:240],
        chunks=[chunk],
    )
