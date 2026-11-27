export type Theme = "light" | "dark";
export type Lang = "en" | "bn";
export type NavTab = "today" | "courses" | "library" | "ask" | "study" | "planner" | "grades" | "settings";
export type StudyMode = "guide" | "answer" | "explain_slide" | "exam" | "compare";

export interface Course {
  id: string;
  semester_id: string;
  code: string;
  title: string;
  credits: number;
  teacher?: string;
  room?: string;
  color: string;
  min_attendance_pct: number;
  target_grade: string;
}

export interface FileItem {
  id: string;
  course_id?: string | null;
  filename: string;
  ext: string;
  size_bytes: number;
  page_count: number;
  status: string;
  chunk_count?: number;
  error_msg?: string;
}

export interface ChunkItem {
  id: string;
  file_id: string;
  page_or_slide: number;
  section_title: string;
  content: string;
  language: string;
}

export interface Citation {
  index: number;
  chunk_id: string;
  file_id: string;
  filename: string;
  page_or_slide: number;
  section_title: string;
  passage: string;
  score: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  mode?: StudyMode;
}

export interface TaskItem {
  id: string;
  course_id?: string | null;
  title: string;
  task_type: string;
  due_date: string;
  priority: string;
  status: string;
}

export interface FlashcardItem {
  id: string;
  course_id?: string | null;
  file_id?: string | null;
  page_or_slide?: number | null;
  front: string;
  back: string;
  interval_days: number;
}

export interface HealthResponse {
  status: string;
  version: string;
  network_policy: string;
  active_jobs: number;
  active_model: string;
  hardware: {
    os: string;
    arch: string;
    cpu_cores: number;
    total_ram_gb: number;
    used_ram_gb: number;
    ram_percent: number;
    tier: string;
    recommended_models: string[];
  };
  ollama: {
    online: boolean;
    installed: { name: string; size_gb: number }[];
  };
  catalog: {
    id: string;
    name: string;
    ram_gb: number;
    est_tok_s: string;
    bangla_rating: string;
    vision: boolean;
  }[];
  user: {
    name: string;
    university: string;
    department: string;
    onboarding_completed: number;
  };
}
