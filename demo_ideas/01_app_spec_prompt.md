# BhaiOS — Full App Specification Prompt

> Use this prompt with any capable AI assistant (GPT-4o, Claude, Gemini) to generate detailed technical specifications, feature flows, and architecture documents for BhaiOS.

---

## Prompt

```
You are a senior software architect and product designer. I am building a solo Final Year Project called:

**BhaiOS: A Local Vision-Language Study Assistant with Guide-First Assistance for Bangla-Speaking Students**

Team: Swift Lions | DIU FYP | PRJ-fall-2026-12485

---

## What BhaiOS Is

BhaiOS is a 100% offline, local-first desktop study assistant for Bangladeshi university students. It combines a local LLM with a local Vision-Language Model (VLM) running on a standard laptop (target: 16 GB RAM, no dedicated GPU, 4-bit quantized models via Ollama / llama.cpp). The system reads and understands a student's own study material — scanned pages, handwritten Bangla and English notes, slides, diagrams — and helps them learn without doing the work for them.

It operates in two modes:
1. **Guide-First Mode (default):** Gives hints, asks Socratic questions, breaks problems into steps, nudges the student forward without revealing answers.
2. **Direct Answer Mode:** Provides complete answers when the student switches to it (for comparison / time pressure scenarios).

---

## Core Modules to Specify

### 1. Document Ingestion Pipeline
- Accepts: PDF, image (JPG/PNG), and scanned document uploads
- Two ingestion paths:
  a. **VLM path:** Image fed directly to a local VLM (e.g. Qwen2-VL, MiniCPM-V) for visual understanding — no OCR step
  b. **OCR + LLM fallback path:** Tesseract OCR → text chunking → embedding → ChromaDB vector store
- Output: Structured knowledge chunks stored in ChromaDB + SQLite metadata table (filename, date, page, type)
- Bangla Unicode handling: normalize, clean, store both Bangla and English chunks
- Supported content types: printed Bangla, handwritten Bangla, printed English, mixed text+diagram, pure diagram

### 2. Local Retrieval & Q&A Engine
- Query: student types a question in Bangla or English
- Semantic search over ChromaDB (local embeddings via HuggingFace sentence-transformers, e.g. paraphrase-multilingual-MiniLM-L12-v2)
- Retrieved chunks → fed as context to local LLM (Ollama)
- Output: guided hint chain OR direct answer depending on mode
- Latency target: < 15 seconds per response on a 16 GB RAM laptop with 4-bit quantized model

### 3. Guide-First Policy Engine
- Receives: student question + retrieved context + current conversation history
- Applies a prompt template that forbids the LLM from giving final answers
- Outputs a Socratic response: a clarifying question, a partial breakdown, or a "think about X first" nudge
- Tracks hint depth: if student has received 3+ hints without progress, escalates to a broader hint
- Mode switch: student can type /answer or click Answer Mode to get the direct solution

### 4. Task, Deadline & Reminder Tracker
- Students add tasks manually: subject, description, due date, priority
- Local SQLite table: tasks (id, title, subject, due_date, priority, status, created_at)
- Reminder engine: background thread checks due dates every hour, pushes system notifications
- Weekly Progress Review: auto-generated summary every Sunday evening — tasks completed, missed, pending — presented in chat as a report
- Overdue detection: flags tasks as overdue, nudges student in next session

### 5. Study Resource Recommender (Stretch Goal)
- Student can ask "Find me a video on [topic]"
- Uses YouTube Data API v3 to search for top 3 relevant results
- Displays title, channel, duration, URL in chat
- Filter: prefer Bangla-language videos when topic seems Bangla-curriculum-specific
- All requests are made by the student explicitly — no auto-sending

### 6. Opt-In Agent Mode (Stretch Goal)
- Student types a task like "open my notes folder" or "remind me in 30 minutes"
- System proposes the action with a preview and confirmation button before executing
- Allowed automations: open file/folder, set system timer, write a text file summary
- Strictly no network access, no external API calls, no code execution beyond sandboxed shell commands

### 7. Voice Input (Future)
- Whisper (local, via whisper.cpp) for voice-to-text
- Bangla voice input → transcribed → fed into Q&A engine as text
- Push-to-talk button in UI

---

## Evaluation Components to Specify

### A. Bangla Study-Material Benchmark
- Size: ~100 questions over ~40 pages of real student course material
- Page types: 25 printed Bangla, 10 handwritten Bangla, 5 English slides, 5 mixed diagram+text, 5 pure diagrams
- Sources: author's own notes, volunteer handwritten pages, openly licensed university slides
- For each page: ground-truth transcription (typed by author, verified by a second reviewer)
- Metrics:
  - CER (Character Error Rate) and WER (Word Error Rate) for transcription
  - Answer accuracy: 3-point rubric (0 = wrong, 1 = partially correct, 2 = fully correct) scored by author + reviewer
  - Latency per page: wall-clock seconds from image input to first token output
- Comparison: VLM path vs. OCR + LLM path on all metrics

### B. User Study
- Participants: 10–15 Bangladeshi undergraduate students, recruited via university network
- Duration: 2–3 weeks
- Design: within-subjects A/B — same students use Guide-First mode (Week 1) and Direct Answer mode (Week 2), counterbalanced
- Tasks given: 5 standardized assignment tasks per week from their actual coursework
- Metrics collected (all local logs, anonymized):
  - Task completion rate (% of tasks submitted)
  - On-time submission rate
  - Pre/post quiz score gain (5-question Bangla quiz per topic, before and after using BhaiOS)
  - Short engagement survey (5 Likert items: helpfulness, trust, learning, ease of use, preference)
- Results reported descriptively with Cohen's d effect sizes (small n, no significance testing)
- Ethics: informed consent form, local logs only, no personally identifiable data stored

---

## Technical Stack

| Layer | Technology |
|---|---|
| LLM inference | Ollama + llama.cpp (4-bit quantized, e.g. Qwen2.5, Llama-3.2) |
| VLM inference | Ollama VLM (Qwen2-VL, MiniCPM-V, or LLaVA) |
| OCR fallback | Tesseract OCR (Bangla traineddata) |
| Image preprocessing | OpenCV |
| Embeddings | HuggingFace sentence-transformers (multilingual) |
| Vector store | ChromaDB (local, persistent) |
| Structured storage | SQLite (tasks, metadata, session history) |
| Backend API | FastAPI (local REST API for frontend–backend communication) |
| Desktop UI | PyQt6 |
| Voice | Whisper (future, via whisper.cpp) |
| Resource search | YouTube Data API v3 (opt-in stretch goal) |
| Language | Python 3.11+ |

---

## What I Need From You

1. **System Architecture Diagram (ASCII/Mermaid):** showing all modules and data flows
2. **Database Schema:** SQLite tables for tasks, documents, sessions, messages, benchmark results
3. **API Spec:** FastAPI endpoints (internal) — list each route, method, request/response shape
4. **Prompt Templates:** 
   a. Guide-First system prompt (enforces Socratic mode, disallows direct answers)
   b. Direct Answer system prompt
   c. Weekly Progress Review generation prompt
5. **Benchmark Annotation Protocol:** step-by-step procedure for building the 100-question dataset
6. **User Study Protocol:** consent form text, task descriptions, quiz template, survey questions
7. **Hardware Profiling Plan:** what to measure in Week 1 (RAM usage, latency, model size on disk) and what the fallback decision rule is
8. **Risk Table:** top 5 technical risks with mitigation strategies

Format everything in well-structured Markdown with headers. Be as detailed as a real system design document.
```

---

## Notes for Use

- Run this prompt once to get the full spec, then iterate on individual sections.
- The VLM model selection (Qwen2-VL vs MiniCPM-V vs LLaVA) should be informed by Week 1 hardware profiling before locking in the architecture.
- Benchmark sources must stay within own/volunteer/open-license material — do not paste copyrighted textbook scans.
