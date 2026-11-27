import React, { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../lib/api";
import type { KnowledgeGraphData } from "../../types";
import { Badge, EmptyState, PageHeader, Panel } from "../ui/Primitives";

export const KnowledgeGraphView: React.FC = () => {
  const { activeCourseId, activeCourse, academicTree, setActiveCourseId, activeModel, pushNotification, setView } =
    useApp();

  const [graph, setGraph] = useState<KnowledgeGraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [srcLabel, setSrcLabel] = useState("");
  const [tgtLabel, setTgtLabel] = useState("");
  const [relType, setRelType] = useState<"prerequisite" | "related_to" | "formula_for" | "implements">("prerequisite");

  const load = async () => {
    if (!activeCourseId) return;
    try {
      setGraph(await api.knowledgeGraph(activeCourseId));
    } catch {
      setGraph(null);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCourseId]);

  const handleExtract = async () => {
    if (!activeCourseId) return;
    setBusy(true);
    try {
      const model = activeModel.startsWith("gemini:") ? "qwen2.5:3b" : activeModel;
      setGraph(await api.extractKnowledgeGraph(activeCourseId, model));
      pushNotification("Extracted course concept graph.");
    } finally {
      setBusy(false);
    }
  };

  const handleAddEdge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCourseId || !srcLabel.trim() || !tgtLabel.trim()) return;
    await api.createKnowledgeEdge({
      course_id: activeCourseId,
      source_label: srcLabel.trim(),
      target_label: tgtLabel.trim(),
      relation_type: relType,
    });
    setSrcLabel("");
    setTgtLabel("");
    await load();
  };

  if (!activeCourseId || academicTree.courses.length === 0) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <EmptyState
          icon="bx-network-chart"
          title="No course selected"
          description="Select or create a course to build an explicit concept and prerequisite knowledge graph."
          action={
            <button
              type="button"
              onClick={() => setView("courses")}
              className="px-4 py-2 rounded-lg bg-[var(--accent-blue)] text-white text-xs font-semibold cursor-pointer"
            >
              Go to My Courses
            </button>
          }
        />
      </div>
    );
  }

  const nodes = graph?.nodes.slice(0, 14) || [];
  const nodePos = new Map<string, { x: number; y: number }>();
  const cx = 310;
  const cy = 180;
  const radius = 135;
  nodes.forEach((n, idx) => {
    const angle = (2 * Math.PI * idx) / Math.max(1, nodes.length) - Math.PI / 2;
    nodePos.set(n.id, {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    });
  });

  const filteredEdges = selectedNode
    ? (graph?.edges || []).filter((e) => e.source_label === selectedNode || e.target_label === selectedNode)
    : graph?.edges || [];

  return (
    <div className="flex-1 overflow-y-auto p-5 md:p-7">
      <div className="max-w-6xl mx-auto space-y-5">
        <PageHeader
          icon="bx-network-chart"
          title="Course Knowledge Graph"
          subtitle="Explicit prerequisite, formula, and concept relationships extracted from your syllabus and documents."
          badge={activeCourse ? <Badge tone="blue">{activeCourse.code}</Badge> : undefined}
          actions={
            <div className="flex items-center gap-2">
              <select
                value={activeCourseId}
                onChange={(e) => setActiveCourseId(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
              >
                {academicTree.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy}
                onClick={handleExtract}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                <i className="bx bx-git-branch text-sm" />
                {busy ? "Extracting…" : "Auto-Extract Graph"}
              </button>
            </div>
          }
        />

        <div className="grid lg:grid-cols-12 gap-5">
          {/* Interactive SVG Graph */}
          <div className="lg:col-span-7">
            <Panel
              title="Concept Map"
              subtitle={selectedNode ? `Focused on: ${selectedNode}` : "Click any node to filter relationships"}
              actions={
                selectedNode && (
                  <button
                    type="button"
                    onClick={() => setSelectedNode(null)}
                    className="text-xs text-[var(--accent-blue)] cursor-pointer"
                  >
                    Reset Filter
                  </button>
                )
              }
            >
              {nodes.length === 0 ? (
                <div className="py-16 text-center text-xs text-[var(--text-muted)]">
                  No concepts yet. Click <strong>Auto-Extract Graph</strong> or add an edge on the right.
                </div>
              ) : (
                <svg viewBox="0 0 620 360" className="w-full h-[360px] rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)]">
                  <defs>
                    <marker id="arrow" markerWidth="6" markerHeight="6" refX="14" refY="3" orient="auto">
                      <path d="M0,0 L6,3 L0,6 Z" fill="#64748B" />
                    </marker>
                  </defs>
                  {(graph?.edges || []).map((edge) => {
                    const s = nodePos.get(edge.source_label);
                    const t = nodePos.get(edge.target_label);
                    if (!s || !t) return null;
                    const active = !selectedNode || edge.source_label === selectedNode || edge.target_label === selectedNode;
                    return (
                      <line
                        key={edge.id}
                        x1={s.x}
                        y1={s.y}
                        x2={t.x}
                        y2={t.y}
                        stroke={edge.relation_type === "prerequisite" ? "#3B82F6" : "#F59E0B"}
                        strokeWidth={active ? 1.8 : 0.7}
                        strokeOpacity={active ? 0.75 : 0.15}
                        markerEnd="url(#arrow)"
                      />
                    );
                  })}
                  {nodes.map((n) => {
                    const pos = nodePos.get(n.id)!;
                    const isSel = selectedNode === n.id;
                    return (
                      <g key={n.id} className="cursor-pointer" onClick={() => setSelectedNode(isSel ? null : n.id)}>
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={isSel ? 17 : 12}
                          fill={isSel ? "#3B82F6" : "#1C202C"}
                          stroke={isSel ? "#93C5FD" : "#3B82F6"}
                          strokeWidth={2}
                        />
                        <text
                          x={pos.x}
                          y={pos.y + 24}
                          textAnchor="middle"
                          fill="#CBD5E1"
                          fontSize="10"
                          fontFamily="Inter, sans-serif"
                        >
                          {n.label.length > 20 ? `${n.label.slice(0, 18)}…` : n.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}
            </Panel>
          </div>

          {/* Edge Editor & Relationships List */}
          <div className="lg:col-span-5 space-y-4">
            <Panel title="Add Relationship Edge">
              <form onSubmit={handleAddEdge} className="space-y-2.5">
                <input
                  value={srcLabel}
                  onChange={(e) => setSrcLabel(e.target.value)}
                  placeholder="Source concept (e.g., Semaphores)"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={relType}
                    onChange={(e) => setRelType(e.target.value as any)}
                    className="px-2.5 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
                  >
                    <option value="prerequisite">prerequisite →</option>
                    <option value="related_to">related_to →</option>
                    <option value="formula_for">formula_for →</option>
                    <option value="implements">implements →</option>
                  </select>
                  <input
                    value={tgtLabel}
                    onChange={(e) => setTgtLabel(e.target.value)}
                    placeholder="Target concept"
                    className="px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-[var(--accent-blue)] text-white text-xs font-semibold cursor-pointer"
                >
                  Save Edge
                </button>
              </form>
            </Panel>

            <Panel title={`Relationships (${filteredEdges.length})`}>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredEdges.map((e) => (
                  <div
                    key={e.id}
                    className="p-2.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] flex items-start justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">
                        {e.source_label}{" "}
                        <span className="text-[10px] font-mono text-[var(--accent-blue)]">[{e.relation_type}]</span>{" "}
                        {e.target_label}
                      </div>
                      {e.evidence_excerpt && (
                        <div className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">{e.evidence_excerpt}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => api.deleteKnowledgeEdge(e.id).then(load)}
                      className="text-[var(--text-muted)] hover:text-red-400 cursor-pointer"
                    >
                      <i className="bx bx-trash text-sm" />
                    </button>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
};
