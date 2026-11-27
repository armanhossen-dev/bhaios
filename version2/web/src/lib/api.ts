import type {
  ChatMessage,
  ChunkItem,
  Course,
  FileItem,
  FlashcardItem,
  HealthResponse,
  TaskItem,
} from "./types";

const BASE = typeof window !== "undefined" && window.location.port === "3000" ? "http://127.0.0.1:8765" : "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<HealthResponse>("/api/health"),
  onboarding: (body: Record<string, unknown>) =>
    request<{ ok: boolean }>("/api/onboarding", { method: "POST", body: JSON.stringify(body) }),
  semesters: () => request<{ semesters: { id: string; name: string }[]; courses: Course[] }>("/api/semesters"),
  createCourse: (body: Record<string, unknown>) =>
    request<{ course: Course }>("/api/courses", { method: "POST", body: JSON.stringify(body) }),
  deleteCourse: (id: string) => request<{ ok: boolean }>(`/api/courses/${id}`, { method: "DELETE" }),
  files: (courseId = "") =>
    request<{ files: FileItem[] }>(`/api/files${courseId ? `?course_id=${encodeURIComponent(courseId)}` : ""}`),
  fileChunks: (fileId: string, page?: number) =>
    request<{ file: FileItem; chunks: ChunkItem[] }>(
      `/api/files/${fileId}/chunks${page != null ? `?page=${page}` : ""}`
    ),
  uploadFile: async (file: File, courseId = "") => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("course_id", courseId);
    const res = await fetch(`${BASE}/api/files/upload`, { method: "POST", body: fd });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  retryFile: (id: string) => request<{ job_id: string }>(`/api/files/${id}/retry`, { method: "POST" }),
  deleteFile: (id: string) => request<{ ok: boolean }>(`/api/files/${id}`, { method: "DELETE" }),
  ask: (body: Record<string, unknown>) =>
    request<{ reply: string; citations: ChatMessage["citations"]; chat_id: string }>("/api/ask", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  search: (q: string) => request<{ results: ChunkItem[] }>(`/api/search?q=${encodeURIComponent(q)}`),
  flashcards: (courseId = "", dueOnly = false) =>
    request<{ flashcards: FlashcardItem[] }>(
      `/api/flashcards?${courseId ? `course_id=${encodeURIComponent(courseId)}&` : ""}due_only=${dueOnly}`
    ),
  generateFlashcards: (courseId: string) =>
    request<{ created: number }>(`/api/flashcards/generate?course_id=${encodeURIComponent(courseId)}`, {
      method: "POST",
    }),
  reviewFlashcard: (id: string, rating: number) =>
    request(`/api/flashcards/${id}/review`, { method: "POST", body: JSON.stringify({ rating }) }),
  tasks: (courseId = "") =>
    request<{ tasks: TaskItem[] }>(`/api/tasks${courseId ? `?course_id=${encodeURIComponent(courseId)}` : ""}`),
  createTask: (body: Record<string, unknown>) =>
    request<{ task: TaskItem }>("/api/tasks", { method: "POST", body: JSON.stringify(body) }),
  updateTaskStatus: (id: string, status: string) =>
    request(`/api/tasks/${id}?status=${encodeURIComponent(status)}`, { method: "PATCH" }),
  deleteTask: (id: string) => request(`/api/tasks/${id}`, { method: "DELETE" }),
  grades: (courseId: string, targetPct = 80) =>
    request<{
      summary: { earned_pct: number; completed_weight: number; needed_pct_on_remaining: number };
      attendance_stats: { percentage: number; present: number; total: number; can_miss: number };
    }>(`/api/grades/${courseId}?target_pct=${targetPct}`),
  markAttendance: (body: Record<string, unknown>) =>
    request("/api/attendance", { method: "POST", body: JSON.stringify(body) }),
  notes: (courseId = "") =>
    request<{ notes: { id: string; title: string; content: string }[] }>(
      `/api/notes${courseId ? `?course_id=${encodeURIComponent(courseId)}` : ""}`
    ),
  saveNote: (body: Record<string, unknown>) =>
    request("/api/notes", { method: "POST", body: JSON.stringify(body) }),
  saveSettings: (body: Record<string, unknown>) =>
    request("/api/settings", { method: "POST", body: JSON.stringify(body) }),
};
