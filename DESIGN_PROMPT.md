# BhaiOS — Complete System Architecture & UI/UX Design Prompt

Build a 100% offline-first, local-first AI educational operating system and intelligent study companion named **BhaiOS** ("ভাই" — your personal local study space) for students preparing for high-stakes examinations (HSC, Admission, Engineering). The system operates entirely on-device without cloud dependencies, external telemetry, or data leakage, running local LLMs and VLMs via local Ollama and Whisper.

---

## 1. Core Architecture & Local-First Philosophy

- **Execution Environment**: 100% On-device, local Python HTTP backend (`server.py`) interfacing with Ollama (`localhost:11434`) for text/vision inference and local Whisper for voice speech-to-text.
- **Data Privacy Guarantee**: Zero cloud uploads, zero remote analytics. All notes, handwritten scans, schedules, chat logs, and vector embeddings remain strictly in local storage and local SQLite/JSON.
- **Model Intelligence Pipeline**:
  - Primary text models: `Qwen2.5 (3B / 7B)`, `Llama 3.2 (3B)`, `Gemma 2 (2B)`.
  - Vision/Multimodal: `Llava-Phi3`, `Llava 1.5`, `Moondream`.
  - Socratic Guidance Engine: Guides students with progressive hints rather than dumping direct answers immediately.

---

## 2. Visual Design System & Tokens (Figma Specification)

- **Color Palette & Themes**:
  - `data-theme="dark"`: Base `#0F1115`, surface `#161922`, elevated card `#1C202C`, border subtle `#2D3344`, text primary `#F1F5F9`, text secondary `#94A3B8`, text muted `#64748B`.
  - `data-theme="light"`: Base `#F8FAFC`, surface `#FFFFFF`, elevated card `#F1F5F9`, border subtle `#E2E8F0`, text primary `#0F172A`, text secondary `#475569`, text muted `#94A3B8`.
  - Brand accents: Primary accent `#3B82F6` (Electric Blue), Guide mode gold `#F59E0B` / `#D97706`, Success/Online `#10B981` (Emerald), Warning `#EF4444`.
- **Typography & Localization**:
  - Interface typography: Inter, system-ui, -apple-system.
  - Bangla vernacular typography: `Hind Siliguri`, `Noto Sans Bengali`.
  - Monospace code & telemetry: `JetBrains Mono`, `Fira Code`.
- **Corner Radii & Elevations**:
  - Composer Pill: `border-radius: 9999px` (when single line), `20px` (multiline).
  - Cards & Sidebars: `12px` to `16px`.
  - Badges & Chips: `12px` to `20px`.
  - Soft ambient drop shadows: `0 4px 20px rgba(0, 0, 0, 0.08)`.

---

## 3. Left Navigation Sidebar

1. **Brand Workspace Header**:
   - Square rounded brand mark icon `[ভাই]` in royal blue.
   - App title `BhaiOS` with subtitle `YOUR LOCAL STUDY SPACE`.
   - Collapsible trigger to toggle compact 60px icon-only sidebar vs 240px expanded sidebar.
2. **Action Button**:
   - `+ New conversation` secondary pill button resetting conversation context.
3. **Primary Navigation Links**:
   - `Home` (`bx-home-alt-2`): Overview dashboard and study metrics.
   - `Chat` (`bx-message-square-detail`): Active guided study conversation.
   - `Documents` (`bx-file`): Vision-linked library of scanned lecture notes, handwritten sheets, and textbooks.
   - `Tasks` (`bx-list-ul`): Active tasks, deadlines, and revision priorities.
   - `Progress` (`bx-bar-chart-alt-2`): Weekly study analytics, rhythm graph, and subject mastery breakdown.
   - `Resources` (`bx-book-bookmark`): Curated formulas, exam syllabi, and reference sheets.
   - `Settings` (`bx-cog`): Local model management, quantization footprints, and device settings.
4. **Collapsible Past Sessions Drawer**:
   - `Past chats` toggle with session counter badge.
   - Collapsed by default to maintain compact navigation hygiene.
   - Expanding reveals saved session history cards with quick-clear and delete capabilities.
