"""Course-aware document ingestion, structure-aware chunking, and background job queue."""

from __future__ import annotations

import asyncio
import hashlib
import io
import os
import re
import time
import zipfile
from pathlib import Path
from typing import Any, Callable

import httpx
import numpy as np
from pypdf import PdfReader

from .db import Database, new_id
from .hardware import OLLAMA_BASE

SUPPORTED_EXTS = {".pdf", ".pptx", ".ppt", ".docx", ".md", ".txt", ".png", ".jpg", ".jpeg", ".epub", ".zip"}
EMBED_DIM = 256  # Deterministic local fallback dimension; Ollama embeddings stored with native dim


def detect_language(text: str) -> str:
    bn_chars = len(re.findall(r"[\u0980-\u09FF]", text))
    en_chars = len(re.findall(r"[A-Za-z]", text))
    total = bn_chars + en_chars
    if total == 0:
        return "en"
    bn_ratio = bn_chars / total
    if bn_ratio > 0.65:
        return "bn"
    if bn_ratio > 0.12:
        return "mixed"
    return "en"


def estimate_tokens(text: str) -> int:
    return max(1, int(len(text.split()) * 1.3))


def sanitize_untrusted_text(text: str) -> str:
    """Strip prompt-injection patterns embedded inside untrusted uploaded documents."""
    cleaned = re.sub(r"(?i)(ignore\s+previous\s+instructions|system\s*:\s*override|<\|im_start\|>|<\|im_end\|>)", "[redacted]", text)
    return cleaned.strip()


def compute_local_embedding(text: str, dim: int = EMBED_DIM) -> bytes:
    """Deterministic character-trigram + word-hash embedding for instant offline vector search."""
    vec = np.zeros(dim, dtype=np.float32)
    norm_text = re.sub(r"\s+", " ", text.lower()).strip()
    tokens = norm_text.split()
    for tok in tokens:
        h = int(hashlib.md5(tok.encode("utf-8")).hexdigest(), 16)
        vec[h % dim] += 1.5
    for i in range(max(0, len(norm_text) - 2)):
        tri = norm_text[i : i + 3]
        h = int(hashlib.md5(tri.encode("utf-8")).hexdigest(), 16)
        vec[h % dim] += 0.5
    norm = float(np.linalg.norm(vec))
    if norm > 0:
        vec /= norm
    return vec.tobytes()


async def compute_embedding(text: str, model: str = "local-trigram-v1") -> tuple[str, int, bytes]:
    """Use Ollama multilingual embedding model if configured & available, else local-trigram-v1."""
    if model and model != "local-trigram-v1":
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                r = await client.post(f"{OLLAMA_BASE}/api/embeddings", json={"model": model, "prompt": text[:2000]})
                if r.status_code == 200:
                    emb = r.json().get("embedding")
                    if isinstance(emb, list) and len(emb) > 0:
                        arr = np.array(emb, dtype=np.float32)
                        n = float(np.linalg.norm(arr))
                        if n > 0:
                            arr /= n
                        return model, len(arr), arr.tobytes()
        except Exception:
            pass
    return "local-trigram-v1", EMBED_DIM, compute_local_embedding(text)


def structure_aware_chunk(
    sections: list[dict[str, Any]],
    min_tokens: int = 120,
    max_tokens: int = 500,
) -> list[dict[str, Any]]:
    """
    Chunk by semantic unit (slide, page, heading block), keeping code blocks,
    LaTeX formulas, and markdown tables intact.
    """
    chunks: list[dict[str, Any]] = []
    for sec in sections:
        page = int(sec.get("page_or_slide", 1))
        title = str(sec.get("section_title", "")).strip()
        raw_text = sanitize_untrusted_text(str(sec.get("content", "")))
        if not raw_text:
            continue

        # Split on double newlines while preserving fenced code blocks and $$...$$ math blocks
        blocks: list[str] = []
        buf: list[str] = []
        in_fence = False
        for line in raw_text.splitlines():
            stripped = line.strip()
            if stripped.startswith("```") or stripped.startswith("$$"):
                in_fence = not in_fence
            buf.append(line)
            if not in_fence and stripped == "" and buf:
                block = "\n".join(buf).strip()
                if block:
                    blocks.append(block)
                buf = []
        if buf:
            block = "\n".join(buf).strip()
            if block:
                blocks.append(block)

        current: list[str] = []
        cur_tokens = 0
        for blk in blocks:
            blk_toks = estimate_tokens(blk)
            if current and cur_tokens + blk_toks > max_tokens and cur_tokens >= min_tokens:
                joined = "\n\n".join(current)
                chunks.append({
                    "page_or_slide": page,
                    "section_title": title,
                    "content": joined,
                    "token_count": estimate_tokens(joined),
                    "language": detect_language(joined),
                })
                # Keep last short block as overlap if it is not huge
                overlap = [current[-1]] if estimate_tokens(current[-1]) < 90 else []
                current = overlap + [blk]
                cur_tokens = sum(estimate_tokens(x) for x in current)
            else:
                current.append(blk)
                cur_tokens += blk_toks

        if current:
            joined = "\n\n".join(current)
            chunks.append({
                "page_or_slide": page,
                "section_title": title,
                "content": joined,
                "token_count": estimate_tokens(joined),
                "language": detect_language(joined),
            })
    return chunks


