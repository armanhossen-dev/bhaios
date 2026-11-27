"""Code Lab APIs: Isolated sandboxed execution (with static fallback) & AI Coding Mentor."""

from __future__ import annotations

import ast
import os
import resource
import shutil
import subprocess
import tempfile
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

from ..ollama_client import generate_ollama_once

router = APIRouter(prefix="/api/codelab", tags=["codelab"])


class CodeRunRequest(BaseModel):
    language: str = "python"
    code: str
    stdin: str = ""


class CodeMentorRequest(BaseModel):
    language: str = "python"
    code: str
    action: str = "explain"  # explain | debug | dry_run | complexity | viva
    model: str = "qwen2.5:3b"
    ui_language: str = "en"


def _static_python_analysis(code: str) -> dict:
    try:
        tree = ast.parse(code)
        funcs = [n.name for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)]
        classes = [n.name for n in ast.walk(tree) if isinstance(n, ast.ClassDef)]
        loops = sum(1 for n in ast.walk(tree) if isinstance(n, (ast.For, ast.While)))
        return {
            "syntax_valid": True,
            "functions": funcs,
            "classes": classes,
            "loop_count": loops,
        }
    except SyntaxError as exc:
        return {"syntax_valid": False, "error": f"SyntaxError line {exc.lineno}: {exc.msg}"}


def _limit_sandbox() -> None:
    """Apply CPU (4s) and memory (256 MB) limits inside isolated child process."""
    resource.setrlimit(resource.RLIMIT_CPU, (4, 4))
    try:
        resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
    except Exception:
        pass


@router.post("/run")
def run_code_sandbox(req: CodeRunRequest) -> dict:
    """Execute code in an isolated temp directory with timeout, restricted env, and static fallback."""
    lang = req.language.lower()
    with tempfile.TemporaryDirectory(prefix="bhaios_sandbox_") as tmpdir:
        tmp = Path(tmpdir)
        safe_env = {"PATH": "/usr/bin:/bin:/opt/homebrew/bin:/usr/local/bin", "HOME": str(tmp)}

        cmd: list[str] | None = None
        if lang == "python":
            src = tmp / "main.py"
            src.write_text(req.code, encoding="utf-8")
            cmd = ["python3", "-I", str(src)]
        elif lang in ("javascript", "js") and shutil.which("node"):
            src = tmp / "main.js"
            src.write_text(req.code, encoding="utf-8")
            cmd = ["node", str(src)]
        elif lang in ("c", "cpp") and shutil.which("clang++" if lang == "cpp" else "clang"):
            compiler = "clang++" if lang == "cpp" else "clang"
            ext = ".cpp" if lang == "cpp" else ".c"
            src = tmp / f"main{ext}"
            out_bin = tmp / "a.out"
            src.write_text(req.code, encoding="utf-8")
            comp = subprocess.run(
                [compiler, str(src), "-O0", "-o", str(out_bin)],
                cwd=str(tmp),
                env=safe_env,
                capture_output=True,
                text=True,
                timeout=8,
            )
            if comp.returncode != 0:
                return {
                    "executed": False,
                    "stdout": "",
                    "stderr": comp.stderr,
                    "exit_code": comp.returncode,
                    "mode": "compile-error",
                }
            cmd = [str(out_bin)]

        if cmd is None:
            analysis = _static_python_analysis(req.code) if lang == "python" else {"note": f"Runtime for '{lang}' unavailable; use AI Mentor static analysis."}
            return {
                "executed": False,
                "stdout": "",
                "stderr": f"Sandboxed runtime for {lang} not available on this host. Static analysis returned.",
                "exit_code": 0,
                "mode": "static-fallback",
                "analysis": analysis,
            }

        try:
            proc = subprocess.run(
                cmd,
                input=req.stdin,
                cwd=str(tmp),
                env=safe_env,
                capture_output=True,
                text=True,
                timeout=5,
                preexec_fn=_limit_sandbox if os.name == "posix" else None,
            )
            return {
                "executed": True,
                "stdout": proc.stdout[:8000],
                "stderr": proc.stderr[:4000],
                "exit_code": proc.returncode,
                "mode": "sandbox",
                "analysis": _static_python_analysis(req.code) if lang == "python" else None,
            }
        except subprocess.TimeoutExpired:
            return {
                "executed": False,
                "stdout": "",
                "stderr": "Execution timed out (5s sandbox limit).",
                "exit_code": -1,
                "mode": "timeout",
            }


@router.post("/mentor")
async def codelab_mentor(req: CodeMentorRequest) -> dict:
    action_prompts = {
        "explain": "Explain this code line by line in clear terms for a university CS student.",
        "debug": "Find any logical, syntax, edge-case, or memory bugs in this code and show how to fix them.",
        "dry_run": "Perform a step-by-step variable dry run table tracing execution on a sample input.",
        "complexity": "Analyze the Time Complexity and Space Complexity (Big-O) with justification.",
        "viva": "Generate 4 university lab viva questions based on this code with concise model answers.",
    }
    task = action_prompts.get(req.action, action_prompts["explain"])
    lang_note = "Explain in clean Unicode Bangla with English technical terms." if req.ui_language == "bn" else "Respond clearly in English."
    prompt = f"{task} {lang_note}\n\nLanguage: {req.language}\n```{req.language}\n{req.code}\n```"
    try:
        content, tokens = await generate_ollama_once(req.model, [{"role": "user", "content": prompt}])
        return {"response": content, "tokens": tokens}
    except Exception as exc:
        analysis = _static_python_analysis(req.code) if req.language == "python" else {}
        return {
            "response": f"Local Ollama unavailable ({exc}). Static inspection: {analysis}",
            "tokens": 0,
        }
