import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../lib/api";
import { MarkdownMath } from "../MarkdownMath";
import { Badge, PageHeader, Panel } from "../ui/Primitives";

const TEMPLATES: Record<string, string> = {
  python: `def binary_search(arr, target):\n    lo, hi = 0, len(arr) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1\n\nprint("Index:", binary_search([2, 5, 8, 12, 16, 23], 16))`,
  javascript: `function fibonacci(n) {\n  const dp = [0, 1];\n  for (let i = 2; i <= n; i++) dp[i] = dp[i - 1] + dp[i - 2];\n  return dp[n];\n}\nconsole.log("Fib(10):", fibonacci(10));`,
  cpp: `#include <iostream>\nusing namespace std;\nint main() {\n    int arr[] = {1, 2, 3, 4, 5};\n    int sum = 0;\n    for (int x : arr) sum += x;\n    cout << "Sum = " << sum << endl;\n    return 0;\n}`,
  c: `#include <stdio.h>\nint main() {\n    int a = 5, b = 7;\n    printf("Sum = %d\\n", a + b);\n    return 0;\n}`,
  java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello BhaiOS Code Lab");\n    }\n}`,
};

export const CodeLabView: React.FC = () => {
  const { activeModel, language: uiLang } = useApp();
  const [lang, setLang] = useState("python");
  const [code, setCode] = useState(TEMPLATES.python);
  const [stdin, setStdin] = useState("");
  const [running, setRunning] = useState(false);
  const [runOutput, setRunOutput] = useState<{
    stdout: string;
    stderr: string;
    mode: string;
    exit_code: number;
    analysis?: Record<string, unknown>;
  } | null>(null);
  const [mentorLoading, setMentorLoading] = useState(false);
  const [mentorOut, setMentorOut] = useState("");

  const handleLangChange = (next: string) => {
    setLang(next);
    setCode(TEMPLATES[next] || TEMPLATES.python);
    setRunOutput(null);
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await api.runCode({ language: lang, code, stdin });
      setRunOutput(res);
    } finally {
      setRunning(false);
    }
  };

  const handleMentor = async (action: string) => {
    setMentorLoading(true);
    try {
      const model = activeModel.startsWith("gemini:") ? "qwen2.5:3b" : activeModel;
      const res = await api.mentorCode({
        language: lang,
        code,
        action,
        model,
        ui_language: uiLang,
      });
      setMentorOut(res.response);
    } finally {
      setMentorLoading(false);
    }
  };

  const lines = code.split("\n");

  return (
    <div className="flex-1 overflow-y-auto p-5 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <PageHeader
          icon="bx-code-alt"
          title="Code Lab"
          subtitle="Isolated sandbox execution (5s timeout, 256MB cap) with Bhai Coding Mentor."
          badge={<Badge tone="emerald">Sandboxed</Badge>}
          actions={
            <div className="flex items-center gap-2">
              <select
                value={lang}
                onChange={(e) => handleLangChange(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-mono"
              >
                <option value="python">Python 3</option>
                <option value="javascript">JavaScript (Node)</option>
                <option value="cpp">C++</option>
                <option value="c">C</option>
                <option value="java">Java (Static/AI)</option>
              </select>
              <button
                type="button"
                disabled={running}
                onClick={handleRun}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                <i className="bx bx-play text-base" />
                {running ? "Running…" : "Run"}
              </button>
            </div>
          }
        />

        <div className="grid lg:grid-cols-12 gap-4">
          {/* Left: Line-Numbered Editor + Stdin + Output */}
          <div className="lg:col-span-7 space-y-3">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-muted)]">
                <span>main.{lang === "python" ? "py" : lang === "javascript" ? "js" : lang}</span>
                <span>{lines.length} lines</span>
              </div>
              <div className="flex max-h-[360px] overflow-auto bg-[var(--bg-base)] font-mono text-xs">
                <div className="select-none py-3 px-2.5 text-right text-[var(--text-muted)] border-r border-[var(--border-subtle)] bg-[var(--bg-surface)]/40 leading-5">
                  {lines.map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  spellCheck={false}
                  rows={Math.max(14, lines.length)}
                  className="flex-1 p-3 bg-transparent text-[var(--text-primary)] outline-none resize-none leading-5"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Panel title="Standard Input (stdin)">
                <textarea
                  rows={3}
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder="Optional stdin…"
                  className="w-full bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-lg p-2 text-xs font-mono outline-none"
                />
              </Panel>
              <Panel
                title="Sandbox Console"
                actions={
                  runOutput && (
                    <Badge tone={runOutput.exit_code === 0 ? "emerald" : "red"}>
                      {runOutput.mode} · exit {runOutput.exit_code}
                    </Badge>
                  )
                }
              >
                <pre className="text-xs font-mono whitespace-pre-wrap max-h-28 overflow-auto text-[var(--text-secondary)]">
                  {runOutput
                    ? runOutput.stdout || runOutput.stderr || "(no output)"
                    : "Click Run to execute in isolated sandbox."}
                </pre>
              </Panel>
            </div>
          </div>

          {/* Right: Bhai Coding Mentor */}
          <div className="lg:col-span-5">
            <Panel
              title="Bhai Coding Mentor"
              subtitle="Line-by-line walkthroughs, dry runs & viva prep"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: "explain", label: "Explain Lines" },
                    { id: "debug", label: "Debug" },
                    { id: "dry_run", label: "Dry Run" },
                    { id: "complexity", label: "Big-O" },
                    { id: "viva", label: "Viva Q&A" },
                  ].map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      disabled={mentorLoading}
                      onClick={() => handleMentor(act.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-blue)] text-xs font-medium cursor-pointer disabled:opacity-50"
                    >
                      {act.label}
                    </button>
                  ))}
                </div>

                <div className="min-h-[320px] max-h-[420px] overflow-y-auto rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] p-3.5">
                  {mentorLoading ? (
                    <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                      <i className="bx bx-loader-alt bx-spin text-base text-[var(--accent-blue)]" />
                      Analyzing code locally…
                    </div>
                  ) : mentorOut ? (
                    <MarkdownMath content={mentorOut} />
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">
                      Select an analysis action above to trace algorithms, inspect complexity, or practice viva questions.
                    </p>
                  )}
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
};