def extract_sections(file_path: Path, ext: str) -> tuple[int, list[dict[str, Any]]]:
    """Extract structured page/slide sections from PDF, PPTX, DOCX, MD, TXT, or Images."""
    ext = ext.lower()
    sections: list[dict[str, Any]] = []

    if ext == ".pdf":
        # Prefer PyMuPDF if installed, else pypdf
        try:
            import fitz  # type: ignore
            doc = fitz.open(str(file_path))
            for i, page in enumerate(doc, start=1):
                txt = page.get_text("text").strip()
                if not txt:
                    txt = f"[Scanned PDF Page {i} — ready for VLM/OCR review]"
                first_line = txt.splitlines()[0][:80] if txt else f"Page {i}"
                sections.append({"page_or_slide": i, "section_title": first_line, "content": txt})
            return len(doc), sections
        except ImportError:
            reader = PdfReader(str(file_path))
            for i, page in enumerate(reader.pages, start=1):
                txt = (page.extract_text() or "").strip()
                if not txt:
                    txt = f"[Scanned PDF Page {i} — ready for VLM/OCR review]"
                first_line = txt.splitlines()[0][:80] if txt else f"Page {i}"
                sections.append({"page_or_slide": i, "section_title": first_line, "content": txt})
            return len(reader.pages), sections

    if ext in {".pptx", ".ppt"}:
        try:
            from pptx import Presentation  # type: ignore
            prs = Presentation(str(file_path))
            for idx, slide in enumerate(prs.slides, start=1):
                title = slide.shapes.title.text.strip() if slide.shapes.title else f"Slide {idx}"
                parts = []
                for shape in slide.shapes:
                    if shape.has_text_frame:
                        t = shape.text_frame.text.strip()
                        if t and t != title:
                            parts.append(t)
                    if shape.has_table:
                        rows = [" | ".join(c.text.strip() for c in row.cells) for row in shape.table.rows]
                        parts.append("\n".join(rows))
                if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
                    notes = slide.notes_slide.notes_text_frame.text.strip()
                    if notes:
                        parts.append(f"Speaker Notes: {notes}")
                body = "\n".join(parts).strip() or f"[Visual Slide {idx}: {title}]"
                sections.append({"page_or_slide": idx, "section_title": title, "content": f"{title}\n{body}"})
            return len(prs.slides), sections
        except ImportError:
            # Fallback XML extraction from .pptx zip archive
            if zipfile.is_zipfile(file_path):
                with zipfile.ZipFile(file_path) as zf:
                    slide_files = sorted(
                        [n for n in zf.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", n)],
                        key=lambda n: int(re.findall(r"\d+", n)[-1]),
                    )
                    for idx, sname in enumerate(slide_files, start=1):
                        xml_txt = zf.read(sname).decode("utf-8", errors="ignore")
                        texts = re.findall(r"<a:t>(.*?)</a:t>", xml_txt)
                        body = " ".join(texts).strip() or f"[Slide {idx}]"
                        sections.append({"page_or_slide": idx, "section_title": f"Slide {idx}", "content": body})
                    return max(1, len(slide_files)), sections

    if ext == ".docx":
        try:
            import docx  # type: ignore
            doc = docx.Document(str(file_path))
            cur_title = file_path.stem
            cur_buf: list[str] = []
            sec_num = 1
            for para in doc.paragraphs:
                txt = para.text.strip()
                if not txt:
                    continue
                if para.style and para.style.name.startswith("Heading"):
                    if cur_buf:
                        sections.append({"page_or_slide": sec_num, "section_title": cur_title, "content": "\n".join(cur_buf)})
                        sec_num += 1
                        cur_buf = []
                    cur_title = txt
                else:
                    cur_buf.append(txt)
            if cur_buf or not sections:
                sections.append({"page_or_slide": sec_num, "section_title": cur_title, "content": "\n".join(cur_buf) or file_path.stem})
            return len(sections), sections
        except ImportError:
            if zipfile.is_zipfile(file_path):
                with zipfile.ZipFile(file_path) as zf:
                    if "word/document.xml" in zf.namelist():
                        xml_txt = zf.read("word/document.xml").decode("utf-8", errors="ignore")
                        texts = re.findall(r"<w:t[^>]*>(.*?)</w:t>", xml_txt)
                        body = " ".join(texts).strip()
                        sections.append({"page_or_slide": 1, "section_title": file_path.stem, "content": body})
                        return 1, sections

    if ext in {".md", ".txt"}:
        raw = file_path.read_text(encoding="utf-8", errors="ignore")
        # Split markdown by headings
        blocks = re.split(r"(?m)^(#{1,3}\s+.+)$", raw)
        if len(blocks) > 1:
            sec_idx = 1
            cur_h = file_path.stem
            for part in blocks:
                p = part.strip()
                if not p:
                    continue
                if re.match(r"^#{1,3}\s+", p):
                    cur_h = p.lstrip("# ").strip()
                else:
                    sections.append({"page_or_slide": sec_idx, "section_title": cur_h, "content": p})
                    sec_idx += 1
        else:
            sections.append({"page_or_slide": 1, "section_title": file_path.stem, "content": raw})
        return max(1, len(sections)), sections

    if ext in {".png", ".jpg", ".jpeg"}:
        sections.append({
            "page_or_slide": 1,
            "section_title": f"Image: {file_path.name}",
            "content": f"[Handwritten / Board Image: {file_path.name} — available for Vision Q&A and student correction]",
        })
        return 1, sections

    return 1, [{"page_or_slide": 1, "section_title": file_path.stem, "content": f"Uploaded file: {file_path.name}"}]


async def ingest_file(
    db: Database,
    file_id: str,
    job_id: str | None = None,
    on_progress: Callable[[dict[str, Any]], Any] | None = None,
) -> dict[str, Any]:
    """Parse, chunk, deduplicate, embed, and index a file into SQLite + FTS5."""
    with db.connect() as conn:
        frow = conn.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
        if not frow:
            raise FileNotFoundError(f"File {file_id} not found")
        file_rec = dict(frow)

    def update_status(status: str, progress: float, error_msg: str = "") -> None:
        now = time.time()
        with db.connect() as conn:
            conn.execute(
                "UPDATE files SET status = ?, error_msg = ? WHERE id = ?",
                (status, error_msg, file_id),
            )
            if job_id:
                conn.execute(
                    "UPDATE jobs SET status = ?, progress = ?, error_msg = ?, updated_at = ? WHERE id = ?",
                    (status, progress, error_msg, now, job_id),
                )
        if on_progress:
            try:
                res = on_progress({"job_id": job_id, "file_id": file_id, "status": status, "progress": progress, "error": error_msg})
                if asyncio.iscoroutine(res):
                    asyncio.create_task(res)
            except Exception:
                pass

    try:
        update_status("parsing", 0.25)
        fpath = Path(file_rec["storage_path"])
        page_count, raw_sections = extract_sections(fpath, file_rec["ext"])

        update_status("chunking", 0.50)
        chunks = structure_aware_chunk(raw_sections)
        embed_model_cfg = str(db.get_setting("embedding_model", "local-trigram-v1"))

        update_status("embedding", 0.75)
        now = time.time()
        seen_hashes: set[str] = set()
        inserted = 0

        with db.connect() as conn:
            # Clear prior chunks if re-indexing
            conn.execute("DELETE FROM chunks WHERE file_id = ?", (file_id,))
            conn.execute("DELETE FROM chunks_fts WHERE file_id = ?", (file_id,))
            conn.execute("UPDATE files SET page_count = ? WHERE id = ?", (page_count, file_id))

        for ch in chunks:
            ch_hash = hashlib.sha256(ch["content"].encode("utf-8")).hexdigest()[:24]
            if ch_hash in seen_hashes:
                continue
            seen_hashes.add(ch_hash)

            model_used, dim, vec_blob = await compute_embedding(ch["content"], embed_model_cfg)
            cid = new_id("chk")
            with db.connect() as conn:
                conn.execute(
                    """
                    INSERT INTO chunks (id, course_id, file_id, page_or_slide, section_title, content, chunk_hash, language, token_count, embedding_model, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        cid,
                        file_rec["course_id"],
                        file_id,
                        ch["page_or_slide"],
                        ch["section_title"],
                        ch["content"],
                        ch_hash,
                        ch["language"],
                        ch["token_count"],
                        model_used,
                        now,
                    ),
                )
                conn.execute(
                    "INSERT INTO chunks_fts (chunk_id, course_id, file_id, section_title, content) VALUES (?, ?, ?, ?, ?)",
                    (cid, file_rec["course_id"] or "", file_id, ch["section_title"], ch["content"]),
                )
                conn.execute(
                    "INSERT INTO embeddings (chunk_id, embedding_model, dim, vector_blob) VALUES (?, ?, ?, ?)",
                    (cid, model_used, dim, vec_blob),
                )
            inserted += 1

        update_status("ready", 1.0)
        return {"file_id": file_id, "pages": page_count, "chunks": inserted, "status": "ready"}
    except Exception as exc:
        update_status("error", 0.0, str(exc))
        return {"file_id": file_id, "status": "error", "error": str(exc)}
