import React, { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../lib/api";
import type { AgentMode, CourseDetail, StudyDocument } from "../../types";
import { Badge, EmptyState, ErrorState, LoadingState, Panel } from "../ui/Primitives";
import { ChatView } from "./ChatView";
import { CodeLabView } from "./CodeLabView";
import { StudyStudioView } from "./StudyStudioView";

const AGENT_MODES: Array<{ id: AgentMode; label: string; icon: string }> = [
  { id: "tutor", label: "Tutor", icon: "bx-book-reader" },
  { id: "exam_coach", label: "Exam Coach", icon: "bx-award" },
  { id: "coding_mentor", label: "Coding Mentor", icon: "bx-code-alt" },
  { id: "viva_examiner", label: "Viva Examiner", icon: "bx-user-voice" },
  { id: "research_assistant", label: "Research", icon: "bx-search-alt" },
  { id: "quick_answer", label: "Quick Answer", icon: "bx-bolt" },
  { id: "deep_learning", label: "Deep Learning", icon: "bx-layer" },
  { id: "revision_coach", label: "Revision", icon: "bx-revision" },
];

export const CourseWorkspaceView: React.FC = () => {
  const {
    academicTree,
    activeCourseId,
    setActiveCourseId,
    setView,
    activeDoc,
    setActiveDoc,
    agentMode,
    setAgentMode,
    answerPolicy,
    setAnswerPolicy,
    activeModel,
    language,
    visionModel,
    refreshTasks,
    pushNotification,
  } = useApp();

  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [centerTab, setCenterTab] = useState<"overview" | "chat" | "document" | "quiz" | "code">("chat");
  const [mobileSheet, setMobileSheet] = useState<"none" | "files" | "bhai">("none");
  const [newTopic, setNewTopic] = useState("");
  const [docContent, setDocContent] = useState("");
  const [leftWidth, setLeftWidth] = useState(250);
  const [rightWidth, setRightWidth] = useState(290);
  const [roadmap, setRoadmap] = useState<{
    overview: string;
    model_used: string;
    steps: Array<{ topic_id: string; chapter_index: number; title: string; has_materials: boolean; reasons: string[] }>;
  } | null>(null);
  const [schedule, setSchedule] = useState<
    Array<{ day: number; date: string; topic: string; hours: number; focus: string }>
  >([]);
  const [bhaiBusy, setBhaiBusy] = useState(false);

  const loadCourse = async () => {
    if (!activeCourseId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await api.courseDetail(activeCourseId);
      setDetail(d);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCourseId]);

  useEffect(() => {
    if (!activeDoc) {
      setDocContent("");
      return;
    }
    if (!activeDoc.mime_type.startsWith("image/") && activeDoc.file_type !== "pdf") {
      api.documentContent(activeDoc.id).then(setDocContent).catch(() => setDocContent(activeDoc.summary));
    }
  }, [activeDoc]);

  const handleUploadToCourse = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !activeCourseId) return;
    for (const file of files) {
      try {
        const uploaded = await api.uploadDocument(
          file,
          file.type.startsWith("image/") ? "vlm" : "ocr",
          visionModel,
          activeCourseId
        );
        setActiveDoc(uploaded);
        pushNotification(
          uploaded.duplicate
            ? `Already indexed in course: ${uploaded.original_name}`
            : `Added ${uploaded.original_name} to course`
        );
      } catch (err) {
        pushNotification(`Upload error: ${(err as Error).message}`);
      }
    }
    await loadCourse();
    e.target.value = "";
  };

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic.trim() || !activeCourseId) return;
    await api.addTopic(activeCourseId, newTopic.trim(), (detail?.topics.length || 0) + 1);
    setNewTopic("");
    await loadCourse();
  };

  const cycleTopicStatus = async (topicId: string, cur: string) => {
    const next = cur === "not_started" ? "in_progress" : cur === "in_progress" ? "mastered" : "not_started";
    await api.updateTopic(topicId, { status: next as any });
    await loadCourse();
  };

  if (!activeCourseId || academicTree.courses.length === 0) {
    return (
      <div className="flex-1 p-6 md:p-10 flex items-center justify-center">
        <EmptyState
          icon="bx-layout"
          title="No active course selected"
          description="Create or select a university course to launch the 3-pane Course Workspace."
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

  return (
    <div className="flex-1 flex flex-col h-screen min-w-0">
      {/* Top Course Workspace Bar */}
      <div className="h-12 px-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <select
            value={activeCourseId}
            onChange={(e) => setActiveCourseId(e.target.value)}
            className="px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold outline-none max-w-[230px]"
          >
            {academicTree.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.title}
              </option>
            ))}
          </select>

          {/* Center Pane Switcher */}
          <div className="flex items-center bg-[var(--bg-elevated)] p-0.5 rounded-lg border border-[var(--border-subtle)] text-xs">
            {(
              [
                { id: "overview", label: "Overview" },
                { id: "chat", label: "Chat" },
                { id: "document", label: "Document" },
                { id: "quiz", label: "Quiz & Cards" },
                { id: "code", label: "Code" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setCenterTab(t.id)}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  centerTab === t.id
                    ? "bg-[var(--bg-surface)] text-[var(--accent-blue)] font-semibold"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setMobileSheet(mobileSheet === "files" ? "none" : "files")}
            className="lg:hidden px-2 py-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[11px] font-semibold cursor-pointer"
          >
            Files
          </button>
          <button
            type="button"
            onClick={() => setMobileSheet(mobileSheet === "bhai" ? "none" : "bhai")}
            className="xl:hidden px-2 py-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[11px] font-semibold text-[var(--accent-blue)] cursor-pointer"
          >
            Modes
          </button>
          <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono text-[var(--text-muted)]">
            <span>{detail?.topics.filter((t) => t.status === "mastered").length || 0}/{detail?.topics.length || 0} chapters</span>
            <span>·</span>
            <span>{detail?.documents.length || 0} files</span>
          </div>
        </div>
      </div>

      {mobileSheet === "files" && (
        <div className="lg:hidden border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 max-h-60 overflow-y-auto space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>Course Chapters & Files</span>
            <label className="text-[var(--accent-blue)] cursor-pointer">
              + Upload
              <input type="file" multiple className="hidden" onChange={handleUploadToCourse} />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(detail?.documents || []).map((doc: StudyDocument) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => {
                  setActiveDoc(doc);
                  setCenterTab("document");
                  setMobileSheet("none");
                }}
                className="px-2 py-1 rounded-md bg-[var(--bg-elevated)] text-xs cursor-pointer"
              >
                {doc.original_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {mobileSheet === "bhai" && (
        <div className="xl:hidden border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {AGENT_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setAgentMode(m.id)}
                className={`px-2 py-1 rounded-md text-[11px] border cursor-pointer ${
                  agentMode === m.id
                    ? "border-[var(--accent-blue)] bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-3">
          <ErrorState message={error} onRetry={loadCourse} />
        </div>
      )}

      {/* 3-Pane Resizable Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* LEFT PANE: Chapters, Files & Assignments */}
        <aside
          style={{ width: leftWidth }}
          className="hidden lg:flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 shrink-0 overflow-y-auto p-3 space-y-4"
        >
          {loading && !detail ? (
            <LoadingState label="Loading course…" />
          ) : (
            <>
              {/* Chapters */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <span>Chapters ({detail?.topics.length || 0})</span>
                </div>
                <form onSubmit={handleAddTopic} className="flex gap-1">
                  <input
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    placeholder="Add chapter…"
                    className="flex-1 px-2 py-1 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs outline-none"
                  />
                  <button type="submit" className="px-2 rounded-md bg-[var(--accent-blue)] text-white text-xs cursor-pointer">
                    +
                  </button>
                </form>
                <div className="space-y-1">
                  {(detail?.topics || []).map((topic) => (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => cycleTopicStatus(topic.id, topic.status)}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-elevated)] text-left text-xs cursor-pointer"
                      title="Click to cycle status (Not started / In progress / Mastered)"
                    >
                      <span className="truncate">{topic.title}</span>
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          topic.status === "mastered"
                            ? "bg-emerald-400"
                            : topic.status === "in_progress"
                            ? "bg-amber-400"
                            : "bg-[var(--border-subtle)]"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Uploaded Course Files */}
              <div className="space-y-2 pt-3 border-t border-[var(--border-subtle)]">
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <span>Course Files ({detail?.documents.length || 0})</span>
                  <label className="text-[var(--accent-blue)] cursor-pointer hover:underline normal-case font-semibold">
                    + Upload
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleUploadToCourse}
                    />
                  </label>
                </div>
                <div className="space-y-1">
                  {(detail?.documents || []).length === 0 ? (
                    <p className="text-[11px] text-[var(--text-muted)]">No files in this course yet.</p>
                  ) : (
                    (detail?.documents || []).map((doc: StudyDocument) => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => {
                          setActiveDoc(doc);
                          setCenterTab("document");
                        }}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs cursor-pointer ${
                          activeDoc?.id === doc.id
                            ? "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] font-medium"
                            : "hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
                        }`}
                      >
                        <i className="bx bx-file text-sm shrink-0" />
                        <span className="truncate">{doc.original_name}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </aside>

        {/* Left Resize Handle */}
        <div
          onMouseDown={(e) => {
            const startX = e.clientX;
            const startW = leftWidth;
            const onMove = (ev: MouseEvent) =>
              setLeftWidth(Math.max(190, Math.min(360, startW + ev.clientX - startX)));
            const onUp = () => {
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
          className="hidden lg:block w-1 cursor-col-resize hover:bg-[var(--accent-blue)]/50 transition shrink-0"
        />

        {/* CENTER PANE: Context-Preserving Workspace */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-[var(--bg-base)]">
          {centerTab === "chat" && <ChatView courseIdOverride={activeCourseId} />}
          {centerTab === "quiz" && <StudyStudioView courseIdOverride={activeCourseId} />}
          {centerTab === "code" && <CodeLabView />}
          {centerTab === "overview" && detail && (
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <Panel
                title={`${detail.code} — ${detail.title}`}
                subtitle={detail.instructor ? `Instructor: ${detail.instructor}` : `${detail.credits} credits`}
                actions={
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={bhaiBusy}
                      onClick={async () => {
                        setBhaiBusy(true);
                        try {
                          const [rm, sch] = await Promise.all([
                            api.courseRoadmap(detail.id, activeModel, language),
                            api.revisionSchedule(detail.id, 2, 7, false),
                          ]);
                          setRoadmap(rm);
                          setSchedule(sch.days);
                        } finally {
                          setBhaiBusy(false);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      {bhaiBusy ? "Planning…" : "Teach Me This Course"}
                    </button>
                  </div>
                }
              >
                <div className="space-y-3 text-xs text-[var(--text-secondary)]">
                  <p>{detail.description || "Use the chapter checklist on the left and upload lecture slides/notes to build your course knowledge base."}</p>
                  <div className="grid sm:grid-cols-3 gap-3 pt-2">
                    <div className="p-3 rounded-lg bg-[var(--bg-elevated)]">
                      <div className="text-[var(--text-muted)]">Chapters</div>
                      <div className="text-lg font-mono font-bold mt-0.5">{detail.topics.length}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--bg-elevated)]">
                      <div className="text-[var(--text-muted)]">Documents</div>
                      <div className="text-lg font-mono font-bold mt-0.5">{detail.documents.length}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--bg-elevated)]">
                      <div className="text-[var(--text-muted)]">Pending Tasks</div>
                      <div className="text-lg font-mono font-bold mt-0.5">
                        {detail.tasks.filter((t) => !t.completed).length}
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>

              {roadmap && (
                <Panel
                  title="Bhai Course Roadmap & Weak-Topic Analysis"
                  subtitle={`Generated via ${roadmap.model_used}`}
                >
                  <div className="space-y-3">
                    <p className="text-xs text-[var(--text-primary)] leading-relaxed">{roadmap.overview}</p>
                    <div className="space-y-1.5">
                      {roadmap.steps.map((st) => (
                        <div
                          key={st.topic_id}
                          className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[var(--bg-elevated)] text-xs"
                        >
                          <span className="font-medium truncate">
                            {st.chapter_index}. {st.title}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge tone={st.has_materials ? "emerald" : "amber"}>
                              {st.has_materials ? "Notes Ready" : "Missing Notes"}
                            </Badge>
                            <Badge tone="neutral">{st.reasons[0]}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Panel>
              )}

              {schedule.length > 0 && (
                <Panel
                  title="7-Day Revision Schedule"
                  actions={
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await api.revisionSchedule(detail.id, 2, 7, true);
                        await refreshTasks();
                        pushNotification(`Saved ${res.saved_tasks} revision tasks to Assignments.`);
                      }}
                      className="px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-semibold cursor-pointer"
                    >
                      Save Top 3 to Tasks
                    </button>
                  }
                >
                  <div className="space-y-1.5">
                    {schedule.map((d) => (
                      <div
                        key={d.day}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[var(--bg-elevated)] text-xs"
                      >
                        <div>
                          <span className="font-mono text-[var(--accent-blue)] mr-2">{d.date}</span>
                          <span className="font-medium">{d.topic}</span>
                        </div>
                        <span className="text-[11px] text-[var(--text-muted)] shrink-0">
                          {d.hours}h · {d.focus}
                        </span>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}
            </div>
          )}
          {centerTab === "document" && (
            <div className="flex-1 overflow-y-auto p-5">
              {!activeDoc ? (
                <EmptyState
                  icon="bx-file"
                  title="Select a file from Course Files"
                  description="Choose any PDF, DOCX, code file, or scanned image in the left pane to inspect it here."
                />
              ) : (
                <Panel
                  title={activeDoc.original_name}
                  subtitle={`${activeDoc.page_count} pages · ${activeDoc.file_type || activeDoc.pipeline}`}
                  actions={
                    <button
                      type="button"
                      onClick={() => setCenterTab("chat")}
                      className="px-3 py-1 rounded-lg bg-[var(--accent-blue)] text-white text-xs font-semibold cursor-pointer"
                    >
                      Ask Bhai About This →
                    </button>
                  }
                >
                  {activeDoc.mime_type.startsWith("image/") ? (
                    <img
                      src={`/api/documents/${activeDoc.id}/file`}
                      alt={activeDoc.original_name}
                      className="max-h-[70vh] mx-auto rounded-lg border border-[var(--border-subtle)]"
                    />
                  ) : activeDoc.file_type === "pdf" || activeDoc.mime_type === "application/pdf" ? (
                    <iframe
                      title={activeDoc.original_name}
                      src={`/api/documents/${activeDoc.id}/file`}
                      className="w-full h-[70vh] rounded-lg border border-[var(--border-subtle)] bg-white"
                    />
                  ) : (
                    <pre className="p-4 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] text-xs font-mono whitespace-pre-wrap max-h-[70vh] overflow-auto">
                      {docContent || activeDoc.summary}
                    </pre>
                  )}
                </Panel>
              )}
            </div>
          )}
        </div>

        {/* Right Resize Handle */}
        <div
          onMouseDown={(e) => {
            const startX = e.clientX;
            const startW = rightWidth;
            const onMove = (ev: MouseEvent) =>
              setRightWidth(Math.max(220, Math.min(380, startW - (ev.clientX - startX))));
            const onUp = () => {
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
          className="hidden xl:block w-1 cursor-col-resize hover:bg-[var(--accent-blue)]/50 transition shrink-0"
        />

        {/* RIGHT PANE: Bhai Companion Controls & Grounding */}
        <aside
          style={{ width: rightWidth }}
          className="hidden xl:flex flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 shrink-0 overflow-y-auto p-3.5 space-y-4"
        >
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Bhai Agent Mode
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {AGENT_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setAgentMode(m.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium text-left transition cursor-pointer ${
                    agentMode === m.id
                      ? "border-[var(--accent-blue)] bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
                  }`}
                >
                  <i className={`bx ${m.icon} text-xs shrink-0`} />
                  <span className="truncate">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-[var(--border-subtle)]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Grounding Policy
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setAnswerPolicy("source_only")}
                className={`py-1.5 rounded-lg border font-semibold cursor-pointer ${
                  answerPolicy === "source_only"
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                    : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                }`}
              >
                Source-Only
              </button>
              <button
                type="button"
                onClick={() => setAnswerPolicy("balanced")}
                className={`py-1.5 rounded-lg border font-semibold cursor-pointer ${
                  answerPolicy === "balanced"
                    ? "border-[var(--accent-blue)]/40 bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                }`}
              >
                Balanced
              </button>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              {answerPolicy === "source_only"
                ? "Answers strictly from your uploaded course files; refuses if evidence is missing."
                : "Combines uploaded course notes with general academic knowledge."}
            </p>
          </div>

          <div className="space-y-2 pt-3 border-t border-[var(--border-subtle)]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Course Readiness Metrics
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Chapters Mastered</span>
                <Badge tone="emerald">
                  {detail?.topics.filter((t) => t.status === "mastered").length || 0} / {detail?.topics.length || 0}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Indexed Sources</span>
                <Badge tone="blue">{detail?.documents.length || 0}</Badge>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
