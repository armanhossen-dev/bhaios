# BhaiOS — Figma Design Prompt

> Use this prompt with **Figma AI**, **FigJam AI**, **Galileo AI → Export to Figma**, or give it to a designer as a complete design brief. This is the most detailed and structured of the three prompts — covering design tokens, component inventory, layout spec, and interaction spec.

---

## Prompt (Full Brief for Figma)

```
I need a complete, production-ready Figma design file for a desktop application called BhaiOS.

---

## Product Summary

**BhaiOS** is a local-first, offline desktop study assistant for Bangladeshi university students. 
It uses a local Vision-Language Model and LLM to understand a student's handwritten notes, scanned 
pages, and slides — in Bangla and English — and helps them study through Socratic guidance rather 
than giving direct answers.

**Platform:** Desktop application (1440×900 primary, 1366×768 minimum)
**Tech:** PyQt6 desktop app with local AI backend (no cloud)
**Users:** University students, 18–24, Bangladesh

---

## Design Token System

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| `color.primary.900` | `#0F3D47` | Sidebar background |
| `color.primary.700` | `#1A5C6B` | Active nav items, primary buttons |
| `color.primary.500` | `#2A8FA8` | Hover states, links |
| `color.primary.100` | `#D8F0F5` | Light teal tints, selected states |
| `color.accent.500` | `#E8A020` | Amber — CTA buttons, Guide Mode pill, warning badges |
| `color.accent.100` | `#FDF3DC` | Light amber backgrounds |
| `color.surface.base` | `#FAF7F2` | Main content area background (warm off-white) |
| `color.surface.card` | `#FFFFFF` | Card backgrounds |
| `color.surface.sidebar` | `#0F3D47` | Left navigation |
| `color.text.primary` | `#1A1A2E` | Headings, body text |
| `color.text.secondary` | `#5E6473` | Subtitles, metadata, timestamps |
| `color.text.inverse` | `#FFFFFF` | Text on dark sidebar |
| `color.text.bangla` | `#1A1A2E` | Same as primary but applied with Noto Sans Bengali |
| `color.error` | `#E03E3E` | Overdue tasks, error states |
| `color.warning` | `#E8A020` | Due-soon tasks, caution states |
| `color.success` | `#2D9E6B` | Completed, indexed, success |
| `color.border.default` | `#E2DED8` | Card borders, dividers |
| `color.border.focus` | `#2A8FA8` | Input focus rings |

---

### Typography

| Token | Font | Size | Weight | Line Height | Usage |
|---|---|---|---|---|---|
| `type.display` | Inter | 24px | 700 | 1.3 | Page titles |
| `type.heading.lg` | Inter | 20px | 600 | 1.4 | Section headers |
| `type.heading.md` | Inter | 16px | 600 | 1.4 | Card titles, sub-sections |
| `type.body.lg` | Inter | 15px | 400 | 1.6 | Main body text, chat messages |
| `type.body.md` | Inter | 14px | 400 | 1.6 | Secondary body, descriptions |
| `type.label` | Inter | 12px | 500 | 1.4 | Badges, tags, metadata |
| `type.mono` | JetBrains Mono | 13px | 400 | 1.5 | Latency stats, metric numbers |
| `type.bangla.body` | Noto Sans Bengali | 15px | 400 | 1.8 | Bangla body text in chat/docs |
| `type.bangla.label` | Noto Sans Bengali | 13px | 400 | 1.6 | Bangla tags, subject labels |

---

### Spacing & Layout

| Token | Value | Usage |
|---|---|---|
| `space.xs` | 4px | Inline icon gaps |
| `space.sm` | 8px | Inner component padding |
| `space.md` | 16px | Card padding, section gaps |
| `space.lg` | 24px | Column gaps, section breaks |
| `space.xl` | 40px | Page-level padding |
| `space.2xl` | 64px | Between major sections |
| `border.radius.sm` | 6px | Chips, badges, small elements |
| `border.radius.md` | 12px | Cards, message bubbles |
| `border.radius.lg` | 20px | Mode pills, large buttons |
| `shadow.card` | `0 2px 8px rgba(0,0,0,0.08)` | Cards, panels |
| `shadow.sidebar` | `2px 0 12px rgba(0,0,0,0.12)` | Sidebar right edge |
| `shadow.popover` | `0 8px 24px rgba(0,0,0,0.14)` | Tooltips, dropdowns |

