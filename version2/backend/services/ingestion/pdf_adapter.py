"""PDF ingestion adapter using PyMuPDF (fitz) with scanned-page detection & pypdf fallback."""

from __future__ import annotations

import shutil
from pathlib import Path

from ...rag import clean_bangla_text
from .base import ExtractedAsset, IngestResult, NormalizedChunk


def _try_ocr_pixmap(png_bytes: bytes) -> str:
    if not shutil.which("tesseract"):
        return ""
    try:
        import io
        import pytesseract
        from PIL import Image

        img = Image.open(io.BytesIO(png_bytes))
        return pytesseract.image_to_string(img, lang="ben+eng") or ""
    except Exception:
        return ""


def parse_pdf(
    doc_id: str,
    file_path: Path,
    original_name: str,
    course_id: str | None = None,
) -> IngestResult:
    chunks: list[NormalizedChunk] = []
    assets: list[ExtractedAsset] = []

    try:
        import pymupdf

        with pymupdf.open(str(file_path)) as doc:
            for idx, page in enumerate(doc, start=1):
                txt = clean_bangla_text(page.get_text("text") or "")
                images = page.get_images(full=True)
                img_refs = [f"page_{idx}_img_{i}" for i in range(len(images))]

                # OCR scanned pages when tesseract is available and text layer is empty
                if not txt and len(images) > 0:
                    pix = page.get_pixmap(dpi=150)
                    ocr_txt = clean_bangla_text(_try_ocr_pixmap(pix.tobytes("png")))
                    if ocr_txt:
                        txt = ocr_txt

                # Record basic table/equation markers
                equations = [ln.strip() for ln in txt.splitlines() if "=" in ln and len(ln.strip()) < 90][:8]
                if not txt and images:
                    txt = f"[Scanned PDF Page {idx}: {original_name} ({len(images)} image(s))]"

                if txt:
                    chunks.append(
                        NormalizedChunk(
                            document_id=doc_id,
                            filename=original_name,
                            file_type="pdf",
                            course_id=course_id,
                            page_number=idx,
                            content_type="text",
                            extracted_text=txt,
                            equations=equations,
                            image_references=img_refs,
                            metadata={"image_count": len(images)},
                            source_location=f"Page {idx}",
                        )
                    )
                if images:
                    assets.append(
                        ExtractedAsset(
                            page_number=idx,
                            asset_type="image",
                            extracted_payload=f"{len(images)} embedded figure(s) on Page {idx}",
                        )
                    )
    except Exception:
        # Clean pypdf fallback
        from pypdf import PdfReader

        reader = PdfReader(str(file_path))
        for idx, page in enumerate(reader.pages, start=1):
            txt = clean_bangla_text(page.extract_text() or "")
            if txt:
                chunks.append(
                    NormalizedChunk(
                        document_id=doc_id,
                        filename=original_name,
                        file_type="pdf",
                        course_id=course_id,
                        page_number=idx,
                        content_type="text",
                        extracted_text=txt,
                        source_location=f"Page {idx}",
                    )
                )

    if not chunks:
        chunks.append(
            NormalizedChunk(
                document_id=doc_id,
                filename=original_name,
                file_type="pdf",
                course_id=course_id,
                page_number=1,
                content_type="text",
                extracted_text=f"[Scanned PDF: {original_name} — inspect with Vision mode]",
                source_location="Page 1",
            )
        )

    summary = chunks[0].extracted_text[:240]
    return IngestResult(
        file_type="pdf",
        page_count=len(chunks),
        summary=summary,
        chunks=chunks,
        assets=assets,
    )
