import React, { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../lib/api";
import type { AnalyticsData, BenchmarkRun } from "../../types";

export const ProgressView: React.FC = () => {
  const { activeModel } = useApp();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [benchmarks, setBenchmarks] = useState<BenchmarkRun[]>([]);
  const [question, setQuestion] = useState("Explain Newton's Second Law with an example.");
  const [pipeline, setPipeline] = useState<"guide" | "answer">("guide");
  const [running, setRunning] = useState(false);

  const load = async () => {
    const [a, b] = await Promise.all([api.analytics(), api.benchmarks()]);
    setData(a);
    setBenchmarks(b);
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const runBench = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || running) return;
    setRunning(true);
    try {
      await api.runBenchmark({ model: activeModel, pipeline, question });
      await load();
    } finally {
      setRunning(false);
    }
  };

  const maxWeekly = Math.max(
    1,
    ...(data?.weekly_rhythm.map((d) => d.messages + d.focus_minutes) || [1])
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <i className="bx bx-bar-chart-alt-2 text-xl text-[var(--accent-blue)]" />
            Study Progress & Benchmark Lab
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Live SQLite study telemetry, weekly rhythm, and Guide-vs-Answer latency benchmarks.
          </p>
        </div>

        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Messages", value: data.totals.messages },
                { label: "Tokens Processed", value: data.totals.tokens.toLocaleString() },
                { label: "Focus Minutes", value: `${data.totals.focus_minutes}m` },
                {
                  label: "Tasks Done",
                  value: `${data.totals.completed_tasks}/${data.totals.tasks}`,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
                >
                  <div className="text-xs text-[var(--text-muted)]">{stat.label}</div>
                  <div className="text-2xl font-bold font-mono mt-1">{stat.value}</div>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4">
                <h2 className="text-sm font-semibold">Weekly Study Rhythm (7 Days)</h2>
                <div className="flex items-end justify-between gap-2 h-36 pt-4">
                  {data.weekly_rhythm.map((day) => {
                    const pct = Math.round(((day.messages + day.focus_minutes) / maxWeekly) * 100);
                    return (
                      <div key={day.full_date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                        <div className="w-full bg-[var(--bg-elevated)] rounded-t-lg h-full flex items-end overflow-hidden">
                          <div
                            className="w-full bg-[var(--accent-blue)] rounded-t-lg transition-all"
                            style={{ height: `${Math.max(pct, 6)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-[var(--text-muted)]">{day.date}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-3">
                <h2 className="text-sm font-semibold">Subject Activity</h2>
                {data.subjects.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)]">Start chatting to track subject mastery.</p>
                ) : (
                  <div className="space-y-2.5">
                    {data.subjects.map((s) => (
                      <div key={s.subject} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{s.subject}</span>
                          <span className="font-mono text-[var(--text-muted)]">{s.count} sessions</span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                          <div
                            className="h-full bg-emerald-400"
                            style={{
                              width: `${Math.min(100, (s.count / Math.max(1, data.totals.chats)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {data.course_readiness && data.course_readiness.length > 0 && (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-3">
                <h2 className="text-sm font-semibold">Metric-Backed Course Readiness</h2>
                <div className="grid md:grid-cols-2 gap-3">
                  {data.course_readiness.map((cr) => (
                    <div key={cr.course_id} className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">
                          {cr.code} · {cr.title}
                        </span>
                        {cr.exam_date && <span className="font-mono text-[10px] text-amber-400">Exam {cr.exam_date}</span>}
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px] text-[var(--text-secondary)]">
                        <div>Chapters: {cr.topics_mastered}/{cr.topics_total}</div>
                        <div>Quiz Avg: {cr.avg_quiz_score !== null ? `${cr.avg_quiz_score}%` : "N/A"}</div>
                        <div>Cards: {cr.flashcards_reviewed}/{cr.flashcards_total}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <i className="bx bx-test-tube text-base text-amber-400" />
            <h2 className="text-sm font-semibold">Local Evaluation Benchmark Runner</h2>
          </div>

          <form onSubmit={runBench} className="flex flex-col sm:flex-row gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm outline-none"
            />
            <select
              value={pipeline}
              onChange={(e) => setPipeline(e.target.value as "guide" | "answer")}
              className="px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            >
              <option value="guide">Guide Mode</option>
              <option value="answer">Answer Mode</option>
            </select>
            <button
              type="submit"
              disabled={running}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent-blue)] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              <i className="bx bx-play text-base" />
              {running ? "Running…" : `Test ${activeModel}`}
            </button>
          </form>

          {benchmarks.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {benchmarks.map((b) => (
                <div
                  key={b.id}
                  className="p-3 rounded-xl bg-[var(--bg-elevated)] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{b.question}</div>
                    <div className="text-[var(--text-muted)] truncate">{b.response_preview}</div>
                  </div>
                  <div className="flex items-center gap-2 font-mono shrink-0">
                    <span className="px-2 py-0.5 rounded bg-[var(--bg-surface)]">{b.model}</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400">
                      {b.pipeline}
                    </span>
                    <span className="text-emerald-400">{b.latency_ms} ms</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