---

## Application Shell

### Shell Layout (All screens share this)

```
┌──────────────────────────────────────────────────────────────┐
│  Sidebar (280px fixed)  │  Main Content Area (flex)         │
│                         │                                     │
│  [Logo + BhaiOS]        │  [Top Bar — context-specific]      │
│  ───────────────        │  ─────────────────────────────     │
│  [Nav items]            │                                     │
│    Chat (active)        │  [Screen-specific content]          │
│    Documents            │                                     │
│    Tasks                │                                     │
│    Progress             │                                     │
│    Settings             │                                     │
│                         │                                     │
│  ───────────────        │                                     │
│  [Session info]         │                                     │
│  [Mode toggle]          │                                     │
└─────────────────────────┴─────────────────────────────────────┘
```

**Sidebar specs:**
- Background: `color.primary.900`
- Width: 280px (collapses to 64px icon-only at < 1280px)
- Logo area (64px height): BhaiOS icon (teal icon on dark bg) + wordmark "BhaiOS" in white Inter 600
- Nav items: icon (24px, white) + label (Inter 14px 500, white 85% opacity). Active state: `color.primary.700` left-border (3px) + background tint.
- Bottom section: "Guide Mode / Answer Mode" toggle pill + small RAM/latency indicator

---

## Screen 1 — Chat Interface (Guide Mode)

**URL/Route:** `/chat`

### Layout
```
[Sidebar] | [Chat Panel (flex)] | [Context Panel (320px, collapsible)]
```

**Top Bar:**
- Left: "Chat" page title (type.heading.lg, color.text.inverse on sidebar; type.heading.lg, color.text.primary in main)
- Center: Mode toggle — two pills: "🧭 Guide Mode" (amber active) | "💬 Answer Mode" (gray inactive). Tooltip on hover.
- Right: Latency chip (JetBrains Mono 12px): "~8s / response" in a gray bordered pill.

**Chat Area:**
- Background: `color.surface.base`
- Message alignment: User right, Assistant left
- **User message bubble:** 
  - Background: `color.primary.100` (light teal)
  - Border radius: 16px 16px 4px 16px
  - Max width: 68%
  - Padding: 12px 16px
  - Timestamp below in `color.text.secondary` 11px
- **Assistant message bubble:**
  - Background: `color.surface.card`
  - Border: 1px `color.border.default`
  - Left accent bar: 3px `color.primary.500`
  - Border radius: 4px 16px 16px 16px
  - Max width: 76%
  - Padding: 14px 16px
  - Shows a small BhaiOS icon (16px) top-left of bubble
  - Bangla text renders in Noto Sans Bengali
  - Below message: subtle "Show source" text link in `color.primary.500`
- **Scroll behavior:** Auto-scroll to latest message; "↓ Jump to latest" pill appears when scrolled up

**Input Bar (bottom, sticky):**
- Background: `color.surface.card` with top border
- Height: 64px
- Left icon: paperclip (attach document) — `color.text.secondary`
- Input field: `Inter 15px`, placeholder "Ask BhaiOS anything..." with subtle ghost text
- Right icons: mic icon (grayed out, future feature), send button (`color.primary.700` filled, arrow icon)

**Context Panel (right, 320px):**
- Header: "Related from your notes" with a collapse arrow
- 2–3 retrieved chunk cards:
  - Thumbnail / file type icon
  - File name in `type.label`
  - Text snippet (Bangla or English, 2 lines truncated)
  - "Page 4 · Physics_Notes.pdf" metadata in `color.text.secondary`
- Divider, then: "Recent Documents" section with 3 file rows

---

## Screen 2 — Document Library

**URL/Route:** `/documents`

**Top Bar:** "My Study Materials" title + "+ Upload" button (amber, right)

