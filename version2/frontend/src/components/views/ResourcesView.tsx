import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { StudyResource } from "../../types";
import { MarkdownMath } from "../MarkdownMath";

export const ResourcesView: React.FC = () => {
  const [resources, setResources] = useState<StudyResource[]>([]);
  const [filterSubject, setFilterSubject] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Physics");
  const [content, setContent] = useState("");

  const load = () => api.resources().then(setResources).catch(() => {});

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    await api.createResource({ title: title.trim(), subject, category: "Custom Note", content });
    setTitle("");
    setContent("");
    setShowForm(false);
    load();
  };

  const subjects = ["All", ...Array.from(new Set(resources.map((r) => r.subject)))];
  const visible =
    filterSubject === "All" ? resources : resources.filter((r) => r.subject === filterSubject);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <i className="bx bx-book-bookmark text-xl text-[var(--accent-blue)]" />
              Formula Vault & Study Resources
            </h1>
            <p className="text-xs text-[var(--text-secondary)]">
              Curated HSC, Admission & Engineering reference sheets with KaTeX math rendering.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent-blue)] text-white text-xs font-semibold cursor-pointer"
          >
            <i className="bx bx-plus text-base" /> Add Formula Sheet
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-3"
          >
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Sheet title (e.g. Electrostatics Formulas)"
                className="px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm outline-none"
              />
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm outline-none"
              />
            </div>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Markdown + LaTeX math (e.g. $F = k\\frac{q_1 q_2}{r^2}$)"
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
            >
              Save Resource
            </button>
          </form>
        )}

        <div className="flex flex-wrap gap-1.5">
          {subjects.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterSubject(s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                filterSubject === s
                  ? "bg-[var(--accent-blue)] text-white"
                  : "bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {visible.map((res) => (
            <div
              key={res.id}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]">
                    {res.subject} · {res.category}
                  </span>
                  <h3 className="text-base font-bold mt-1.5">{res.title}</h3>
                </div>
                {res.is_custom && (
                  <button
                    type="button"
                    onClick={() => api.deleteResource(res.id).then(load)}
                    className="p-1.5 rounded-lg hover:text-red-400 text-[var(--text-muted)] cursor-pointer"
                  >
                    <i className="bx bx-trash text-base" />
                  </button>
                )}
              </div>
              <MarkdownMath content={res.content} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