5. **Footer Controls Toolbar**:
   - **3-Way Theme Switcher Segmented Control**: `Device (System)`, `Light`, `Dark`.
   - **Bilingual Language Switcher Segmented Control**: `EN` (English) vs `বাং` (Bangla).
6. **Hardware Telemetry Monitor Card (Zero Line-Breaking)**:
   - **Header**: Active model badge (`[⚙ Qwen2.5 · 3B]`) + Live runtime badge (`[● Live]`).
   - **2-Column Metrics Grid**:
     - Left: `SYSTEM RAM` → `8.9 / 16 GB`.
     - Right: `MODEL SIZE` → `1.8 GB`.
   - **RAM Gauge**: Full-width active visual percentage bar.
   - **Footer**: `🛡️ 100% On-device` guarantee + session token usage pill (`1,657 tok`).

---

## 4. Main Chat & Study Workspace

1. **Clean Initial Startup**:
   - Fresh session starts completely clean with zero synthetic/mock conversation bubbles.
   - Centered welcoming empty state: `How can I help you learn today?` with interactive suggestion chips (`Integration by Parts`, `Newton's Laws`, `Quick Quiz`).
2. **Unified Single-Pill Composer Bar**:
   - Sleek horizontal rounded pill layout (`min-height: 48px; border-radius: 9999px;`).
   - **Left**: `+` icon button for attaching handwritten scans or documents.
   - **Middle**: Auto-resizing textarea with clean placeholder `Ask anything` / `যেকোনো প্রশ্ন করো…`.
     - Zero inner focus outline rectangle (`outline: none; border: none; box-shadow: none;`).
     - Smoothly grows upward into rounded container (`.is-multiline`) when user writes multiple lines without wrapping buttons awkwardly.
   - **Right Embedded Chips**:
     - Model selector pill: `[⚙ Model Name · RAM · Footprint v]`.
     - Mode toggle dropdown: `[🧭 Guide Mode v]` (Socratic hints) vs `[⚡ Answer Mode v]` (Direct resolution).
     - Whisper Speech-to-Text Language: `[Auto]` toggle.
     - Microphone trigger for offline Whisper voice dictation.
     - Send button with dynamic visibility.
3. **Conversational Stream & Socratic Ladder**:
   - Student prompts formatted in elegant cards with time and optional document citation chips (`Calculus_notes.pdf · Page 3`).
   - Assistant responses with Bengali/English bilingual rendering.
   - **Interactive Hint Ladder Component**:
     - Step 01: Nudge (gentle conceptual pointer).
     - Step 02: Hint (formula or intermediate algebraic relationship).
     - Step 03: Scaffold (full step-by-step structural derivation).
     - Counter indicator (`1 of 3 revealed`) and progressive unlock buttons.

---

## 5. Right Companion & Auxiliary Panels

1. **Document Companion Column**:
   - Clean standby state when no document is active with file dropzone trigger.
   - Active state displays document name, page badge (`PAGE 3 OF 8`), vision status indicator, and high-fidelity scanned note inspection card with highlighted bounding box annotations.
   - Fullscreen Vision zoom trigger.
2. **Study Schedule Aside Panel**:
   - Interactive calendar widget with month navigation and selected study date anchors.
   - Gentle reminder nudge cards (`Offline reminders enabled`).
   - Focus session Pomodoro timer with preset durations (`15m`, `25m`, `45m`, `60m`) and live countdown.
   - Compact quick task checklist with inline task creator.

---

## 6. Modals & Overlay Utilities

1. **Command Palette (`⌘K` / `Ctrl+K`)**:
   - Instant search modal indexing commands, past chats, uploaded documents, and subject resources.
2. **Vision & Document Upload Modal**:
   - Drag-and-drop file ingestion supporting `.pdf`, `.png`, `.jpg`, `.jpeg`.
   - Pipeline selector between `VLM (Visual Document Inspection)` and `OCR + Text Embedding`.
3. **Model Selection Popover**:
   - Dropdown listing all locally installed Ollama models with their on-disk size, required RAM footprint, and vision capability tags.
   - One-click refresh to rescan local Ollama instances.