**Upload Zone (shown if no documents, or pinned to top):**
- Dashed border (2px, `color.border.default`, dashed, 8px gap)
- Border radius: 16px
- Height: 180px
- Center: upload icon (40px, teal) + "Drop PDF, image or scanned note here"
- Below: "or Browse files" text button in `color.primary.500`
- Drag-over state: border changes to `color.primary.500` solid, background tints to `color.primary.100`

**Document Grid (3 columns, 16px gap):**

Each document card:
- Background: `color.surface.card`, border: `color.border.default`, radius: 12px, shadow: `shadow.card`
- Top: 160px thumbnail area (blurred or file type illustration). Image preview if available.
- Body padding: 12px
- File name: `type.heading.md`, 1 line clipped
- Date: `type.label`, `color.text.secondary`
- Bottom row: Page count chip + Status badge ("Indexed" green | "Processing" amber spinner | "Failed" red)
- VLM/OCR mode badge on top-right of thumbnail (small pill: "VLM" or "OCR")
- Three-dot menu on hover (top-right of card): Delete, Re-index, View

**Processing state:**
- Under a processing card: a thin animated progress bar (`color.primary.500`)
- Label: "Indexing page 3 of 8…"

---

## Screen 3 — Task Tracker

**URL/Route:** `/tasks`

**Top Bar:** "Tasks & Deadlines" title + "+ Add Task" button

**Add Task Modal (triggered by button):**
- Overlay with 480px modal card, blur backdrop
- Fields: Task Title (text input), Subject (dropdown with colored chips), Due Date (date picker), Priority (3-way toggle: Low / Medium / High), Notes (optional textarea)
- Buttons: Cancel (ghost) | Save Task (amber filled)

**Task List (60% left panel):**

Sections with colored left-border accent:
- **Overdue** (red border): Rows have soft red background wash (`#FFF5F5`)
- **Due This Week** (amber border)
- **Upcoming** (gray border)

Each task row:
- Checkbox (custom, teal check on tick)
- Subject chip (rounded pill, e.g. "CSE-401" in teal, "MATH-301" in indigo)
- Task title: `type.body.lg`
- Due date: natural language ("Due tomorrow", "In 3 days") in `type.label`
- Priority dot (red/amber/gray, 8px circle, right-aligned)
- Hover state: subtle row highlight, reveal edit icon

**Mini Calendar (40% right panel):**
- Current week displayed in a 7-column calendar
- Today: filled teal circle on date number
- Days with tasks: small amber dot below date number
- Clicking a day filters the task list to that day

**Weekly Summary card (below calendar):**
- 3 stat badges side by side: "5 Completed ✅", "2 Missed ❌", "3 Pending 🕐"
- Each badge: icon + number + label, card background `color.surface.card`

**Reminder notification banner (bottom of screen, dismissible):**
- Background: `color.accent.100` (light amber)
- Left border: 3px `color.accent.500`
- Icon: 🔔 bell
- Text: "Your Physics assignment is due tomorrow at 11:59 PM"
- Right: "Dismiss" text button

---

## Screen 4 — Progress Review

**URL/Route:** `/progress`

**Top Bar:** "Weekly Progress" title + "Week of Nov 24–30" date range chip

**Progress Report Card (centered, max-width 800px):**

Large card with `shadow.card`, `border.radius.md`:
- **Card header:** "📊 Weekly Progress Review" in `type.heading.lg`, date range in `type.label`
- **Stat row:** 3 large chips — "7 Completed ✅" (green), "2 Missed ❌" (red), "70% On Time 🎯" (amber)
- **Subject breakdown section:** 
  Horizontal stacked bar for each subject (3 rows):
  Subject label (12px) | ████░░ bar (teal fill = done, gray = total) | "5/7 tasks" label
- **Sessions section:** "📚 You studied 4 times this week · Avg session: 38 min"
- **Assistant message section:** A blockquote-style card in `color.primary.100`:
  BhaiOS icon + "You improved your on-time rate from 40% to 70% this week. Your MATH-301 deadline is coming up — want to review those notes together?"
