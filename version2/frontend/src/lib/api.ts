import type {
  AcademicTree,
  AnalyticsData,
  BenchmarkRun,
  ChatSession,
  Citation,
  Course,
  CourseDetail,
  CourseTopic,
  DocumentAsset,
  DocumentChunk,
  Flashcard,
  FocusSession,
  HealthTelemetry,
  IngestionJob,
  InstalledModel,
  KnowledgeEdge,
  KnowledgeGraphData,
  LectureTranscript,
  QuizSession,
  StudyDocument,
  StudyResource,
  StudyTask,
  SuggestedModel,
} from "../types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || `HTTP ${resp.status}`);
  }
  return resp.json() as Promise<T>;
}

export const api = {
  health: () => request<HealthTelemetry>("/api/health"),
  getSettings: () =>
    request<{ has_google_api_key: boolean; google_api_key_masked: string }>("/api/settings"),
  saveSettings: (google_api_key: string) =>
    request<{ has_google_api_key: boolean; google_api_key_masked: string }>("/api/settings", {
      method: "POST",
      body: JSON.stringify({ google_api_key }),
    }),
  exportWorkspace: async () => {
    const resp = await fetch("/api/settings/export");
    if (!resp.ok) throw new Error(await resp.text());
    return resp.blob();
  },
  resetWorkspace: (confirm: string) =>
    request<{ reset: boolean }>("/api/settings/reset-workspace", {
      method: "POST",
      body: JSON.stringify({ confirm }),
    }),

  models: () =>
    request<{ ollama_online: boolean; installed: InstalledModel[]; suggested: SuggestedModel[] }>(
      "/api/models"
    ),
  deleteModel: (name: string) =>
    request<{ deleted: string }>(`/api/models/${encodeURIComponent(name)}`, { method: "DELETE" }),

  // Academics
  academicTree: () => request<AcademicTree>("/api/academics/tree"),
  sampleSetup: () => request<{ created: boolean; message: string }>("/api/academics/sample-setup", { method: "POST" }),
  createUniversity: (name: string, short_name = "") =>
    request("/api/academics/universities", { method: "POST", body: JSON.stringify({ name, short_name }) }),
  createDepartment: (university_id: string, name: string, code = "") =>
    request("/api/academics/departments", { method: "POST", body: JSON.stringify({ university_id, name, code }) }),
  createSemester: (department_id: string, name: string, year_label = "2026-2027") =>
    request("/api/academics/semesters", { method: "POST", body: JSON.stringify({ department_id, name, year_label }) }),
  createCourse: (payload: {
    semester_id: string;
    code: string;
    title: string;
    instructor?: string;
    credits?: number;
    syllabus?: string;
    exam_date?: string | null;
  }) => request<Course>("/api/academics/courses", { method: "POST", body: JSON.stringify(payload) }),
  courseDetail: (id: string) => request<CourseDetail>(`/api/academics/courses/${id}`),
  deleteCourse: (id: string) => request(`/api/academics/courses/${id}`, { method: "DELETE" }),
  addTopic: (courseId: string, title: string, chapter_index = 1) =>
    request<CourseTopic>(`/api/academics/courses/${courseId}/topics`, {
      method: "POST",
      body: JSON.stringify({ title, chapter_index }),
    }),
  updateTopic: (topicId: string, payload: Partial<CourseTopic>) =>
    request<CourseTopic>(`/api/academics/topics/${topicId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  // Chats
  chats: () => request<ChatSession[]>("/api/chats"),
  getChat: (id: string) => request<ChatSession>(`/api/chats/${id}`),
  createChat: (payload: { title?: string; subject?: string; mode?: string; model?: string }) =>
    request<ChatSession>("/api/chats", { method: "POST", body: JSON.stringify(payload) }),
  deleteChat: (id: string) => request<{ deleted: string }>(`/api/chats/${id}`, { method: "DELETE" }),
  truncateChat: (chatId: string, messageId: string) =>
    request<{ truncated: boolean }>(`/api/chats/${chatId}/truncate`, {
      method: "POST",
      body: JSON.stringify({ message_id: messageId }),
    }),
  suggestions: (language: string) =>
    request<{ suggestions: string[] }>("/api/suggest", {
      method: "POST",
      body: JSON.stringify({ language }),
    }),
  factCheck: (question: string, answer: string, language: string) =>
    request<{ report: string }>("/api/chat/fact-check", {
      method: "POST",
      body: JSON.stringify({ question, answer, language }),
    }),

  // Documents & Visual Studio
  documents: (courseId?: string, limit = 100, offset = 0) => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (courseId) params.set("course_id", courseId);
    return request<StudyDocument[]>(`/api/documents?${params.toString()}`);
  },
  documentChunks: (id: string) => request<DocumentChunk[]>(`/api/documents/${id}/chunks`),
  documentAssets: (id: string) => request<DocumentAsset[]>(`/api/documents/${id}/assets`),
  documentContent: async (id: string) => {
    const resp = await fetch(`/api/documents/${id}/content`);
    if (!resp.ok) throw new Error(await resp.text());
    return resp.text();
  },
  searchDocuments: (q: string, courseId?: string) =>
    request<Array<{ doc_id: string; filename: string; page_num: number; source_location?: string; content: string; score: number }>>(
      `/api/documents/search?q=${encodeURIComponent(q)}${courseId ? `&course_id=${encodeURIComponent(courseId)}` : ""}`
    ),
  uploadDocument: async (file: File, pipeline: "ocr" | "vlm", visionModel: string, courseId?: string | null) => {
    const form = new FormData();
    form.append("file", file);
    form.append("pipeline", pipeline);
    form.append("vision_model", visionModel);
    if (courseId) form.append("course_id", courseId);
    const resp = await fetch("/api/documents/upload", { method: "POST", body: form });
    if (!resp.ok) throw new Error(await resp.text());
    return resp.json() as Promise<StudyDocument>;
  },
  batchUploadDocuments: async (files: File[], pipeline: "ocr" | "vlm", visionModel: string, courseId?: string | null) => {
    const form = new FormData();
    for (const f of files) form.append("files", f);
    form.append("pipeline", pipeline);
    form.append("vision_model", visionModel);
    if (courseId) form.append("course_id", courseId);
    const resp = await fetch("/api/documents/batch-upload", { method: "POST", body: form });
    if (!resp.ok) throw new Error(await resp.text());
    return resp.json() as Promise<{ queued: number; jobs: IngestionJob[] }>;
  },
  ingestionJobs: (courseId?: string) =>
    request<IngestionJob[]>(courseId ? `/api/documents/jobs?course_id=${encodeURIComponent(courseId)}` : "/api/documents/jobs"),
  retryJob: (jobId: string) => request<IngestionJob>(`/api/documents/jobs/${jobId}/retry`, { method: "POST" }),
  cancelJob: (jobId: string) => request<IngestionJob>(`/api/documents/jobs/${jobId}/cancel`, { method: "POST" }),
  analyzeVisual: (payload: { doc_id: string; task: string; vision_model: string; page_number?: number }) =>
    request<{ doc_id: string; task: string; qr_payloads: string[]; analysis: string }>(
      "/api/documents/analyze-visual",
      { method: "POST", body: JSON.stringify(payload) }
    ),
  deleteDocument: (id: string) =>
    request<{ deleted: string }>(`/api/documents/${id}`, { method: "DELETE" }),

  // Study Studio
  flashcards: (courseId?: string | null) =>
    request<Flashcard[]>(
      courseId ? `/api/study/flashcards?course_id=${encodeURIComponent(courseId)}` : "/api/study/flashcards"
    ),
  createFlashcard: (payload: { course_id?: string | null; front: string; back: string }) =>
    request<Flashcard>("/api/study/flashcards", { method: "POST", body: JSON.stringify(payload) }),
  generateFlashcards: (payload: { course_id?: string | null; topic: string; count: number; model: string }) =>
    request<Flashcard[]>("/api/study/flashcards/generate", { method: "POST", body: JSON.stringify(payload) }),
  reviewFlashcard: (id: string, quality: number) =>
    request<Flashcard>(`/api/study/flashcards/${id}/review`, { method: "POST", body: JSON.stringify({ quality }) }),
  deleteFlashcard: (id: string) => request(`/api/study/flashcards/${id}`, { method: "DELETE" }),
  quizzes: (courseId?: string | null) =>
    request<QuizSession[]>(
      courseId ? `/api/study/quizzes?course_id=${encodeURIComponent(courseId)}` : "/api/study/quizzes"
    ),
  generateQuiz: (payload: { course_id?: string | null; topic: string; difficulty: string; question_type?: string; count: number; model: string }) =>
    request<QuizSession>("/api/study/quizzes/generate", { method: "POST", body: JSON.stringify(payload) }),
  submitQuiz: (quizId: string, answers: Record<string, string>) =>
    request<{ quiz_id: string; score: number; correct: number; total: number; questions: QuizSession["questions"] }>(
      `/api/study/quizzes/${quizId}/submit`,
      { method: "POST", body: JSON.stringify({ answers }) }
    ),
  chapterSummary: (payload: { course_id?: string | null; topic: string; model: string; ui_language: string }) =>
    request<{ topic: string; summary: string; model_used: string; citations: Citation[] }>(
      "/api/study/chapter-summary",
      { method: "POST", body: JSON.stringify(payload) }
    ),

  // Code Lab
  runCode: (payload: { language: string; code: string; stdin?: string }) =>
    request<{ executed: boolean; stdout: string; stderr: string; exit_code: number; mode: string; analysis?: Record<string, unknown> }>(
      "/api/codelab/run",
      { method: "POST", body: JSON.stringify(payload) }
    ),
  mentorCode: (payload: { language: string; code: string; action: string; model: string; ui_language: string }) =>
    request<{ response: string; tokens: number }>("/api/codelab/mentor", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Knowledge Graph
  knowledgeGraph: (courseId: string) =>
    request<KnowledgeGraphData>(`/api/knowledge-graph?course_id=${encodeURIComponent(courseId)}`),
  extractKnowledgeGraph: (course_id: string, model: string) =>
    request<KnowledgeGraphData>("/api/knowledge-graph/extract", {
      method: "POST",
      body: JSON.stringify({ course_id, model }),
    }),
  createKnowledgeEdge: (payload: {
    course_id: string;
    source_label: string;
    target_label: string;
    relation_type: string;
    evidence_excerpt?: string;
  }) =>
    request<KnowledgeEdge>("/api/knowledge-graph/edges", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteKnowledgeEdge: (edgeId: string) =>
    request<{ deleted: string }>(`/api/knowledge-graph/edges/${edgeId}`, { method: "DELETE" }),

  // Lecture Studio
  lectures: (courseId?: string | null) =>
    request<LectureTranscript[]>(
      courseId ? `/api/lectures?course_id=${encodeURIComponent(courseId)}` : "/api/lectures"
    ),
  uploadAnalyzeLecture: async (
    file: File,
    courseId: string | null,
    title: string,
    model: string,
    uiLanguage: string
  ) => {
    const form = new FormData();
    form.append("file", file);
    if (courseId) form.append("course_id", courseId);
    form.append("title", title);
    form.append("model", model);
    form.append("ui_language", uiLanguage);
    const resp = await fetch("/api/lectures/upload-analyze", { method: "POST", body: form });
    if (!resp.ok) throw new Error(await resp.text());
    return resp.json() as Promise<LectureTranscript>;
  },
  deleteLecture: (id: string) => request<{ deleted: string }>(`/api/lectures/${id}`, { method: "DELETE" }),

  // Tasks & Focus
  tasks: (courseId?: string | null) =>
    request<StudyTask[]>(
      courseId ? `/api/tasks?course_id=${encodeURIComponent(courseId)}` : "/api/tasks"
    ),
  createTask: (payload: { title: string; subject: string; due_date?: string | null; priority: string; course_id?: string | null; task_type?: string }) =>
    request<StudyTask>("/api/tasks", { method: "POST", body: JSON.stringify(payload) }),
  updateTask: (id: string, payload: Partial<StudyTask>) =>
    request<StudyTask>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteTask: (id: string) => request<{ deleted: string }>(`/api/tasks/${id}`, { method: "DELETE" }),

  focusSessions: () => request<FocusSession[]>("/api/focus-sessions"),
  logFocusSession: (duration_minutes: number, subject = "General") =>
    request<FocusSession>("/api/focus-sessions", {
      method: "POST",
      body: JSON.stringify({ duration_minutes, subject }),
    }),

  resources: () => request<StudyResource[]>("/api/resources"),
  createResource: (payload: { title: string; subject: string; category: string; content: string }) =>
    request<StudyResource>("/api/resources", { method: "POST", body: JSON.stringify(payload) }),
  deleteResource: (id: string) =>
    request<{ deleted: string }>(`/api/resources/${id}`, { method: "DELETE" }),

  analytics: () => request<AnalyticsData>("/api/analytics"),
  benchmarks: () => request<BenchmarkRun[]>("/api/benchmarks"),
  runBenchmark: (payload: { model: string; pipeline: string; question: string }) =>
    request<BenchmarkRun>("/api/benchmarks/run", { method: "POST", body: JSON.stringify(payload) }),

  transcribe: async (blob: Blob, language: string) => {
    const ext = blob.type.includes("mp4")
      ? "mp4"
      : blob.type.includes("ogg")
      ? "ogg"
      : blob.type.includes("wav")
      ? "wav"
      : "webm";
    const form = new FormData();
    form.append("file", blob, `voice.${ext}`);
    form.append("language", language);
    const resp = await fetch("/api/transcribe", { method: "POST", body: form });
    if (!resp.ok) throw new Error(await resp.text());
    return resp.json() as Promise<{ text: string; language: string; engine?: string }>;
  },

  voiceModels: () =>
    request<{
      active: string;
      models: Array<{
        name: string;
        title: string;
        size: string;
        bangla_quality: string;
        description: string;
        installed: boolean;
        active: boolean;
      }>;
    }>("/api/voice/models"),
  selectVoiceModel: (name: string) =>
    request<{ active: string }>("/api/voice/models/select", { method: "POST", body: JSON.stringify({ name }) }),
  deleteVoiceModel: (name: string) =>
    request<{ deleted: string }>(`/api/voice/models/${encodeURIComponent(name)}`, { method: "DELETE" }),

  ttsModels: () =>
    request<{
      models: Array<{ id: string; title: string; language: string; size: string; description: string; installed: boolean }>;
    }>("/api/tts/models"),

  speak: async (text: string, language: string) => {
    try {
      const resp = await fetch("/api/tts/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language }),
      });
      if (resp.ok) {
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);
        await audio.play();
        return "hf-tts";
      }
    } catch {
      /* fallback below */
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text.slice(0, 500));
      utter.lang = /[\u0980-\u09FF]/.test(text) || language === "bn" ? "bn-BD" : "en-US";
      window.speechSynthesis.speak(utter);
      return "browser-tts";
    }
    throw new Error("No TTS engine available");
  },

  // Bhai Academic Agent
  weakTopics: (courseId: string) =>
    request<{
      course_id: string;
      weak_topics: Array<{
        topic_id: string;
        chapter_index: number;
        title: string;
        status: string;
        priority_score: number;
        has_materials: boolean;
        reasons: string[];
      }>;
    }>(`/api/bhai/weak-topics/${courseId}`),
  courseRoadmap: (course_id: string, model: string, language: string) =>
    request<{
      course_code: string;
      course_title: string;
      model_used: string;
      overview: string;
      missing_material_topics: string[];
      steps: Array<{
        topic_id: string;
        chapter_index: number;
        title: string;
        status: string;
        has_materials: boolean;
        priority_score: number;
        reasons: string[];
      }>;
    }>("/api/bhai/roadmap", { method: "POST", body: JSON.stringify({ course_id, model, language }) }),
  revisionSchedule: (course_id: string, hours_per_day = 2, days_ahead = 7, save_tasks = false) =>
    request<{
      course_code: string;
      days: Array<{ day: number; date: string; topic: string; hours: number; focus: string }>;
      saved_tasks: number;
    }>("/api/bhai/revision-schedule", {
      method: "POST",
      body: JSON.stringify({ course_id, hours_per_day, days_ahead, save_tasks }),
    }),
};
