# BhaiOS — UI/UX Generation Prompt

> Use this prompt with AI image generators (Midjourney, DALL·E 3, Ideogram, Adobe Firefly) or with AI UI generators (v0.dev, Galileo AI, Uizard, Vercel v0) to generate UI mockups, screen concepts, and component designs.

---

## Context Brief (include this in every prompt)

```
App: BhaiOS — a local-first, offline desktop study assistant for Bangladeshi university students.
Target users: 18–24-year-old university students in Bangladesh who study in Bangla and English.
Platform: Desktop application (PyQt6 / web-rendered). Screen sizes: 1366×768 and 1920×1080.
Mood: Calm, focused, slightly warm and academic — not corporate, not flashy, not childlike.
Language: UI labels appear in English; content can be Bangla or English depending on the student's material.
Color palette direction: Deep teal or deep indigo primary. Warm off-white or light cream background. 
  Soft amber or saffron accent (evokes warmth + Bangladesh). Subtle gray for secondary text and dividers.
Typography: Clean geometric sans-serif for UI labels (like Inter or Nunito). Noto Sans Bengali for 
  Bangla text rendering, ensuring clean Unicode display.
Style: Modern minimal with subtle depth (soft shadows, card-based layout). Not flat, not neumorphic. 
  Feels like a focused productivity tool — reference: Notion, Linear, or Bear Notes in spirit.
```

---

## Screen-by-Screen Prompts

### Screen 1 — Main Chat Interface (Guide Mode)

**For v0.dev / Galileo / Uizard:**
```
Design a desktop study assistant chat interface called "BhaiOS". 

Layout:
- Left sidebar (280px): navigation icons + labels — Chat, Documents, Tasks, Progress, Settings. 
  Show a small circular avatar/logo at the top. Active item highlighted with the primary teal color.
- Main area: a conversational chat window. 
  Top bar shows "Guide Mode" toggle pill (teal = active) and "Answer Mode" pill (gray = inactive), 
  plus a small latency indicator showing "~8s / response".
  Chat messages: user messages right-aligned with a warm cream bubble, 
  assistant messages left-aligned in a teal-tinted card with a subtle BhaiOS logo watermark.
  The latest assistant message shows a Socratic hint: 
  "Before I give you the answer — what do you think happens to kinetic energy when velocity doubles? 
   Try to think about the formula first. 🤔"
  Below the chat: a wide text input bar with a paperclip icon (attach document), 
  a mic icon (voice, grayed out/future), and a send button.
- Right panel (320px, collapsible): "Related from your notes" — shows 2 retrieved document 
  chunk cards with a snippet of Bangla text and a file reference badge at the bottom.

Color: deep teal sidebar (#1A5C6B), warm off-white main area (#FAF7F2), amber accent for the 
active guide-mode pill, clean card shadows.
Mood: calm, academic, focused. No unnecessary decorations.
```

---

### Screen 2 — Document Upload & Ingestion

**For v0.dev / Galileo / Uizard:**
```
Design a document upload screen for a desktop study assistant app called "BhaiOS".

Layout:
- Full-width content area with a page title "My Study Materials" and a subtitle "Upload your notes, slides, or scanned pages."
- A large drag-and-drop upload zone in the center: dashed border, teal icon (document with sparkle), 
  text "Drop PDF, image, or scanned note here" and a secondary "Browse files" button.
- Below the upload zone: a document library grid (3 columns) showing already-uploaded documents as cards.
  Each card shows: a thumbnail preview (blurred/placeholder), filename, upload date, page count badge, 
  and a small status badge — "Indexed" (green) or "Processing…" (amber spinner).
  One card shows a Bangla-language document title in Noto Sans Bengali.
- A thin progress bar under a currently processing card showing "Indexing page 3 of 8…"
- A small toggle at the top right of the grid: "VLM mode" vs "OCR mode" toggle with an info tooltip.

Style: Clean card grid, warm background, teal accents, no clutter.
```

---

### Screen 3 — Task & Deadline Tracker

**For v0.dev / Galileo / Uizard:**
```
Design a task tracker screen for a university student study assistant desktop app called "BhaiOS".

Layout:
- Page header: "Tasks & Deadlines" with a "+ Add Task" button (teal, top right).
- Left column (60% width): a task list with sections "Overdue" (red accent bar on left), 
  "Due This Week" (amber accent), and "Upcoming" (gray). 
  Each task row shows: subject tag chip (e.g. "CSE-401", "MATH-301"), task title, 
  due date in natural language ("Due in 2 days"), priority dot (red/amber/gray), 
  and a checkbox. One overdue task row is highlighted with a soft red background wash.
- Right column (40% width): a mini calendar showing the current week. Days with tasks have 
  a small teal dot under the date. Today is highlighted with a filled teal circle.
  Below the calendar: a "Weekly Summary" card with 3 stat badges — "5 completed", 
  "2 missed", "3 pending" in a clean icon+number layout.
- At the bottom: a small banner notification card styled subtly: 
  "🔔 Your Physics assignment is due tomorrow at 11:59 PM"

Style: Productive, clean, slightly warm. Uses Bangla text for one of the task titles 
to demonstrate multilingual support.
```

