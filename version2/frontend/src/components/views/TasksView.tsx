import React, { useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../lib/api";

const SUBJECTS = ["Physics", "Chemistry", "Math", "Biology", "ICT", "Bangla", "English", "General"];

export const TasksView: React.FC = () => {
  const { tasks, refreshTasks, academicTree, activeCourseId, pushNotification } = useApp();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Physics");
  const [courseId, setCourseId] = useState<string>(activeCourseId || "");
  const [taskType, setTaskType] = useState<"assignment" | "lab" | "exam" | "revision">("assignment");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [filterCourse, setFilterCourse] = useState<string>("all");

  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const selectedCourse = academicTree.courses.find((c) => c.id === (courseId || activeCourseId));
    await api.createTask({
      title: title.trim(),
      subject: selectedCourse ? selectedCourse.code : subject,
      priority,
      due_date: dueDate || null,
      course_id: courseId || activeCourseId || null,
      task_type: taskType,
    });
    setTitle("");
    await refreshTasks();
  };

  const handleGenerateRevision = async (cid: string) => {
    const res = await api.revisionSchedule(cid, 2, 7, true);
    await refreshTasks();
    pushNotification(`Added ${res.saved_tasks} syllabus-aware revision tasks for ${res.course_code}.`);
  };

  const examCountdowns = useMemo(() => {
    const today = new Date().setHours(0, 0, 0, 0);
    return academicTree.courses
      .filter((c) => c.exam_date)
      .map((c) => {
        const diffDays = Math.ceil((new Date(c.exam_date!).getTime() - today) / 86400000);
        return { course: c, daysLeft: diffDays };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [academicTree.courses]);

  const daysInMonth = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const total = new Date(year, month + 1, 0).getDate();
    const cells: Array<number | null> = Array(firstDay).fill(null);
    for (let d = 1; d <= total; d++) cells.push(d);
    return cells;
  }, [calMonth]);

  const visibleTasks =
    filterCourse === "all" ? tasks : tasks.filter((t) => t.course_id === filterCourse);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">Assignments, Lab Deadlines & Exam Planner</h1>
            <p className="text-xs text-[var(--text-secondary)]">
              Course-linked assignments, lab submissions, exam countdowns, and syllabus-aware revision tasks.
            </p>
          </div>
          {academicTree.courses.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={filterCourse}
                onChange={(e) => setFilterCourse(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
              >
                <option value="all">All Courses</option>
                {academicTree.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.title}
                  </option>
                ))}
              </select>
              {(filterCourse !== "all" || activeCourseId) && (
                <button
                  type="button"
                  onClick={() => handleGenerateRevision(filterCourse !== "all" ? filterCourse : activeCourseId!)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold cursor-pointer"
                >
                  + Syllabus Revision Plan
                </button>
              )}
            </div>
          )}
        </div>

        {/* Upcoming Exam Countdowns */}
        {examCountdowns.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {examCountdowns.map(({ course, daysLeft }) => (
              <div
                key={course.id}
                className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-mono font-semibold text-amber-300">{course.code} Exam</div>
                  <div className="truncate text-[var(--text-primary)]">{course.title}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{course.exam_date}</div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] font-mono font-bold text-amber-400 shrink-0">
                  {daysLeft >= 0 ? `${daysLeft}d` : "Past"}
                </span>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={handleAdd}
          className="grid sm:grid-cols-12 gap-2 p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Assignment, lab report, or exam revision goal…"
            className="sm:col-span-4 px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm outline-none focus:border-[var(--accent-blue)]"
          />
          {academicTree.courses.length > 0 ? (
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="sm:col-span-2 px-2.5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            >
              <option value="">General</option>
              {academicTree.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="sm:col-span-2 px-2.5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          <select
            value={taskType}
            onChange={(e) => setTaskType(e.target.value as any)}
            className="sm:col-span-2 px-2.5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
          >
            <option value="assignment">Assignment</option>
            <option value="lab">Lab</option>
            <option value="exam">Exam</option>
            <option value="revision">Revision</option>
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
            className="sm:col-span-1 px-2 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
          >
            <option value="high">High</option>
            <option value="medium">Med</option>
            <option value="low">Low</option>
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="sm:col-span-2 px-2.5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
          />
          <button
            type="submit"
            className="sm:col-span-1 flex items-center justify-center rounded-xl bg-[var(--accent-blue)] text-white py-2 cursor-pointer"
          >
            <i className="bx bx-plus text-lg" />
          </button>
        </form>

        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-2">
            {visibleTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-8 text-center text-sm text-[var(--text-muted)]">
                No tasks in this view. Add an assignment, lab, or revision task above.
              </div>
            ) : (
              visibleTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
                >
                  <button
                    type="button"
                    onClick={() => api.updateTask(task.id, { completed: !task.completed }).then(refreshTasks)}
                    className="flex items-center gap-3 text-left flex-1 min-w-0 cursor-pointer"
                  >
                    <i
                      className={`bx ${
                        task.completed
                          ? "bx-check-circle text-emerald-400"
                          : "bx-circle text-[var(--text-muted)]"
                      } text-xl shrink-0`}
                    />
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-medium truncate ${
                          task.completed ? "line-through text-[var(--text-muted)]" : ""
                        }`}
                      >
                        {task.title}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {task.subject} · {(task.task_type || "assignment").toUpperCase()}{" "}
                        {task.due_date ? `· Due ${task.due_date}` : ""}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                        task.priority === "high"
                          ? "bg-red-500/15 text-red-400"
                          : task.priority === "medium"
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-slate-500/15 text-slate-400"
                      }`}
                    >
                      {task.priority}
                    </span>
                    <button
                      type="button"
                      onClick={() => api.deleteTask(task.id).then(refreshTasks)}
                      className="p-1.5 rounded-lg hover:text-red-400 text-[var(--text-muted)] cursor-pointer"
                    >
                      <i className="bx bx-trash text-base" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-3 h-fit">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                <i className="bx bx-calendar text-base text-[var(--accent-blue)]" />
                {calMonth.toLocaleString("default", { month: "long", year: "numeric" })}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))
                  }
                  className="p-1 rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"
                >
                  <i className="bx bx-chevron-left text-base" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))
                  }
                  className="p-1 rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"
                >
                  <i className="bx bx-chevron-right text-base" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-[var(--text-muted)]">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {daysInMonth.map((day, idx) => {
                if (!day) return <div key={idx} />;
                const iso = `${calMonth.getFullYear()}-${String(calMonth.getMonth() + 1).padStart(
                  2,
                  "0"
                )}-${String(day).padStart(2, "0")}`;
                const hasTask = visibleTasks.some((t) => t.due_date === iso && !t.completed);
                const isSelected = dueDate === iso;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setDueDate(iso)}
                    className={`py-1.5 rounded-lg font-mono relative cursor-pointer ${
                      isSelected
                        ? "bg-[var(--accent-blue)] text-white font-bold"
                        : "hover:bg-[var(--bg-elevated)]"
                    }`}
                  >
                    {day}
                    {hasTask && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
