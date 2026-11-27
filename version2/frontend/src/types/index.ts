export type ViewId =
  | "home"
  | "courses"
  | "workspace"
  | "chat"
  | "documents"
  | "codelab"
  | "study"
  | "speech"
  | "graph"
  | "models"
  | "tasks"
  | "progress"
  | "resources"
  | "settings";

export type ThemeMode = "system" | "light" | "dark";
export type IntelligenceMode = "auto" | "qwen" | "nemotron" | "lightweight";
export type Language = "en" | "bn";
export type FontSize = "small" | "medium" | "large";
export type StudyMode = "guide" | "answer";
export type AgentMode =
  | "tutor"
  | "exam_coach"
  | "coding_mentor"
  | "viva_examiner"
  | "research_assistant"
  | "quick_answer"
  | "deep_learning"
  | "revision_coach";
export type AnswerPolicy = "balanced" | "source_only";

export interface HintLadderData {
  nudge: string;
  hint: string;
  scaffold: string;
}

export interface Citation {
  doc_id: string;
  filename: string;
  page_num: number;
  slide_number?: number | null;
  source_location?: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  hints?: HintLadderData | null;
  citations?: Citation[];
  tokens: number;
  created_at: number;
}

export interface ChatSession {
  id: string;
  title: string;
  subject: string;
  mode: StudyMode;
  model: string;
  course_id?: string | null;
  agent_mode?: AgentMode;
  answer_policy?: AnswerPolicy;
  created_at: number;
  updated_at: number;
  message_count?: number;
  total_tokens?: number;
  messages?: ChatMessage[];
}

export interface StudyDocument {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  pipeline: "ocr" | "vlm";
  page_count: number;
  summary: string;
  file_path: string;
  created_at: number;
  chunk_count?: number;
  course_id?: string | null;
  file_type?: string;
  sha256?: string;
  status?: string;
  error_message?: string | null;
  duplicate?: boolean;
}

export interface DocumentChunk {
  id: string;
  doc_id: string;
  page_num: number;
  slide_number?: number | null;
  source_location?: string;
  content: string;
  keywords: string;
}

export interface DocumentAsset {
  id: string;
  document_id: string;
  page_number: number | null;
  asset_type: "image" | "qr" | "diagram" | "equation";
  extracted_payload: string;
}

export interface IngestionJob {
  id: string;
  document_id: string | null;
  course_id: string | null;
  filename: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  error_message: string | null;
  created_at: number;
}

export interface StudyTask {
  id: string;
  title: string;
  subject: string;
  due_date: string | null;
  priority: "low" | "medium" | "high";
  completed: boolean;
  created_at: number;
  course_id?: string | null;
  task_type?: string;
}

export interface FocusSession {
  id: string;
  duration_minutes: number;
  subject: string;
  completed_at: number;
}

export interface StudyResource {
  id: string;
  title: string;
  subject: string;
  category: string;
  content: string;
  is_custom: boolean;
  created_at: number;
}

export interface InstalledModel {
  name: string;
  size_bytes: number;
  size: string;
  parameter_size: string;
  quantization: string;
  family: string;
  is_vision: boolean;
}

export interface SuggestedModel {
  name: string;
  title: string;
  category: string;
  size: string;
  ram: string;
  tags: string[];
  description: string;
  installed: boolean;
}

export interface HealthTelemetry {
  status: string;
  ollama_online: boolean;
  running_models: Array<{ name: string; size?: number }>;
  ram_used_gb: number;
  ram_total_gb: number;
  ram_percent: number;
  platform: string;
  uptime_seconds: number;
}

export interface CourseReadiness {
  course_id: string;
  code: string;
  title: string;
  exam_date: string | null;
  topics_mastered: number;
  topics_total: number;
  avg_quiz_score: number | null;
  flashcards_reviewed: number;
  flashcards_total: number;
  documents_count: number;
}

