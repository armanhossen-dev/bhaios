"""Source code adapter: language detection + Python AST & structural symbol/line-range chunking."""

from __future__ import annotations

import ast
import re
from pathlib import Path

from .base import IngestResult, NormalizedChunk

EXT_LANG = {
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".hpp": "cpp",
    ".cc": "cpp",
    ".py": "python",
    ".java": "java",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".html": "html",
    ".css": "css",
    ".sql": "sql",
    ".json": "json",
}


def extract_code_symbols(code: str, language: str) -> list[dict]:
    """Extract functions, classes, and line ranges via Python AST or regex heuristics."""
    symbols: list[dict] = []
    if language == "python":
        try:
            tree = ast.parse(code)
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                    symbols.append(
                        {
                            "kind": "class" if isinstance(node, ast.ClassDef) else "function",
                            "name": node.name,
                            "start_line": node.lineno,
                            "end_line": getattr(node, "end_lineno", node.lineno),
                        }
                    )
            symbols.sort(key=lambda s: s["start_line"])
            return symbols
        except SyntaxError:
            pass

    patterns = [
        ("class", re.compile(r"^\s*(?:public\s+|export\s+)?(?:class|struct|interface)\s+([A-Za-z_]\w*)")),
        ("function", re.compile(r"^\s*(?:async\s+)?(?:function\s+([A-Za-z_]\w*)|(?:[A-Za-z_][\w<>*&\s]+)\s+([A-Za-z_]\w*)\s*\([^;]*\)\s*\{?)")),
    ]
    for lineno, line in enumerate(code.splitlines(), start=1):
        for kind, pat in patterns:
            m = pat.match(line)
            if m:
                name = next((g for g in m.groups() if g), None)
                if name and name not in {"if", "for", "while", "switch", "return"}:
                    symbols.append({"kind": kind, "name": name, "start_line": lineno, "end_line": lineno})
                    break
    return symbols


def parse_code(
    doc_id: str,
    raw_bytes: bytes,
    original_name: str,
    course_id: str | None = None,
) -> IngestResult:
    ext = Path(original_name).suffix.lower()
    language = EXT_LANG.get(ext, "text")
    raw_code = raw_bytes.decode("utf-8", errors="ignore")
    lines = raw_code.splitlines()
    symbols = extract_code_symbols(raw_code, language)

    chunks: list[NormalizedChunk] = []
    if symbols and len(lines) > 25:
        for idx, sym in enumerate(symbols[:20], start=1):
            start = max(1, sym["start_line"])
            end = symbols[idx]["start_line"] - 1 if idx < len(symbols) else min(len(lines), start + 45)
            end = max(start, min(len(lines), end))
            snippet = "\n".join(f"{ln}: {lines[ln - 1]}" for ln in range(start, end + 1))
            chunks.append(
                NormalizedChunk(
                    document_id=doc_id,
                    filename=original_name,
                    file_type="code",
                    course_id=course_id,
                    page_number=1,
                    content_type="code",
                    extracted_text=f"[{language.upper()} {sym['kind']} {sym['name']} · Lines {start}-{end}]\n{snippet}",
                    metadata={"language": language, "symbol": sym},
                    source_location=f"Lines {start}-{end}",
                )
            )
    else:
        numbered = "\n".join(f"{i}: {line}" for i, line in enumerate(lines, start=1))
        chunks.append(
            NormalizedChunk(
                document_id=doc_id,
                filename=original_name,
                file_type="code",
                course_id=course_id,
                page_number=1,
                content_type="code",
                extracted_text=numbered or f"[Empty code file: {original_name}]",
                metadata={"language": language, "symbols": symbols},
                source_location=f"Lines 1-{max(1, len(lines))}",
            )
        )

    sym_note = f", {len(symbols)} symbols" if symbols else ""
    summary = f"{language.upper()} source file ({len(lines)} lines{sym_note})"
    return IngestResult(
        file_type="code",
        page_count=1,
        summary=summary,
        chunks=chunks,
    )
