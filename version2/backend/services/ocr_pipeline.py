"""Offline OCR Pipeline with OpenCV preprocessing (deskew, denoise, contrast, upscale, rotation) & Tesseract."""

from __future__ import annotations

import io
import shutil
from typing import Any

import numpy as np


def tesseract_available() -> bool:
    return bool(shutil.which("tesseract"))


def preprocess_image_for_ocr(image_bytes: bytes) -> np.ndarray | None:
    """Apply grayscale, upscale, denoise, CLAHE contrast enhancement, and deskew via OpenCV."""
    try:
        import cv2

        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return None

        # Upscale small screenshots (< 1000px wide) for sharper glyph recognition
        h, w = img.shape[:2]
        if w < 1000:
            scale = min(2.5, 1200.0 / max(1, w))
            img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # Noise removal
        denoised = cv2.fastNlMeansDenoising(gray, None, h=8, templateWindowSize=7, searchWindowSize=21)
        # Contrast enhancement (CLAHE)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(denoised)

        # Deskew using minimum-area bounding box of foreground pixels
        coords = np.column_stack(np.where(enhanced < 200))
        if len(coords) > 50:
            angle = cv2.minAreaRect(coords)[-1]
            if angle < -45:
                angle = -(90 + angle)
            else:
                angle = -angle
            if 0.5 < abs(angle) < 15.0:
                (ch, cw) = enhanced.shape[:2]
                mat = cv2.getRotationMatrix2D((cw // 2, ch // 2), angle, 1.0)
                enhanced = cv2.warpAffine(
                    enhanced, mat, (cw, ch), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
                )
        return enhanced
    except Exception:
        return None


def run_ocr_on_bytes(image_bytes: bytes, lang: str = "ben+eng") -> dict[str, Any]:
    """Run offline OpenCV preprocessing + Tesseract OCR. Honest fallback when Tesseract is absent."""
    preprocessed = preprocess_image_for_ocr(image_bytes)
    if not tesseract_available():
        return {
            "ok": False,
            "engine": "unavailable",
            "text": "",
            "preprocessed": preprocessed is not None,
            "note": "Tesseract OCR binary not installed (run `brew install tesseract tesseract-lang` for ben+eng offline OCR). Note: Tesseract is intended for printed text; use Qwen Vision or a handwriting adapter for handwritten notes.",
        }
    try:
        import cv2
        import pytesseract
        from PIL import Image

        if preprocessed is not None:
            _, png = cv2.imencode(".png", preprocessed)
            pil_img = Image.open(io.BytesIO(png.tobytes()))
        else:
            pil_img = Image.open(io.BytesIO(image_bytes))

        text = pytesseract.image_to_string(pil_img, lang=lang) or ""
        return {
            "ok": True,
            "engine": f"tesseract ({lang})",
            "text": text.strip(),
            "preprocessed": preprocessed is not None,
        }
    except Exception as exc:
        return {
            "ok": False,
            "engine": "tesseract-error",
            "text": "",
            "preprocessed": preprocessed is not None,
            "note": str(exc),
        }
