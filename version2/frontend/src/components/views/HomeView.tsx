import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../lib/api";
import { Badge, PageHeader, Panel } from "../ui/Primitives";

export const HomeView: React.FC = () => {
  const {
    setView,
    setActiveChatId,
    setActiveCourseId,
    academicTree,
    refreshAcademics,
    chats,
    documents,
    tasks,
    health,
    activeModel,
    pushNotification,
  } = useApp();

  const [dismissOnboarding, setDismissOnboarding] = useState(
    () => localStorage.getItem("bhaios_onboarding_done") === "1"
  );
  const [seeding, setSeeding] = useState(false);

  const pendingTasks = tasks.filter((t) => !t.completed);
  const step1Done = academicTree.courses.length > 0;
  const step2Done = documents.length > 0;
  const step3Done = chats.length > 0;
  const showOnboarding = !dismissOnboarding && !(step1Done && step2Done && step3Done);

  const handleQuickSample = async () => {
    setSeeding(true);
    try {
      const res = await api.sampleSetup();
      await refreshAcademics();
      pushNotification(res.message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 md:p-7">
      <div className="max-w-6xl mx-auto space-y-5">
        <PageHeader
          icon="bx-grid-alt"
          title="University Intelligence Workspace"
          subtitle={`Engine: ${activeModel} · ${health?.ollama_online ? "Local Ollama Online" : "Offline Standby"}`}
          badge={<Badge tone="emerald">100% Local-First</Badge>}
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setView("courses")}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-semibold hover:border-[var(--accent-blue)] cursor-pointer"
              >
                My Courses
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveChatId(null);
                  setView("chat");
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white text-xs font-semibold cursor-pointer"
              >
                <i className="bx bx-sparkles text-sm" /> Ask Bhai
              </button>
            </div>
          }
        />

        {/* First-Year Student 3-Step Onboarding Checklist */}
        {showOnboarding && (
          <Panel
            title="Start Your Semester in 3 Steps"
            subtitle="New to BhaiOS? Follow these quick steps to set up your courses and notes."
            actions={
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem("bhaios_onboarding_done", "1");
                  setDismissOnboarding(true);
                }}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Dismiss
              </button>
            }
          >
            <div className="grid md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5">
                    <i className={`bx ${step1Done ? "bx-check-circle text-emerald-400" : "bx-circle text-[var(--accent-blue)]"} text-base`} />
                    1. Add Semester & Courses
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Create your semester & courses, or load a sample CS setup to explore immediately.
                </p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setView("courses")}
                    className="px-2.5 py-1 rounded-md bg-[var(--accent-blue)] text-white text-[11px] font-semibold cursor-pointer"
                  >
                    Create Course
                  </button>
                  {!step1Done && (
                    <button
                      type="button"
                      disabled={seeding}
                      onClick={handleQuickSample}
                      className="px-2.5 py-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11px] font-semibold cursor-pointer"
                    >
                      {seeding ? "Loading…" : "Try Sample"}
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5">
                    <i className={`bx ${step2Done ? "bx-check-circle text-emerald-400" : "bx-circle text-[var(--accent-blue)]"} text-base`} />
                    2. Upload Lecture Files
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Drop an entire folder of PDFs, PowerPoint (.pptx) slides, Word docs, or code files.
                </p>
                <button
                  type="button"
                  onClick={() => setView("documents")}
                  className="px-2.5 py-1 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-blue)] text-[11px] font-semibold cursor-pointer"
                >
                  Open Document Studio →
                </button>
              </div>

              <div className="p-3.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5">
                    <i className={`bx ${step3Done ? "bx-check-circle text-emerald-400" : "bx-circle text-[var(--accent-blue)]"} text-base`} />
                    3. Study with Bhai & Quizzes
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Ask questions with clickable slide citations, practice coding, or generate flashcards.
                </p>
                <button
                  type="button"
                  onClick={() => setView(step1Done ? "workspace" : "chat")}
                  className="px-2.5 py-1 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-blue)] text-[11px] font-semibold cursor-pointer"
                >
                  {step1Done ? "Open Course Workspace →" : "Start Chat →"}
                </button>
              </div>
            </div>
          </Panel>
        )}

        {/* Compact Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Active Courses", value: academicTree.courses.length, icon: "bx-buildings", view: "courses" as const },
            { label: "Indexed Materials", value: documents.length, icon: "bx-file", view: "documents" as const },
            { label: "Pending Deadlines", value: pendingTasks.length, icon: "bx-list-check", view: "tasks" as const },
            {
              label: "Unified RAM",
              value: health ? `${health.ram_used_gb}/${health.ram_total_gb} GB` : "--",
              icon: "bx-chip",
              view: "settings" as const,
            },
          ].map((card) => (
            <button
              key={card.label}
              type="button"
              onClick={() => setView(card.view)}
              className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--accent-blue)] text-left transition cursor-pointer"
            >
              <div className="flex items-center justify-between text-[var(--text-muted)] text-[11px] mb-1.5">
                <span>{card.label}</span>
                <i className={`bx ${card.icon} text-sm text-[var(--accent-blue)]`} />
              </div>
              <div className="text-xl font-bold font-mono">{card.value}</div>
            </button>
          ))}
        </div>

        {/* Courses + Quick Launchers */}
        <div className="grid lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7">
            <Panel
              title="Your University Courses"
              actions={
                <button
                  type="button"
                  onClick={() => setView("courses")}
                  className="text-xs text-[var(--accent-blue)] font-semibold cursor-pointer"
                >
                  Manage →
                </button>
              }
            >
              {academicTree.courses.length === 0 ? (
                <div className="py-6 text-center space-y-2">
                  <p className="text-xs text-[var(--text-muted)]">
                    No courses yet. Set up your semester or load sample CS courses.
                  </p>
                  <button
                    type="button"
                    onClick={() => setView("courses")}
                    className="px-3 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white text-xs font-semibold cursor-pointer"
                  >
                    Set Up Courses
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {academicTree.courses.slice(0, 4).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setActiveCourseId(c.id);
                        setView("workspace");
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-[var(--bg-elevated)] hover:border-[var(--accent-blue)] border border-transparent text-left cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-mono text-[var(--accent-blue)]">{c.code}</div>
                        <div className="text-sm font-semibold truncate">{c.title}</div>
                      </div>
                      <div className="text-[11px] font-mono text-[var(--text-muted)] shrink-0">
                        {c.topic_count || 0} ch · {c.doc_count || 0} docs
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <Panel title="Studios & Labs">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "workspace" as const, label: "Course Workspace", icon: "bx-layout" },
                  { id: "codelab" as const, label: "Code Lab", icon: "bx-code-alt" },
                  { id: "study" as const, label: "Study Studio", icon: "bx-brain" },
                  { id: "speech" as const, label: "Lecture Studio", icon: "bx-microphone" },
                ].map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => setView(tool.id)}
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-blue)] text-xs font-medium cursor-pointer"
                  >
                    <i className={`bx ${tool.icon} text-base text-[var(--accent-blue)]`} />
                    <span className="truncate">{tool.label}</span>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel
              title="Recent Sessions"
              actions={
                <button
                  type="button"
                  onClick={() => setView("chat")}
                  className="text-xs text-[var(--accent-blue)] cursor-pointer"
                >
                  All →
                </button>
              }
            >
              {chats.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">No conversations yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {chats.slice(0, 3).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setActiveChatId(c.id);
                        setView("chat");
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[var(--bg-elevated)] text-left text-xs cursor-pointer"
                    >
                      <span className="truncate">{c.title}</span>
                      <Badge tone="neutral">{c.subject}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
};
