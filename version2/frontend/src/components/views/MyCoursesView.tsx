import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../lib/api";
import { Badge, EmptyState, PageHeader, Panel } from "../ui/Primitives";

export const MyCoursesView: React.FC = () => {
  const {
    academicTree,
    refreshAcademics,
    activeCourseId,
    setActiveCourseId,
    setView,
    pushNotification,
  } = useApp();

  const [showCreator, setShowCreator] = useState(false);
  const [showSemCreator, setShowSemCreator] = useState(false);
  const [uniName, setUniName] = useState("");
  const [deptName, setDeptName] = useState("Computer Science & Engineering");
  const [semName, setSemName] = useState("Fall 2026");
  const [selectedSemId, setSelectedSemId] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [instructor, setInstructor] = useState("");
  const [credits, setCredits] = useState("3");
  const [syllabus, setSyllabus] = useState("");
  const [busy, setBusy] = useState(false);

  const ensureDept = async (): Promise<string> => {
    if (academicTree.departments[0]) return academicTree.departments[0].id;
    let uniId = academicTree.universities[0]?.id;
    if (!uniId) {
      const u = (await api.createUniversity(uniName.trim() || "My University")) as { id: string };
      uniId = u.id;
    }
    const d = (await api.createDepartment(uniId, deptName.trim() || "CSE", "CSE")) as { id: string };
    return d.id;
  };

  const handleCreateSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!semName.trim()) return;
    setBusy(true);
    try {
      const deptId = await ensureDept();
      const created = (await api.createSemester(deptId, semName.trim())) as { id: string; name: string };
      await refreshAcademics();
      setSelectedSemId(created.id);
      setShowSemCreator(false);
      pushNotification(`Created semester "${semName.trim()}"`);
    } catch (err) {
      pushNotification(`Semester error: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSample = async () => {
    setBusy(true);
    try {
      const res = await api.sampleSetup();
      await refreshAcademics();
      pushNotification(res.message);
    } catch (err) {
      pushNotification(`Sample setup failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode.trim() || !courseTitle.trim()) return;
    setBusy(true);
    try {
      let semesterId = selectedSemId || academicTree.semesters[0]?.id;
      if (!semesterId) {
        const deptId = await ensureDept();
        const s = (await api.createSemester(deptId, semName.trim() || "Current Semester")) as { id: string };
        semesterId = s.id;
      }

      const created = await api.createCourse({
        semester_id: semesterId,
        code: courseCode.trim(),
        title: courseTitle.trim(),
        instructor: instructor.trim(),
        credits: Number(credits) || 3,
        syllabus,
      });
      setCourseCode("");
      setCourseTitle("");
      setInstructor("");
      setSyllabus("");
      setShowCreator(false);
      await refreshAcademics();
      setActiveCourseId(created.id);
      pushNotification(`Created ${created.code} — ${created.title}`);
    } catch (err) {
      pushNotification(`Create failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 md:p-7">
      <div className="max-w-6xl mx-auto space-y-5">
        <PageHeader
          icon="bx-buildings"
          title="My Courses & Academic Structure"
          subtitle="Organize semesters, syllabi, lecture materials, and course-scoped AI tutors."
          badge={<Badge tone="blue">{academicTree.courses.length} courses</Badge>}
          actions={
            <>
              {academicTree.courses.length === 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSample}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-emerald-400 text-xs font-semibold text-emerald-400 cursor-pointer"
                >
                  Load Sample CS Semester
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowSemCreator(!showSemCreator);
                  setShowCreator(false);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--accent-blue)] text-xs font-semibold cursor-pointer"
              >
                <i className="bx bx-calendar-plus text-sm" /> New Semester
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreator(!showCreator);
                  setShowSemCreator(false);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white text-xs font-semibold cursor-pointer"
              >
                <i className="bx bx-plus text-sm" /> Add Course
              </button>
            </>
          }
        />

        {showSemCreator && (
          <Panel title="Create Semester" subtitle="Add a new academic term (e.g. Spring 2027) under your university.">
            <form onSubmit={handleCreateSemester} className="grid sm:grid-cols-4 gap-2.5">
              {academicTree.universities.length === 0 && (
                <>
                  <input
                    value={uniName}
                    onChange={(e) => setUniName(e.target.value)}
                    placeholder="University name"
                    className="px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs outline-none"
                  />
                  <input
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    placeholder="Department"
                    className="px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs outline-none"
                  />
                </>
              )}
              <input
                required
                value={semName}
                onChange={(e) => setSemName(e.target.value)}
                placeholder="Semester name (e.g. Spring 2027)"
                className="px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs outline-none focus:border-[var(--accent-blue)]"
              />
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-[var(--accent-blue)] text-white text-xs font-semibold cursor-pointer"
              >
                Save Semester
              </button>
            </form>
          </Panel>
        )}

        {showCreator && (
          <Panel
            title="Create University Course"
            subtitle="Paste syllabus topics (one per line) and BhaiOS will create your chapters automatically."
          >
            <form onSubmit={handleCreateCourse} className="space-y-3">
              {academicTree.semesters.length > 0 ? (
                <div>
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1">Semester</label>
                  <select
                    value={selectedSemId || academicTree.semesters[0]?.id}
                    onChange={(e) => setSelectedSemId(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
                  >
                    {academicTree.semesters.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid sm:grid-cols-3 gap-2.5">
                  <input
                    value={uniName}
                    onChange={(e) => setUniName(e.target.value)}
                    placeholder="University name"
                    className="px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs outline-none"
                  />
                  <input
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    placeholder="Department (e.g. CSE)"
                    className="px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs outline-none"
                  />
                  <input
                    value={semName}
                    onChange={(e) => setSemName(e.target.value)}
                    placeholder="Semester (e.g. Fall 2026)"
                    className="px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs outline-none"
                  />
                </div>
              )}

              <div className="grid sm:grid-cols-4 gap-2.5">
                <input
                  required
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  placeholder="Course Code (e.g. CSE-101)"
                  className="px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-mono outline-none focus:border-[var(--accent-blue)]"
                />
                <input
                  required
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  placeholder="Course Title (e.g. Structured Programming)"
                  className="sm:col-span-2 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs outline-none focus:border-[var(--accent-blue)]"
                />
                <input
                  value={instructor}
                  onChange={(e) => setInstructor(e.target.value)}
                  placeholder="Instructor (optional)"
                  className="px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs outline-none"
                />
              </div>

              <div className="grid sm:grid-cols-4 gap-2.5">
                <input
                  type="number"
                  step="0.5"
                  value={credits}
                  onChange={(e) => setCredits(e.target.value)}
                  placeholder="Credits"
                  className="px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs outline-none"
                />
                <textarea
                  rows={3}
                  value={syllabus}
                  onChange={(e) => setSyllabus(e.target.value)}
                  placeholder="Syllabus chapters (one per line)…"
                  className="sm:col-span-3 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs outline-none focus:border-[var(--accent-blue)]"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreator(false)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {busy ? "Creating…" : "Create Course"}
                </button>
              </div>
            </form>
          </Panel>
        )}

        {academicTree.universities.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <Badge tone="neutral">
              <i className="bx bx-buildings text-xs" />
              {academicTree.universities[0]?.name}
            </Badge>
            {academicTree.departments[0] && (
              <Badge tone="neutral">{academicTree.departments[0].name}</Badge>
            )}
            {academicTree.semesters.map((s) => (
              <Badge key={s.id} tone={s.is_active ? "emerald" : "neutral"}>
                {s.name}
              </Badge>
            ))}
          </div>
        )}

        {academicTree.courses.length === 0 ? (
          <EmptyState
            icon="bx-book-open"
            title="No university courses configured yet"
            description="Create your semester and courses, or load the optional sample CS semester to explore the 3-pane Course Workspace."
            action={
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreator(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white text-xs font-semibold cursor-pointer"
                >
                  Add First Course
                </button>
                <button
                  type="button"
                  onClick={handleSample}
                  className="px-3.5 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs font-semibold cursor-pointer"
                >
                  Load Sample CS Courses
                </button>
              </div>
            }
          />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {academicTree.courses.map((course) => {
              const isActive = course.id === activeCourseId;
              return (
                <div
                  key={course.id}
                  onClick={() => {
                    setActiveCourseId(course.id);
                    setView("workspace");
                  }}
                  className={`rounded-xl border p-4 transition cursor-pointer flex flex-col justify-between gap-4 ${
                    isActive
                      ? "border-[var(--accent-blue)] bg-[var(--accent-blue)]/5"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)]"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="blue" className="font-mono">
                        {course.code}
                      </Badge>
                      <span className="text-[11px] font-mono text-[var(--text-muted)]">
                        {course.credits} cr
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold leading-snug">{course.title}</h3>
                    {course.instructor && (
                      <p className="text-xs text-[var(--text-muted)]">{course.instructor}</p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                    <div className="flex items-center gap-3 font-mono">
                      <span>{course.topic_count || 0} ch</span>
                      <span>{course.doc_count || 0} docs</span>
                      <span>{course.pending_tasks || 0} tasks</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await api.deleteCourse(course.id);
                          await refreshAcademics();
                        }}
                        className="p-1 rounded hover:text-red-400 text-[var(--text-muted)] cursor-pointer"
                        title="Delete course"
                      >
                        <i className="bx bx-trash text-xs" />
                      </button>
                      <span className="text-[var(--accent-blue)] font-semibold">Open →</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
