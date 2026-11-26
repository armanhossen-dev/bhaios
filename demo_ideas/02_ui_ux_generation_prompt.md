# BhaiOS — UI/UX Generation Prompt

> Use this prompt with AI image generators (Midjourney, DALL·E 3, Ideogram, Adobe Firefly) or with AI UI generators (v0.dev, Galileo AI, Uizard, Vercel v0) to generate UI mockups, screen concepts, and component designs.

---

## Context Brief (include this in every prompt)

```
App: BhaiOS — a local-first, offline desktop study assistant for Bangladeshi university students.
Target users: 18–24-year-old university students in Bangladesh who study in Bangla and English.
Platform: Desktop application (PyQt6 / web-rendered). Screen sizes: 1366×768 and 1920×1080.

THEME: Dark-first. Inspired by the Framer dashboard aesthetic. Deep charcoal near-black 
  surfaces (NOT pure black). Hairline borders. Clean white text hierarchy. Very similar to 
  Linear, Vercel dark mode, or the Framer CMS dashboard.

Mood: Focused, dense, professional — like a tool a developer or serious student would use.
  NOT corporate, NOT flashy, NOT childlike, NOT clinical.

Language: UI labels appear in English; content can be Bangla or English.

Color palette (DARK THEME):
  Background layers (darkest → lightest): #0C0C0C → #111111 → #161616 → #1C1C1C → #242424
  Borders: hairline 1px #2A2A2A between panels; 1px #333333 for card outlines
  Text: primary #F0F0F0 (NOT pure white), secondary #8A8A8A, tertiary/placeholder #555555
  Accent 1 — Teal: #2A8FA8 (links, active states, focus rings, source indicators)
  Accent 2 — Amber: #E8A020 (Guide Mode pill, CTA buttons, warning, overdue)
  Status: success #3DBE82, error #E05252, warning #E8A020
  Bangla text: Noto Sans Bengali, #E8E8E8, line-height 1.8

Typography:
  Inter everywhere (same as Framer, Linear, Vercel).
  Noto Sans Bengali for all Bangla content.
  JetBrains Mono for all numbers, metrics, latency values.

Style references: Framer dashboard (dark, dense, hairline borders), Linear (sidebar + list rows), 
  Vercel analytics (monospace metrics on dark), Claude.ai (chat bubble layout).
  The ONLY color that pops is teal or amber — everything else is neutral gray on charcoal.
```

---

## Screen-by-Screen Prompts

### Screen 1 — Main Chat Interface (Guide Mode)

