import React, { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../lib/api";

export const RightPanel: React.FC = () => {
  const {
    t,
    activeDoc,
    setActiveDoc,
    tasks,
    refreshTasks,
    refreshDocuments,
    visionModel,
    notifications,
    pushNotification,
  } = useApp();

  const [tab, setTab] = useState<"companion" | "schedule">("schedule");
  const [clock, setClock] = useState(() => new Date());
  const [presetMins, setPresetMins] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [quickTask, setQuickTask] = useState("");
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          api.logFocusSession(presetMins, "General").catch(() => {});
          pushNotification(`Completed ${presetMins}m focus session!`);
          return presetMins * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, presetMins, pushNotification]);

  const selectPreset = (mins: number) => {
    setRunning(false);
    setPresetMins(mins);
    setSecondsLeft(mins * 60);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const doc = await api.uploadDocument(
        file,
        file.type.startsWith("image/") ? "vlm" : "ocr",
        visionModel
      );
      setActiveDoc(doc);
      setTab("companion");
      await refreshDocuments();
      pushNotification(`Uploaded ${doc.original_name}`);
    } catch (err) {
      pushNotification(`Upload error: ${(err as Error).message}`);
    }
    e.target.value = "";
  };

  const addQuickTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTask.trim()) return;
    await api.createTask({ title: quickTask.trim(), subject: "General", priority: "medium" });
    setQuickTask("");
    await refreshTasks();
  };

  const toggleTask = async (id: string, completed: boolean) => {
    await api.updateTask(id, { completed: !completed });
    await refreshTasks();
  };

  return (
    <>
      <aside className="hidden xl:flex w-[300px] h-screen flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0">
        <div className="flex border-b border-[var(--border-subtle)] p-2 gap-1">
          <button
            type="button"
            onClick={() => setTab("schedule")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              tab === "schedule"
                ? "bg-[var(--bg-elevated)] text-[var(--accent-blue)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t("studySchedule")}
          </button>
          <button
            type="button"
            onClick={() => setTab("companion")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              tab === "companion"
                ? "bg-[var(--bg-elevated)] text-[var(--accent-blue)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t("docCompanion")}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
          {tab === "companion" ? (
            <div className="space-y-3">
              {!activeDoc ? (
                <label className="flex flex-col items-center justify-center text-center p-6 rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 hover:border-[var(--accent-blue)] transition cursor-pointer">
                  <i className="bx bx-cloud-upload text-3xl text-[var(--accent-blue)] mb-2" />
                  <div className="text-sm font-semibold">{t("noActiveDoc")}</div>
                  <p className="text-xs text-[var(--text-muted)] mt-1">{t("dropNoteHere")}</p>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
                    className="hidden"
                    onChange={handleQuickUpload}
                  />
                </label>
              ) : (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{activeDoc.original_name}</div>
                      <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">
                        PAGE 1 OF {activeDoc.page_count} · {activeDoc.pipeline}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setZoomOpen(true)}
                      className="p-1.5 rounded-lg bg-[var(--bg-surface)] hover:text-[var(--accent-blue)] cursor-pointer"
                      title="Fullscreen inspection"
                    >
                      <i className="bx bx-expand text-sm" />
                    </button>
                  </div>

                  {activeDoc.mime_type.startsWith("image/") ? (
                    <img
                      src={`/api/documents/${activeDoc.id}/file`}
                      alt={activeDoc.original_name}
                      className="w-full max-h-56 object-contain rounded-xl border border-[var(--border-subtle)] bg-black/20"
                    />
                  ) : (
                    <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] max-h-52 overflow-y-auto whitespace-pre-wrap">
                      {activeDoc.summary || "Indexed for local RAG retrieval."}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <i className="bx bx-file text-xs" /> RAG Indexed
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveDoc(null)}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold flex items-center gap-1.5 text-[var(--text-secondary)]">
                    <i className="bx bx-time-five text-sm text-[var(--accent-blue)]" />
                    {t("focusTimer")}
                  </span>
                  <span className="text-xs font-mono text-[var(--text-muted)]">
                    {clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <div className="text-3xl font-mono font-bold text-center tracking-tight py-1">
                  {mm}:{ss}
                </div>

                <div className="grid grid-cols-4 gap-1">
                  {[15, 25, 45, 60].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => selectPreset(m)}
                      className={`py-1 rounded-lg text-[11px] font-mono font-semibold cursor-pointer ${
                        presetMins === m
                          ? "bg-[var(--accent-blue)] text-white"
                          : "bg-[var(--bg-surface)] text-[var(--text-muted)]"
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRunning(!running)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-[var(--accent-blue)] text-white text-xs font-semibold cursor-pointer"
                  >
                    <i className={`bx ${running ? "bx-pause" : "bx-play"} text-base`} />
                    {running ? "Pause" : "Start Focus"}
                  </button>
                  <button
                    type="button"
                    onClick={() => selectPreset(presetMins)}
                    className="p-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)] cursor-pointer"
                    title="Reset timer"
                  >
                    <i className="bx bx-reset text-sm" />
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 space-y-2.5">
                <div className="text-xs font-semibold text-[var(--text-secondary)]">
                  {t("quickTasks")} ({tasks.filter((x) => !x.completed).length})
                </div>

                <form onSubmit={addQuickTask} className="flex gap-1.5">
                  <input
                    value={quickTask}
                    onChange={(e) => setQuickTask(e.target.value)}
                    placeholder="Add study task…"
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs outline-none focus:border-[var(--accent-blue)]"
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 rounded-lg bg-[var(--accent-blue)] text-white cursor-pointer flex items-center justify-center"
                  >
                    <i className="bx bx-plus text-sm" />
                  </button>
                </form>

                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {tasks.slice(0, 6).map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => toggleTask(task.id, task.completed)}
                      className="w-full flex items-center gap-2 text-left text-xs py-1 hover:opacity-80 cursor-pointer"
                    >
                      <i
                        className={`bx ${
                          task.completed
                            ? "bx-check-circle text-emerald-400"
                            : "bx-circle text-[var(--text-muted)]"
                        } text-sm shrink-0`}
                      />
                      <span
                        className={`truncate ${
                          task.completed ? "line-through text-[var(--text-muted)]" : ""
                        }`}
                      >
                        {task.title}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1.5">
                    <i className="bx bx-bell text-sm text-amber-400" />
                    {t("offlineReminders")}
                  </span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {notifications.slice(0, 4).map((n) => (
                    <div
                      key={n.id}
                      className="p-2 rounded-lg bg-[var(--bg-surface)] text-[11px] text-[var(--text-secondary)]"
                    >
                      <div>{n.text}</div>
                      <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                        {n.time}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </aside>

      {zoomOpen && activeDoc && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
          onClick={() => setZoomOpen(false)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-sm">{activeDoc.original_name}</span>
              <button
                type="button"
                onClick={() => setZoomOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"
              >
                <i className="bx bx-x text-lg" />
              </button>
            </div>
            {activeDoc.mime_type.startsWith("image/") ? (
              <img
                src={`/api/documents/${activeDoc.id}/file`}
                alt={activeDoc.original_name}
                className="w-full rounded-xl"
              />
            ) : (
              <pre className="text-xs whitespace-pre-wrap p-4 rounded-xl bg-[var(--bg-base)]">
                {activeDoc.summary}
              </pre>
            )}
          </div>
        </div>
      )}
    </>
  );
};