- **CTA row:** "Review MATH-301 notes" button (teal, medium) + "Dismiss" text button

**Study Streak widget (right sidebar of this screen):**
- 7-day streak visualization: filled teal circles for days studied, empty for missed
- "🔥 4-day streak" label below

---

## Component Library to Build

Create these as reusable Figma components with variants:

| Component | Variants |
|---|---|
| `Button` | Primary (teal filled), Secondary (outline teal), Ghost, Amber CTA, Danger; sizes: SM / MD / LG |
| `Badge / Chip` | Subject tag, Status badge (Indexed/Processing/Overdue/Success), Priority dot |
| `ModePill` | Guide Mode (active/inactive), Answer Mode (active/inactive) |
| `ChatBubble` | User, Assistant, Assistant-with-source, Loading (3-dot animation) |
| `DocumentCard` | Default, Processing, Hover, Error |
| `TaskRow` | Default, Overdue, Completed, Hover |
| `NavItem` | Icon+label, Active, Hover, Icon-only (collapsed sidebar) |
| `InputField` | Default, Focused, Error, With icon left, With icon right |
| `ProgressBar` | Thin (processing), Subject bar (progress report) |
| `Modal` | Add Task, Confirm action, Info |
| `NotificationBanner` | Info, Warning (overdue), Success |
| `StatCard` | Icon + number + label (for weekly summary stats) |
| `LatencyChip` | Good (< 10s, green), Slow (> 15s, amber), Loading |

---

## Prototype Interactions to Define

1. **Mode switch:** Click "Answer Mode" pill → confirmation dialog ("Switch to direct answers?") → mode changes, chat clears, Guide Mode dims.
2. **Document upload:** Drag file to upload zone → zone highlights → file appears as "Processing" card → after 3s, card transitions to "Indexed" (animate the status badge change).
3. **Task completion:** Click checkbox → row strikes through → moves to "Completed" section with smooth slide animation.
4. **Context panel collapse:** Click arrow → right panel slides out, main chat expands. Click again to restore.
5. **Sidebar collapse:** At 1280px or manual toggle → sidebar collapses to 64px icon-only width.
6. **Notification dismiss:** Click Dismiss on banner → banner slides down and fades out.

---

## Figma File Structure

```
📁 BhaiOS Design System
  ├── 🎨 Foundations
  │   ├── Colors (all tokens)
  │   ├── Typography (all scales)
  │   └── Spacing & Grid
  ├── 🧩 Components
  │   ├── Atoms (Button, Badge, Input, Icon)
  │   ├── Molecules (ChatBubble, DocumentCard, TaskRow, NavItem)
  │   └── Organisms (Sidebar, ChatPanel, ContextPanel, UploadZone)
  ├── 📱 Screens
  │   ├── 01 — Chat (Guide Mode)
  │   ├── 02 — Chat (Answer Mode)
  │   ├── 03 — Documents
  │   ├── 04 — Task Tracker
  │   ├── 05 — Weekly Progress
  │   ├── 06 — Settings
  │   └── 07 — Benchmark View (Dev mode)
  └── 🔗 Prototype Flow
      └── Main user journey (upload → chat → task → review)
```

---

## Design Inspirations & References

| Feel | Reference |
|---|---|
| Navigation & shell | Linear app — clean, dense, keyboard-driven |
| Chat UI | Claude.ai — calm, readable, assistant-forward |
| Document grid | Notion's gallery view — card-based, preview-first |
| Task tracker | Things 3 — list hierarchy, clean checkboxes |
| Color warmth | Bear Notes — warm off-white, not clinical white |
| Data cards | Vercel dashboard — monospace numbers, clean stat layout |
| Bangla text rendering | Prothom Alo web app — Noto Sans Bengali, generous line-height |

---

## Accessibility Requirements

- All text on colored backgrounds must meet **WCAG AA (4.5:1 contrast ratio minimum)**
- Interactive elements must have visible focus states (2px teal ring)
- Icon-only buttons must have a tooltip/aria-label equivalent
- Bangla text must have line-height ≥ 1.8 for readability
- All status indicators must NOT rely on color alone — use icon + color
```
