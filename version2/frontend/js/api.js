export const api = {
  async json(url, opts = {}) {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      ...opts,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  health: () => api.json("/api/health"),
  onboarding: (body) => api.json("/api/onboarding", { method: "POST", body: JSON.stringify(body) }),
  semesters: () => api.json("/api/semesters"),
  createCourse: (body) => api.json("/api/courses", { method: "POST", body: JSON.stringify(body) }),
  deleteCourse: (id) => api.json(`/api/courses/${id}`, { method: "DELETE" }),
  files: (courseId = "") => api.json(`/api/files${courseId ? `?course_id=${encodeURIComponent(courseId)}` : ""}`),
  fileChunks: (fileId, page = null) =>
    api.json(`/api/files/${fileId}/chunks${page != null ? `?page=${page}` : ""}`),
  uploadFile: async (file, courseId = "") => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("course_id", courseId);
    const res = await fetch("/api/files/upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  retryFile: (id) => api.json(`/api/files/${id}/retry`, { method: "POST" }),
  deleteFile: (id) => api.json(`/api/files/${id}`, { method: "DELETE" }),
  jobs: () => api.json("/api/jobs"),
  ask: (body) => api.json("/api/ask", { method: "POST", body: JSON.stringify(body) }),
  search: (q) => api.json(`/api/search?q=${encodeURIComponent(q)}`),
  flashcards: (courseId = "", dueOnly = false) =>
    api.json(`/api/flashcards?${courseId ? `course_id=${courseId}&` : ""}due_only=${dueOnly}`),
  generateFlashcards: (courseId) => api.json(`/api/flashcards/generate?course_id=${encodeURIComponent(courseId)}`, { method: "POST" }),
  reviewFlashcard: (id, rating) => api.json(`/api/flashcards/${id}/review`, { method: "POST", body: JSON.stringify({ rating }) }),
  tasks: (courseId = "") => api.json(`/api/tasks${courseId ? `?course_id=${courseId}` : ""}`),
  createTask: (body) => api.json("/api/tasks", { method: "POST", body: JSON.stringify(body) }),
  updateTaskStatus: (id, status) => api.json(`/api/tasks/${id}?status=${encodeURIComponent(status)}`, { method: "PATCH" }),
  deleteTask: (id) => api.json(`/api/tasks/${id}`, { method: "DELETE" }),
  grades: (courseId, targetPct = 80) => api.json(`/api/grades/${courseId}?target_pct=${targetPct}`),
  addAssessment: (body) => api.json("/api/assessments", { method: "POST", body: JSON.stringify(body) }),
  markAttendance: (body) => api.json("/api/attendance", { method: "POST", body: JSON.stringify(body) }),
  notes: (courseId = "") => api.json(`/api/notes${courseId ? `?course_id=${courseId}` : ""}`),
  saveNote: (body) => api.json("/api/notes", { method: "POST", body: JSON.stringify(body) }),
  saveSettings: (body) => api.json("/api/settings", { method: "POST", body: JSON.stringify(body) }),
};
