"use client";

import { X } from "lucide-react";
import type { ChunkItem, FileItem } from "@/lib/types";

interface SourceDrawerProps {
  open: boolean;
  file: FileItem | null;
  chunks: ChunkItem[];
  highlightPassage: string;
  onClose: () => void;
}

export function SourceDrawer({ open, file, chunks, highlightPassage, onClose }: SourceDrawerProps) {
  if (!open) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer-panel" onClick={(e) => e.stopPropagation()} aria-label="Source passage viewer">
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{file?.filename || "Source Passage"}</div>
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>
              {file ? `${file.page_count} pages/slides` : "Loading…"}
            </div>
          </div>
          <button className="btn btn-sm" onClick={onClose} type="button" aria-label="Close drawer">
            <X size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          {chunks.map((c) => {
            const isHit = highlightPassage && c.content.includes(highlightPassage.slice(0, 35));
            return (
              <div
                key={c.id}
                className="card serif"
                style={{
                  padding: 16,
                  fontSize: 14.5,
                  lineHeight: 1.7,
                  background: isHit ? "var(--highlight-tint)" : "var(--surface)",
                  borderColor: isHit ? "var(--highlight-border)" : "var(--border)",
                }}
              >
                <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 6 }}>
                  Page/Slide {c.page_or_slide} · {c.section_title}
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{c.content}</div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
