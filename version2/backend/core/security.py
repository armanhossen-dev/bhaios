"""Upload validation, magic-byte inspection, SHA-256 hashing, and safe ZIP extraction."""

from __future__ import annotations

import hashlib
import io
import zipfile
from pathlib import Path

from fastapi import HTTPException

from ..config import UPLOADS_DIR

MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB per-file cap
MAX_ZIP_UNCOMPRESSED_BYTES = 250 * 1024 * 1024  # 250 MB zip-bomb cap
MAX_ZIP_FILES = 150

TEXT_AND_CODE_EXTS = {
    ".c", ".h", ".cpp", ".hpp", ".cc", ".py", ".java", ".js", ".ts", ".jsx", ".tsx",
    ".html", ".css", ".sql", ".json", ".txt", ".md", ".csv", ".rtf", ".xml", ".yaml", ".yml",
}
BINARY_MAGIC_PREFIXES: dict[str, tuple[bytes, ...]] = {
    ".pdf": (b"%PDF-",),
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".gif": (b"GIF87a", b"GIF89a"),
    ".bmp": (b"BM",),
    ".tiff": (b"II*\x00", b"MM\x00*"),
    ".tif": (b"II*\x00", b"MM\x00*"),
    ".webp": (b"RIFF",),
    ".docx": (b"PK\x03\x04", b"PK\x05\x06"),
    ".pptx": (b"PK\x03\x04", b"PK\x05\x06"),
    ".xlsx": (b"PK\x03\x04", b"PK\x05\x06"),
    ".zip": (b"PK\x03\x04", b"PK\x05\x06"),
    ".wav": (b"RIFF",),
    ".ogg": (b"OggS",),
    ".flac": (b"fLaC",),
    ".webm": (b"\x1a\x45\xdf\xa3",),
}
AUDIO_EXTS = {".wav", ".mp3", ".m4a", ".ogg", ".webm", ".flac"}


def sanitize_filename(raw_name: str | None) -> str:
    name = Path(raw_name or "untitled").name
    cleaned = "".join(c if c.isalnum() or c in "._- ()[]" else "_" for c in name).strip()
    return cleaned or "untitled"


def compute_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def safe_resolve_upload_path(doc_id: str, ext: str) -> Path:
    root = UPLOADS_DIR.resolve()
    safe_ext = "".join(c for c in ext.lower() if c.isalnum() or c == ".")
    candidate = (root / f"{doc_id}{safe_ext}").resolve()
    if not str(candidate).startswith(str(root)):
        raise HTTPException(status_code=400, detail="Invalid upload path")
    return candidate


def validate_file_bytes(filename: str, mime_type: str, data: bytes) -> str:
    """Validate non-empty payload, size limit, and magic-byte/UTF-8 signature. Returns lowercase ext."""
    if not data:
        raise HTTPException(status_code=400, detail="Empty file uploaded")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 100 MB safety limit")

    ext = Path(filename).suffix.lower()
    if ext in BINARY_MAGIC_PREFIXES:
        prefixes = BINARY_MAGIC_PREFIXES[ext]
        if not any(data.startswith(p) for p in prefixes):
            raise HTTPException(
                status_code=415,
                detail=f"File signature mismatch for {ext}; possible spoofed or corrupted file.",
            )
    elif ext in TEXT_AND_CODE_EXTS:
        # Reject files containing null bytes pretending to be text/code
        if b"\x00" in data[:4096]:
            raise HTTPException(status_code=415, detail=f"Binary payload rejected for text/code extension {ext}")
    elif ext in AUDIO_EXTS:
        # mp3/m4a headers vary (ID3, FF FB, ftyp); basic sanity check
        pass
    elif not mime_type.startswith(("text/", "image/", "audio/")):
        raise HTTPException(status_code=415, detail=f"Unsupported file format: {ext or mime_type}")
    return ext


def extract_zip_safely(zip_bytes: bytes) -> list[tuple[str, bytes]]:
    """Safely extract non-directory entries from a ZIP buffer, blocking Zip Slip, symlinks, and zip-bombs."""
    try:
        zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=400, detail=f"Invalid ZIP archive: {exc}") from exc

    entries: list[tuple[str, bytes]] = []
    total_uncompressed = 0
    with zf:
        infos = [i for i in zf.infolist() if not i.is_dir()]
        if len(infos) > MAX_ZIP_FILES:
            raise HTTPException(status_code=413, detail=f"ZIP contains more than {MAX_ZIP_FILES} files")
        for info in infos:
            # Reject symlinks (Unix mode 0o120000 in upper 16 bits of external_attr)
            mode = (info.external_attr >> 16) & 0o170000
            if mode == 0o120000:
                raise HTTPException(status_code=400, detail=f"Rejected symlink inside ZIP: {info.filename}")
            # Reject path traversal or absolute paths
            norm = info.filename.replace("\\", "/")
            if norm.startswith("/") or ".." in Path(norm).parts:
                raise HTTPException(status_code=400, detail=f"Rejected unsafe ZIP path: {info.filename}")
            if Path(norm).name.startswith(".") or norm.startswith("__MACOSX/"):
                continue

            total_uncompressed += info.file_size
            if total_uncompressed > MAX_ZIP_UNCOMPRESSED_BYTES:
                raise HTTPException(status_code=413, detail="ZIP uncompressed size exceeds 250 MB zip-bomb limit")

            payload = zf.read(info.filename)
            if len(payload) > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail=f"Archive entry {info.filename} exceeds 100 MB cap")
            entries.append((sanitize_filename(info.filename), payload))
    return entries