---

### Screen 4 — Weekly Progress Review (Chat Report)

**For v0.dev / Galileo / Uizard:**
```
Design a weekly progress review report card displayed inside a chat interface for a desktop study assistant called "BhaiOS".

The report card is a large assistant message bubble (wider than normal chat messages, card-style with subtle border):

Header of card: "📊 Weekly Progress Review — Week of Nov 24–30"
Sections inside the card:
1. Summary row: 3 large stat chips — "7 tasks completed ✅", "2 missed ❌", "3 on time 🟡"
2. Subject breakdown: a small horizontal bar chart (3 bars) — CSE-401, MATH-301, ENG-202 — 
   showing tasks done vs total per subject. Bars are teal-filled.
3. Study sessions: "You studied 4 times this week. Avg session: 38 min."
4. Encouragement line (from the assistant in guide tone): 
   "You improved your on-time rate from 40% to 70% this week. 
    Your MATH-301 deadline is coming up — want to review those notes together?"
5. Bottom of card: two action buttons — "Review MATH-301 notes" and "Dismiss"

Style: The card sits inside the normal chat background. Warm, friendly, not dashboard-heavy. 
Data-light and readable at a glance.
```

---

### Screen 5 — Benchmark Evaluation View (Dev / Research Mode)

**For v0.dev / Galileo / Uizard:**
```
Design a benchmark evaluation screen for a research desktop app called "BhaiOS". 
This screen is for the developer/researcher, not the student — it shows the evaluation pipeline.

Layout:
- Full-width with a subtle "Research Mode" badge in the header.
- Top section: two side-by-side pipeline cards:
  Left card — "VLM Pipeline": shows an image thumbnail → VLM icon → output text preview → metrics row.
  Right card — "OCR + LLM Pipeline": shows the same image → Tesseract icon → LLM icon → output text preview → metrics row.
- Metrics row under each card: CER %, WER %, Answer Accuracy (rubric score / 2), Latency (seconds).
  Numbers shown as clean stat badges. Better metric highlighted in green.
- Middle section: a data table of benchmark items — columns: Page ID, Type (Printed Bangla / Handwritten / Diagram / English), 
  VLM Accuracy, OCR Accuracy, VLM Latency, OCR Latency. Sortable columns.
- Bottom: aggregate summary bar — "VLM avg CER: 12.3% | OCR avg CER: 18.7% | VLM avg latency: 9.2s | OCR avg latency: 4.1s"

Style: Data-dense but clean. Monospace numbers. Teal accents for section headers. White card surfaces on a light gray background.
```

---

## For AI Image Generators (Midjourney / DALL·E 3 / Ideogram)

### Hero Screenshot Concept
```
Photorealistic UI screenshot of a modern desktop productivity app called BhaiOS, 
a study assistant for university students. Dark teal sidebar on the left with clean icons and labels. 
Warm off-white main content area showing an AI chat conversation between a student and the BhaiOS assistant. 
The assistant message shows a thoughtful Socratic hint in a teal accent card. 
Bangla Unicode text visible in one of the chat messages. 
A right panel shows retrieved document snippets. 
Mood: calm, academic, focused, slightly warm. 
Style: clean modern UI, subtle card shadows, no excessive decoration. 
Aspect ratio 16:9, high resolution, professional product screenshot aesthetic.
```

### App Icon Concept
```
Minimalist app icon for a desktop study assistant called BhaiOS. 
The icon represents a guiding big brother helping a younger student — abstract, geometric, not literal. 
Deep teal circle background. White geometric symbol: a speech bubble with a small lightbulb or upward arrow 
inside, suggesting guidance not answers. Clean, bold, scalable. 
Flat design with subtle gradient depth. 512×512 px, app icon aesthetic.
```

---

## Notes for UI Implementation

| Concern | Decision |
|---|---|
| **Bangla rendering** | Use `Noto Sans Bengali` via Google Fonts or system font; never use a bitmap font for Bangla |
| **RTL/LTR mixing** | Bangla is LTR — no RTL layout needed; mixed content handled with Unicode bidi |
| **Color contrast** | Deep teal + white: WCAG AA compliant. Test amber accent against white background. |
| **Font sizes** | Base: 14px / 16px. Bangla text may need +1–2px for legibility at smaller sizes. |
| **Dark mode** | Nice-to-have but not in scope for initial build — design for light mode first |
| **Responsive** | Target 1366×768 minimum; sidebar collapses to icons only below 1280px |
