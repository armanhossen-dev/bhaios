"""Image & QR adapter: OpenCV QRCodeDetector (safe decode, no auto-open), OCR & VLM fallback."""

from __future__ import annotations

import base64
import shutil
from pathlib import Path

from ...ollama_client import inspect_image_with_vlm
from ...rag import clean_bangla_text
from .base import ExtractedAsset, IngestResult, NormalizedChunk


def decode_qr_codes(image_bytes: bytes) -> list[str]:
    """Decode QR payloads from raw image bytes using OpenCV QRCodeDetector. Never executes/opens URLs."""
    try:
        import cv2
        import numpy as np

        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return []
        detector = cv2.QRCodeDetector()
        ok, decoded_list, _, _ = detector.detectAndDecodeMulti(img)
        if ok and decoded_list:
            return [d.strip() for d in decoded_list if d and d.strip()]
        single, _, _ = detector.detectAndDecode(img)
        return [single.strip()] if single and single.strip() else []
    except Exception:
        return []


def _try_tesseract_bytes(image_bytes: bytes) -> str:
    from ..ocr_pipeline import run_ocr_on_bytes

    res = run_ocr_on_bytes(image_bytes, lang="ben+eng")
    return res.get("text", "") if res.get("ok") else ""


async def parse_image(
    doc_id: str,
    raw_bytes: bytes,
    original_name: str,
    pipeline: str = "ocr",
    vision_model: str = "llava-phi3:latest",
    course_id: str | None = None,
) -> IngestResult:
    qr_payloads = decode_qr_codes(raw_bytes)
    assets: list[ExtractedAsset] = [
        ExtractedAsset(page_number=1, asset_type="qr", extracted_payload=payload)
        for payload in qr_payloads
    ]

    extracted_parts: list[str] = []
    if qr_payloads:
        extracted_parts.append(
            "[Decoded QR Payloads — Inspect safely before opening]\n"
            + "\n".join(f"- {p}" for p in qr_payloads)
        )

    if pipeline == "vlm":
        b64 = base64.b64encode(raw_bytes).decode("utf-8")
        try:
            vlm_text = await inspect_image_with_vlm(
                vision_model,
                b64,
                "Transcribe all printed/handwritten text, equations in LaTeX ($...$), and diagram/circuit/UML labels from this study image. Preserve Bangla and English.",
            )
            cleaned = clean_bangla_text(vlm_text)
            if cleaned:
                extracted_parts.append(cleaned)
        except Exception as exc:
            extracted_parts.append(f"[VLM extraction skipped: {exc}]")
    else:
        ocr_text = clean_bangla_text(_try_tesseract_bytes(raw_bytes))
        if ocr_text:
            extracted_parts.append(ocr_text)

    if not extracted_parts:
        extracted_parts.append(
            f"[Image note uploaded: {original_name}. Use Visual Studio / VLM Vision to extract handwritten notes, equations, or diagrams.]"
        )

    full_text = "\n\n".join(extracted_parts)
    chunk = NormalizedChunk(
        document_id=doc_id,
        filename=original_name,
        file_type="image",
        course_id=course_id,
        page_number=1,
        content_type="image_qr" if qr_payloads else "image",
        extracted_text=full_text,
        image_references=[original_name],
        metadata={"qr_payloads": qr_payloads},
        source_location="Image 1",
    )
    return IngestResult(
        file_type="image",
        page_count=1,
        summary=full_text[:240],
        chunks=[chunk],
        assets=assets,
    )