export interface AnalyticsData {
  totals: {
    chats: number;
    messages: number;
    tokens: number;
    documents: number;
    tasks: number;
    completed_tasks: number;
    focus_minutes: number;
  };
  mode_split: {
    guide: number;
    answer: number;
  };
  subjects: Array<{ subject: string; count: number }>;
  course_readiness?: CourseReadiness[];
  weekly_rhythm: Array<{
    date: string;
    full_date: string;
    messages: number;
    focus_minutes: number;
  }>;
}

export interface BenchmarkRun {
  id: string;
  pipeline: string;
  model: string;
  question: string;
  latency_ms: number;
  tokens: number;
  response_preview: string;
  created_at: number;
}

export interface University {
  id: string;
  name: string;
  short_name: string;
}

export interface Department {
  id: string;
  university_id: string;
  name: string;
  code: string;
}

export interface Semester {
  id: string;
  academic_year_id: string;
  name: string;
  is_active: number | boolean;
}

export interface Course {
  id: string;
  semester_id: string;
  code: string;
  title: string;
  instructor: string;
  credits: number;
  syllabus: string;
  description: string;
  objectives: string;
  exam_date: string | null;
  doc_count?: number;
  topic_count?: number;
  pending_tasks?: number;
}

export interface CourseTopic {
  id: string;
  course_id: string;
  chapter_index: number;
  title: string;
  summary: string;
  status: "not_started" | "in_progress" | "mastered";
}

export interface CourseDetail extends Course {
  topics: CourseTopic[];
  documents: StudyDocument[];
  tasks: StudyTask[];
  chats: ChatSession[];
}

export interface AcademicTree {
  universities: University[];
  departments: Department[];
  semesters: Semester[];
  courses: Course[];
}

export interface Flashcard {
  id: string;
  course_id: string | null;
  topic_id: string | null;
  front: string;
  back: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: number;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_type?: string;
  prompt: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  source_citation: string;
  user_answer?: string | null;
  is_correct?: number | null;
}

export interface QuizSession {
  id: string;
  course_id: string | null;
  difficulty: string;
  score: number | null;
  total_questions: number;
  created_at: number;
  questions?: QuizQuestion[];
}

export interface KnowledgeEdge {
  id: string;
  course_id: string;
  source_label: string;
  target_label: string;
  relation_type: "prerequisite" | "related_to" | "formula_for" | "implements";
  evidence_doc_id?: string | null;
  evidence_excerpt: string;
  is_user_edited: number;
}

export interface KnowledgeGraphData {
  course: { id: string; code: string; title: string };
  nodes: Array<{ id: string; label: string; degree: number }>;
  edges: KnowledgeEdge[];
}

export interface LectureTranscript {
  id: string;
  course_id: string | null;
  title: string;
  summary: string;
  topics: string[];
  segments: Array<{ line: number; text: string }>;
  created_at: number;
  document_id?: string;
}

export interface RoutingMetadata {
  selected_model: string;
  role: string;
  intelligence_mode: string;
  intent: string;
  language: string;
  complexity: string;
  reason: string;
  fallback_used: boolean;
  activity_steps: string[];
}

export interface ModelDashboardItem {
  id: string;
  display_name: string;
  kind: "ollama_llm" | "embedding" | "stt" | "ocr" | "tts";
  category: string;
  size_gb: number;
  min_ram_gb: number;
  recommended_for: string;
  license_note: string;
  storage_path: string;
  optional: boolean;
  installed: boolean;
  running: boolean;
  status: "Ready" | "Running" | "Downloading" | "Unavailable" | "Error";
  memory_gb: number;
  compatible: boolean;
  warnings: string[];
  error?: string | null;
}

export interface ModelDashboardData {
  ollama_online: boolean;
  ollama_installed: boolean;
  offline_mode: boolean;
  intelligence_mode: IntelligenceMode;
  context_window: number;
  max_tokens: number;
  model_timeout_sec: number;
  ram_total_gb: number;
  ram_used_gb: number;
  storage: {
    models_root: string;
    ollama_models_path: string;
    free_gb: number;
    total_gb: number;
    external_volumes: string[];
  };
  models: ModelDashboardItem[];
}
