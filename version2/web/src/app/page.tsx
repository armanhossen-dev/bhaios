"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Moon, Plus, Search, Sun, Upload } from "lucide-react";
import { AskWorkspace } from "@/components/AskWorkspace";
import { SourceDrawer } from "@/components/SourceDrawer";
import { api } from "@/lib/api";
import type {
  ChatMessage,
  ChunkItem,
  Citation,
  Course,
  FileItem,
  FlashcardItem,
  HealthResponse,
  Lang,
  NavTab,
  StudyMode,
  TaskItem,
  Theme,
} from "@/lib/types";

const TABS: { id: NavTab; label: string; bn: string }[] = [
  { id: "today", label: "Today", bn: "আজ" },
  { id: "courses", label: "Courses", bn: "কোর্স" },
  { id: "library", label: "Library", bn: "লাইব্রেরি" },
  { id: "ask", label: "Ask", bn: "জিজ্ঞাসা" },
  { id: "study", label: "Study", bn: "অনুশীলন" },
  { id: "planner", label: "Planner", bn: "প্ল্যানার" },
  { id: "grades", label: "Grades", bn: "গ্রেড" },
  { id: "settings", label: "Settings", bn: "সেটিংস" },
];

export default function HomePage() {
  const [tab, setTab] = useState<NavTab>("today");
  const [theme, setTheme] = useState<Theme>("light");
  const [lang, setLang] = useState<Lang>("en");
  const [activeCourseId, setActiveCourseId] = useState<string>("");

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([]);
  const [cardIdx, setCardIdx] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [askInput, setAskInput] = useState("");
  const [askMode, setAskMode] = useState<StudyMode>("guide");
  const [askScope, setAskScope] = useState<"course" | "all">("course");
  const [askLoading, setAskLoading] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerFile, setDrawerFile] = useState<FileItem | null>(null);
  const [drawerChunks, setDrawerChunks] = useState<ChunkItem[]>([]);
  const [drawerHighlight, setDrawerHighlight] = useState("");

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState<ChunkItem[]>([]);

  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [crsCode, setCrsCode] = useState("");
  const [crsTitle, setCrsTitle] = useState("");
  const [crsCredits, setCrsCredits] = useState("3.0");

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [tskTitle, setTskTitle] = useState("");
  const [tskDue, setTskDue] = useState("");

  const [gradeSummary, setGradeSummary] = useState<{ earned_pct: number; needed_pct_on_remaining: number } | null>(null);
  const [attStats, setAttStats] = useState<{ percentage: number; present: number; total: number; can_miss: number } | null>(null);

  const [focusSecs, setFocusSecs] = useState(25 * 60);
  const [focusRunning, setFocusRunning] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [h, sem, f, t, fc] = await Promise.all([
        api.health(),
        api.semesters(),
        api.files(activeCourseId),
        api.tasks(activeCourseId),
        api.flashcards(activeCourseId, true),
      ]);
      setHealth(h);
      setCourses(sem.courses);
      setFiles(f.files);
      setTasks(t.tasks);
      setFlashcards(fc.flashcards);
    } catch {
      // Backend offline fallback
    }
  }, [activeCourseId]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!focusRunning) return;
    const id = setInterval(() => setFocusSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [focusRunning]);

  useEffect(() => {
    if (tab === "grades" && activeCourseId) {
      api.grades(activeCourseId).then((g) => {
        setGradeSummary(g.summary);
        setAttStats(g.attendance_stats);
      });
    }
  }, [tab, activeCourseId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "Escape") {
        setSearchOpen(false);
        setCourseModalOpen(false);
        setTaskModalOpen(false);
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openSource = async (fileId: string, page: number, passage = "") => {
    setDrawerOpen(true);
    setDrawerHighlight(passage);
    const data = await api.fileChunks(fileId, page);
    setDrawerFile(data.file);
    setDrawerChunks(data.chunks);
  };

  const handleOpenCitation = (c: Citation) => openSource(c.file_id, c.page_or_slide, c.passage);

  const handleUpload = async (list: FileList | null) => {
    if (!list) return;
    for (const file of Array.from(list)) {
      await api.uploadFile(file, activeCourseId);
    }
    await refresh();
  };

  const handleSendAsk = async () => {
    const q = askInput.trim();
    if (!q || askLoading) return;
    setAskInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setAskLoading(true);
    try {
      const res = await api.ask({
        query: q,
        mode: askMode,
        scope: askScope,
        course_id: activeCourseId || null,
        language: lang,
        chat_id: chatId,
      });
      setChatId(res.chat_id);
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply, citations: res.citations }]);
    } finally {
      setAskLoading(false);
    }
  };

  const openTasks = tasks.filter((t) => t.status !== "done");
  const currentCard = flashcards.length ? flashcards[cardIdx % flashcards.length] : null;

  return (
    <div className="web-shell">
      {/* STICKY MINIMAL WEB HEADER */}
      <header className="web-header">
        <div className="web-header-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div className="brand">
              <div className="brand-mark">ভা</div>
              <span>BhaiOS</span>
            </div>

            <nav className="web-nav" aria-label="Primary">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`nav-pill ${tab === t.id ? "active" : ""}`}
                  onClick={() => setTab(t.id)}
                >
                  {lang === "bn" ? t.bn : t.label}
                </button>
              ))}
            </nav>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select
              className="input"
              style={{ height: 32, fontSize: 12.5, maxWidth: 160 }}
              value={activeCourseId}
              onChange={(e) => setActiveCourseId(e.target.value)}
              aria-label="Course filter"
            >
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.title}
                </option>
              ))}
            </select>

            <button className="btn btn-sm" onClick={() => setSearchOpen(true)} type="button" title="Search (⌘K)">
              <Search size={13} />
              <span className="mono" style={{ fontSize: 11 }}>⌘K</span>
            </button>

            <button
              className="btn btn-sm"
              onClick={() => setLang((l) => (l === "en" ? "bn" : "en"))}
              type="button"
            >
              {lang === "en" ? "বাং" : "EN"}
            </button>

            <button
              className="btn btn-sm"
              onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
              type="button"
              aria-label="Toggle theme"
            >
              {theme === "light" ? <Moon size={13} /> : <Sun size={13} />}
            </button>

            <button className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()} type="button">
              <Upload size={13} />
              <span>Add Files</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              multiple
              accept=".pdf,.pptx,.ppt,.docx,.md,.txt,.png,.jpg,.jpeg,.zip"
              onChange={(e) => handleUpload(e.target.files)}
            />
          </div>
        </div>
      </header>

      {/* MAIN WEB CONTAINER */}
      <main className="web-main">
        {tab === "today" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h1 className="serif" style={{ margin: "0 0 4px", fontSize: 28, fontWeight: 600 }}>
                {lang === "bn" ? "আজকের পড়াশোনা" : "Today"}
              </h1>
              <div style={{ color: "var(--text-2)", fontSize: 13.5 }}>
                {health ? `${health.network_policy} · ${health.active_model}` : "Local study workspace"}
              </div>
            </div>

            <div className="grid-3">
              <div className="card">
                <div style={{ fontSize: 12, color: "var(--text-3)" }}>OPEN TASKS</div>
                <div className="mono" style={{ fontSize: 28, fontWeight: 600 }}>{openTasks.length}</div>
              </div>
              <div className="card">
                <div style={{ fontSize: 12, color: "var(--text-3)" }}>CARDS DUE</div>
                <div className="mono" style={{ fontSize: 28, fontWeight: 600 }}>{flashcards.length}</div>
              </div>
              <div className="card">
                <div style={{ fontSize: 12, color: "var(--text-3)" }}>INDEXED FILES</div>
                <div className="mono" style={{ fontSize: 28, fontWeight: 600 }}>
                  {files.filter((f) => f.status === "ready").length}
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>Next up</strong>
                  <button className="btn btn-sm" onClick={() => setTaskModalOpen(true)} type="button">
                    <Plus size={13} /> Task
                  </button>
                </div>
                {openTasks.length === 0 ? (
                  <div style={{ color: "var(--text-3)", fontSize: 13 }}>No pending deadlines.</div>
                ) : (
                  openTasks.slice(0, 5).map((t) => (
                    <div
                      key={t.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                      }}
                    >
                      <span>{t.title}</span>
                      <button
                        className="btn btn-sm"
                        onClick={async () => {
                          await api.updateTaskStatus(t.id, "done");
                          await refresh();
                        }}
                        type="button"
                      >
                        Done
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>Focus session</strong>
                  <span className="mono" style={{ fontSize: 18, fontWeight: 600 }}>
                    {String(Math.floor(focusSecs / 60)).padStart(2, "0")}:{String(focusSecs % 60).padStart(2, "0")}
                  </span>
                </div>
                <div style={{ color: "var(--text-2)", fontSize: 13 }}>
                  Quiet 25-minute Pomodoro timer for deep reading.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => setFocusRunning((r) => !r)} type="button">
                    {focusRunning ? "Pause" : "Start"}
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      setFocusRunning(false);
                      setFocusSecs(25 * 60);
                    }}
                    type="button"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "courses" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 className="serif" style={{ margin: 0, fontSize: 26 }}>Courses</h1>
              <button className="btn btn-primary btn-sm" onClick={() => setCourseModalOpen(true)} type="button">
                <Plus size={13} /> New Course
              </button>
            </div>
            <div className="grid-2">
              {courses.map((c) => (
                <div key={c.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="mono" style={{ fontSize: 12, color: "var(--text-3)" }}>
                    {c.code} · {c.credits} credits
                  </div>
                  <div className="serif" style={{ fontSize: 18, fontWeight: 600 }}>{c.title}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        setActiveCourseId(c.id);
                        setTab("library");
                      }}
                      type="button"
                    >
                      Open Materials
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={async () => {
                        await api.deleteCourse(c.id);
                        await refresh();
                      }}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "library" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 className="serif" style={{ margin: 0, fontSize: 26 }}>Library</h1>
              <button className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()} type="button">
                <Upload size={13} /> Import PDF / PPTX / DOCX / ZIP
              </button>
            </div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-3)", textAlign: "left" }}>
                    <th style={{ padding: "10px 14px" }}>File</th>
                    <th style={{ padding: "10px 14px" }}>Pages</th>
                    <th style={{ padding: "10px 14px" }}>Status</th>
                    <th style={{ padding: "10px 14px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => (
                    <tr key={f.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 500 }}>{f.filename}</td>
                      <td style={{ padding: "10px 14px" }} className="mono">{f.page_count || "—"}</td>
                      <td style={{ padding: "10px 14px" }}>{f.status}</td>
                      <td style={{ padding: "10px 14px", display: "flex", gap: 6 }}>
                        <button className="btn btn-sm" onClick={() => openSource(f.id, 1)} type="button">Inspect</button>
                        <button
                          className="btn btn-sm"
                          onClick={async () => {
                            await api.deleteFile(f.id);
                            await refresh();
                          }}
                          type="button"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "ask" && (
          <AskWorkspace
            messages={messages}
            input={askInput}
            mode={askMode}
            scope={askScope}
            loading={askLoading}
            onInputChange={setAskInput}
            onModeChange={setAskMode}
            onScopeChange={setAskScope}
            onSend={handleSendAsk}
            onOpenCitation={handleOpenCitation}
          />
        )}

        {tab === "study" && (
          <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 className="serif" style={{ margin: 0, fontSize: 26 }}>Flashcards</h1>
              <button
                className="btn btn-primary btn-sm"
                onClick={async () => {
                  if (!activeCourseId) return alert("Select a course first.");
                  await api.generateFlashcards(activeCourseId);
                  await refresh();
                }}
                type="button"
              >
                Generate from Slides
              </button>
            </div>
            {currentCard ? (
              <div className="card" style={{ padding: 32, textAlign: "center", display: "flex", flexDirection: "column", gap: 20 }}>
                <div className="serif" style={{ fontSize: 20 }}>
                  {cardFlipped ? currentCard.back : currentCard.front}
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                  {!cardFlipped ? (
                    <button className="btn btn-primary" onClick={() => setCardFlipped(true)} type="button">
                      Show Answer
                    </button>
                  ) : (
                    [1, 2, 3, 4].map((r) => (
                      <button
                        key={r}
                        className={`btn btn-sm ${r === 3 ? "btn-primary" : ""}`}
                        onClick={async () => {
                          await api.reviewFlashcard(currentCard.id, r);
                          setCardFlipped(false);
                          setCardIdx((i) => i + 1);
                          await refresh();
                        }}
                        type="button"
                      >
                        {["Again", "Hard", "Good", "Easy"][r - 1]}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="card" style={{ textAlign: "center", color: "var(--text-2)" }}>No flashcards due.</div>
            )}
          </div>
        )}

        {tab === "planner" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 className="serif" style={{ margin: 0, fontSize: 26 }}>Planner</h1>
              <div style={{ display: "flex", gap: 8 }}>
                <a className="btn btn-sm" href="/api/planner/export.ics" download="bhaios_schedule.ics">Export .ics</a>
                <button className="btn btn-primary btn-sm" onClick={() => setTaskModalOpen(true)} type="button">
                  <Plus size={13} /> New Task
                </button>
              </div>
            </div>
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tasks.map((t) => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <span>{t.title} <span style={{ color: "var(--text-3)", fontSize: 12 }}>({t.due_date || "No date"})</span></span>
                  <button
                    className="btn btn-sm"
                    onClick={async () => {
                      await api.deleteTask(t.id);
                      await refresh();
                    }}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "grades" && (
          <div className="grid-2">
            <div className="card">
              <h2 className="serif" style={{ marginTop: 0 }}>Grade Summary</h2>
              {gradeSummary ? (
                <div className="mono" style={{ fontSize: 13.5 }}>
                  Earned: {gradeSummary.earned_pct}% · Needed on remaining for 80%: {gradeSummary.needed_pct_on_remaining}%
                </div>
              ) : (
                <div style={{ color: "var(--text-2)" }}>Select a course in the header.</div>
              )}
            </div>
            <div className="card">
              <h2 className="serif" style={{ marginTop: 0 }}>Attendance</h2>
              {attStats ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="mono">{attStats.percentage}% ({attStats.present}/{attStats.total})</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      className="btn btn-sm"
                      onClick={async () => {
                        await api.markAttendance({ course_id: activeCourseId, class_date: new Date().toISOString().slice(0, 10), status: "present" });
                        const g = await api.grades(activeCourseId);
                        setAttStats(g.attendance_stats);
                      }}
                      type="button"
                    >
                      Present
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ color: "var(--text-2)" }}>Select a course in the header.</div>
              )}
            </div>
          </div>
        )}

        {tab === "settings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h1 className="serif" style={{ margin: 0, fontSize: 26 }}>Settings &amp; Local Models</h1>
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Hardware &amp; Offline Status</div>
              <div style={{ color: "var(--text-2)", fontSize: 13 }}>
                {health
                  ? `${health.hardware.os} · ${health.hardware.total_ram_gb} GB RAM · Tier: ${health.hardware.tier} · ${health.network_policy}`
                  : "Scanning…"}
              </div>
            </div>
            {health && (
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-3)", textAlign: "left" }}>
                      <th style={{ padding: "10px 14px" }}>Model</th>
                      <th style={{ padding: "10px 14px" }}>RAM</th>
                      <th style={{ padding: "10px 14px" }}>Speed</th>
                      <th style={{ padding: "10px 14px" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {health.catalog.map((m) => (
                      <tr key={m.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 500 }}>{m.name}</td>
                        <td style={{ padding: "10px 14px" }} className="mono">{m.ram_gb} GB</td>
                        <td style={{ padding: "10px 14px" }} className="mono">{m.est_tok_s}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <button
                            className={`btn btn-sm ${health.active_model === m.id ? "btn-primary" : ""}`}
                            onClick={async () => {
                              await api.saveSettings({ active_model: m.id });
                              await refresh();
                            }}
                            type="button"
                          >
                            {health.active_model === m.id ? "Active" : "Select"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      <SourceDrawer
        open={drawerOpen}
        file={drawerFile}
        chunks={drawerChunks}
        highlightPassage={drawerHighlight}
        onClose={() => setDrawerOpen(false)}
      />

      {searchOpen && (
        <div className="modal-backdrop" onClick={() => setSearchOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <strong>Search across slides &amp; notes</strong>
            <input
              className="input"
              autoFocus
              value={searchQuery}
              onChange={async (e) => {
                const v = e.target.value;
                setSearchQuery(v);
                if (!v.trim()) return setSearchHits([]);
                const r = await api.search(v);
                setSearchHits(r.results);
              }}
              placeholder="Search keywords…"
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
              {searchHits.map((h) => (
                <button
                  key={h.id}
                  className="btn btn-sm"
                  style={{ justifyContent: "flex-start" }}
                  onClick={() => {
                    setSearchOpen(false);
                    openSource(h.file_id, h.page_or_slide, h.content);
                  }}
                  type="button"
                >
                  {h.section_title} (p.{h.page_or_slide})
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {courseModalOpen && (
        <div className="modal-backdrop" onClick={() => setCourseModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <strong>New Course</strong>
            <input className="input" placeholder="Code (e.g. CSE 2201)" value={crsCode} onChange={(e) => setCrsCode(e.target.value)} />
            <input className="input" placeholder="Title (e.g. Data Structures)" value={crsTitle} onChange={(e) => setCrsTitle(e.target.value)} />
            <input className="input" placeholder="Credits" value={crsCredits} onChange={(e) => setCrsCredits(e.target.value)} />
            <button
              className="btn btn-primary"
              onClick={async () => {
                await api.createCourse({ code: crsCode, title: crsTitle, credits: Number(crsCredits || 3) });
                setCourseModalOpen(false);
                setCrsCode("");
                setCrsTitle("");
                await refresh();
              }}
              type="button"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {taskModalOpen && (
        <div className="modal-backdrop" onClick={() => setTaskModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <strong>New Task</strong>
            <input className="input" placeholder="Task title" value={tskTitle} onChange={(e) => setTskTitle(e.target.value)} />
            <input className="input" type="date" value={tskDue} onChange={(e) => setTskDue(e.target.value)} />
            <button
              className="btn btn-primary"
              onClick={async () => {
                await api.createTask({ course_id: activeCourseId || null, title: tskTitle, due_date: tskDue });
                setTaskModalOpen(false);
                setTskTitle("");
                await refresh();
              }}
              type="button"
            >
              Save Task
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