**For v0.dev / Galileo / Uizard:**
```
Design a dark-themed desktop study assistant chat interface called "BhaiOS". 
Reference aesthetic: Framer CMS dashboard + Claude.ai chat.

Layout:
- Left sidebar (280px, background #111111): navigation icons + labels — Chat, Documents, Tasks, 
  Progress, Settings. Each item: 18px icon (#8A8A8A) + Inter 13px 500 label (#8A8A8A). 
  Active item: 2px left border #2A8FA8 + background #1E2A2D. Hover: background #1A1A1A.
  Bottom: "🧭 Guide Mode" amber pill + "llama3.2:3b • ~8s" in JetBrains Mono 11px #555555.
  Right edge of sidebar: hairline 1px #2A2A2A.
- Main chat area (background #161616):
  Top bar (background #161616, bottom border 1px #2A2A2A): 
    "Chat" in #F0F0F0 Inter 15px 500 on left.
    Two mode pills center: "🧭 Guide Mode" (background #2A1E06, border 1px #E8A020, text #E8A020) 
    and "💬 Answer Mode" (background #1A1A1A, border 1px #333333, text #555555).
    Latency chip right: "~8s / resp" JetBrains Mono 11px #555555, border 1px #2A2A2A.
  Chat messages in scrollable area:
    User message (right-aligned): background #1E2A2D, border 1px #2A3D45, 
      border-radius 14px 14px 4px 14px, text #E8E8E8 Inter 14px.
    Assistant message (left-aligned): background #1C1C1C, border 1px #2A2A2A, 
      3px left border #2A8FA8, border-radius 4px 14px 14px 14px.
      Latest assistant message shows: "Before I give you the answer — what do you think happens 
      to kinetic energy when velocity doubles? Think about the formula first. 🤔"
      Below message: "Show source →" in #2A8FA8 Inter 12px.
  Input bar at bottom (background #111111, top border 1px #2A2A2A):
    Input field: background #1A1A1A, border 1px #333333, border-radius 8px.
    Placeholder "Ask BhaiOS anything..." in #555555. Paperclip icon left (#555555). 
    Send button: filled circle #2A8FA8 with #F0F0F0 arrow icon.
- Right context panel (320px, background #111111, left border 1px #2A2A2A):
  "RELATED FROM YOUR NOTES" header: #555555 Inter 11px uppercase letter-spacing.
  2 retrieved chunk cards: background #1C1C1C, border 1px #2A2A2A, border-radius 8px.
    One card shows a Bangla text snippet in Noto Sans Bengali #8A8A8A 12px.
    File reference: "Page 4 · Physics_Notes.pdf" in #555555 11px.

Overall feel: dense, focused, professional. Only teal (#2A8FA8) and amber (#E8A020) are colored. 
Everything else is charcoal gray. Looks like Linear or Framer but for studying.
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
a study assistant for university students. 
Deep charcoal near-black desktop app with #111111 sidebar and #161616 main area. 
NOT pure black — layered charcoal surfaces like Framer or Linear. 
Left sidebar shows nav icons with hairline right border. 
Main chat area shows an AI conversation in dark card bubbles: user messages in a dark teal-tinted bubble (#1E2A2D), 
assistant messages in a #1C1C1C card with a 3px teal left accent bar. 
Bangla Unicode text visible inside one assistant message bubble, Noto Sans Bengali font. 
Right panel shows retrieved document snippets in dark cards (#1C1C1C). 
Top bar shows an amber "Guide Mode" pill glowing softly against the dark background. 
The ONLY accent colors are teal (#2A8FA8) and amber (#E8A020). Everything else is neutral charcoal gray. 
Aspect ratio 16:9, high resolution, professional product screenshot. Inter font throughout.
```

### App Icon Concept
```
Minimalist app icon for a desktop study assistant called BhaiOS. 
Deep charcoal background (#111111), not pure black. 
A teal (#2A8FA8) geometric symbol centered: a speech bubble merged with an upward arrow, 
suggesting guidance and forward movement — not a final answer, but a nudge. 
The speech bubble has a subtle amber (#E8A020) glow dot inside, like a hint being given.
Clean, geometric, bold, scalable. No text. No decorative elements. 
Very similar to Linear or Vercel's icon aesthetic — precise and minimal. 
512×512 px. Dark background with single teal accent. App icon aesthetic.
```

---

## Notes for UI Implementation

| Concern | Decision |
|---|---|
| **Theme** | **Dark-first** (Framer/Linear/Vercel aesthetic). `#0C0C0C` root → `#111111` sidebar → `#161616` main → `#1C1C1C` cards |
| **Bangla rendering** | Use `Noto Sans Bengali`, line-height 1.8 minimum. Never use a bitmap font for Bangla |
| **RTL/LTR mixing** | Bangla is LTR — no RTL layout needed; mixed content handled with Unicode bidi |
| **Color contrast** | `#F0F0F0` on `#161616` = 9.6:1 ✅. `#8A8A8A` on `#161616` = 4.6:1 ✅ WCAG AA |
| **Font** | Inter for all UI text. Noto Sans Bengali for Bangla. JetBrains Mono for all numbers |
| **Accent discipline** | Only teal (#2A8FA8) and amber (#E8A020). No other colors except semantic (error red, success green) |
| **Borders** | Hairline only: `1px solid #2A2A2A` between panels; `1px solid #333333` for cards. Never thick borders. |
| **Hover states** | Subtle: row `background #242424`, input `border-color #444444`. Not dramatic. |
| **Responsive** | Target 1366×768 minimum; sidebar collapses to 56px icon-only below 1280px |
