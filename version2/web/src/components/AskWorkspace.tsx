"use client";

import { ArrowUp, BookOpen } from "lucide-react";
import type { ChatMessage, Citation, StudyMode } from "@/lib/types";

interface AskWorkspaceProps {
  messages: ChatMessage[];
  input: string;
  mode: StudyMode;
  scope: "course" | "all";
  loading: boolean;
  onInputChange: (v: string) => void;
  onModeChange: (m: StudyMode) => void;
  onScopeChange: (s: "course" | "all") => void;
  onSend: () => void;
  onOpenCitation: (c: Citation) => void;
}

export function AskWorkspace({
  messages,
  input,
  mode,
  scope,
  loading,
  onInputChange,
  onModeChange,
  onScopeChange,
  onSend,
  onOpenCitation,
}: AskWorkspaceProps) {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      {messages.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div className="serif" style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>
            Ask from your course materials
          </div>
          <p style={{ color: "var(--text-2)", margin: 0, fontSize: 14 }}>
            Grounded answers cite exact lecture slides and pages. Low-confidence queries are clearly labeled.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {messages.map((m, idx) =>
            m.role === "user" ? (
              <div
                key={idx}
                style={{
                  alignSelf: "flex-end",
                  maxWidth: "80%",
                  background: "var(--subtle)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "10px 14px",
                }}
              >
                {m.content}
              </div>
            ) : (
              <div key={idx} className="card" style={{ padding: "20px 22px" }}>
                <div className="serif" style={{ fontSize: 15.5, lineHeight: 1.72, whiteSpace: "pre-wrap" }}>
                  {m.content}
                </div>
                {m.citations && m.citations.length > 0 && (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 8 }}>
                      Sources used ({m.citations.length})
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {m.citations.map((c) => (
                        <button
                          key={c.chunk_id}
                          className="btn btn-sm"
                          onClick={() => onOpenCitation(c)}
                          type="button"
                        >
                          <BookOpen size={12} />
                          <span>
                            [{c.index}] {c.filename} · p.{c.page_or_slide}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}

      <div className="card" style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={2}
          placeholder="Ask a question from your slides or notes…"
          style={{ width: "100%", border: "none", background: "transparent", resize: "none", outline: "none" }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              className="input"
              style={{ height: 30, fontSize: 12.5 }}
              value={scope}
              onChange={(e) => onScopeChange(e.target.value as "course" | "all")}
            >
              <option value="course">Current course</option>
              <option value="all">All courses</option>
            </select>
            <select
              className="input"
              style={{ height: 30, fontSize: 12.5 }}
              value={mode}
              onChange={(e) => onModeChange(e.target.value as StudyMode)}
            >
              <option value="guide">Guide (Socratic)</option>
              <option value="answer">Answer (Direct)</option>
              <option value="explain_slide">Explain slide</option>
              <option value="exam">Exam rubric</option>
              <option value="compare">Compare</option>
            </select>
          </div>
          <button className="btn btn-primary btn-sm" onClick={onSend} disabled={loading} type="button">
            <ArrowUp size={14} />
            <span>{loading ? "Thinking…" : "Ask"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
