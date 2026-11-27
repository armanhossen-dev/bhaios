import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import type { ViewId } from "../types";

export const CommandPalette: React.FC = () => {
  const {
    commandOpen,
    setCommandOpen,
    setView,
    chats,
    documents,
    academicTree,
    setActiveChatId,
    setActiveDoc,
    setActiveCourseId,
    t,
  } = useApp();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const navItems: Array<{ id: ViewId; label: string; icon: string }> = [
    { id: "home", label: t("home"), icon: "bx-home-alt-2" },
    { id: "courses", label: t("courses"), icon: "bx-buildings" },
    { id: "workspace", label: t("workspace"), icon: "bx-layout" },
    { id: "chat", label: t("chat"), icon: "bx-message-square-detail" },
    { id: "documents", label: t("documents"), icon: "bx-file" },
    { id: "codelab", label: t("codelab"), icon: "bx-code-alt" },
    { id: "study", label: t("study"), icon: "bx-brain" },
    { id: "speech", label: t("speech"), icon: "bx-microphone" },
    { id: "graph", label: t("graph"), icon: "bx-network-chart" },
    { id: "tasks", label: t("tasks"), icon: "bx-list-check" },
    { id: "progress", label: t("progress"), icon: "bx-bar-chart-alt-2" },
    { id: "resources", label: t("resources"), icon: "bx-book-bookmark" },
    { id: "models", label: t("models"), icon: "bx-chip" },
    { id: "settings", label: t("settings"), icon: "bx-cog" },
  ];

  const flatEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: Array<{
      key: string;
      group: string;
      label: string;
      meta?: string;
      icon: string;
      onSelect: () => void;
    }> = [];

    for (const c of academicTree.courses.filter(
      (x) => !q || x.title.toLowerCase().includes(q) || x.code.toLowerCase().includes(q)
    ).slice(0, 4)) {
      out.push({
        key: `crs-${c.id}`,
        group: "Courses",
        label: c.title,
        meta: c.code,
        icon: "bx-layout",
        onSelect: () => {
          setActiveCourseId(c.id);
          setView("workspace");
          setCommandOpen(false);
        },
      });
    }

    for (const n of navItems.filter((x) => !q || x.label.toLowerCase().includes(q))) {
      out.push({
        key: `nav-${n.id}`,
        group: "Navigation",
        label: n.label,
        icon: n.icon,
        onSelect: () => {
          setView(n.id);
          setCommandOpen(false);
        },
      });
    }

    for (const c of chats.filter((x) => !q || x.title.toLowerCase().includes(q)).slice(0, 4)) {
      out.push({
        key: `cht-${c.id}`,
        group: "Past Chats",
        label: c.title,
        meta: c.subject,
        icon: "bx-message-square-detail",
        onSelect: () => {
          setActiveChatId(c.id);
          setView("chat");
          setCommandOpen(false);
        },
      });
    }

    for (const d of documents.filter((x) => !q || x.original_name.toLowerCase().includes(q)).slice(0, 4)) {
      out.push({
        key: `doc-${d.id}`,
        group: "Documents",
        label: d.original_name,
        meta: (d.file_type || d.pipeline).toUpperCase(),
        icon: "bx-file",
        onSelect: () => {
          setActiveDoc(d);
          setView("documents");
          setCommandOpen(false);
        },
      });
    }
    return out;
  }, [query, chats, documents, academicTree.courses, navItems, setActiveChatId, setActiveCourseId, setActiveDoc, setCommandOpen, setView]);

  useEffect(() => {
    setCursor(0);
  }, [query, commandOpen]);

  if (!commandOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setCommandOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (flatEntries.length ? (c + 1) % flatEntries.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (flatEntries.length ? (c - 1 + flatEntries.length) % flatEntries.length : 0));
    } else if (e.key === "Enter" && flatEntries[cursor]) {
      e.preventDefault();
      flatEntries[cursor].onSelect();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global Search"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/60 backdrop-blur-xs px-4"
      onClick={() => setCommandOpen(false)}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)]">
          <i className="bx bx-search text-base text-[var(--text-muted)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("commandPlaceholder")}
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
          />
          <span className="text-[10px] font-mono text-[var(--text-muted)] hidden sm:inline">
            ↑↓ · Enter · Esc
          </span>
          <button
            type="button"
            aria-label="Close search"
            onClick={() => setCommandOpen(false)}
            className="p-1 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] cursor-pointer"
          >
            <i className="bx bx-x text-lg" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2 space-y-0.5">
          {flatEntries.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--text-muted)]">No matching items.</div>
          ) : (
            flatEntries.map((item, idx) => (
              <button
                key={item.key}
                type="button"
                aria-selected={idx === cursor}
                onClick={item.onSelect}
                onMouseEnter={() => setCursor(idx)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left cursor-pointer ${
                  idx === cursor
                    ? "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] font-semibold"
                    : "hover:bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <i className={`bx ${item.icon} text-sm shrink-0`} />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
                  {item.meta || item.group}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
