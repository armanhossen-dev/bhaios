# BhaiOS — Figma Design Prompt

> Use this prompt with **Figma AI**, **FigJam AI**, **Galileo AI → Export to Figma**, or give it to a designer as a complete design brief. This is the most detailed and structured of the three prompts — covering design tokens, component inventory, layout spec, and interaction spec.

> **Theme:** Dark-first. Inspired by the Framer dashboard aesthetic — deep charcoal near-black backgrounds, subtle dark-gray panel layers, clean white text hierarchy, hairline borders, Inter font, dense and focused. BhaiOS teal and amber serve as the only accent colors against this dark canvas.

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
**Theme Mode:** Dark-first (Framer/Linear/Vercel aesthetic — deep charcoal, NOT pure black)

---

## Design Token System

### 🌑 Dark Theme Color Palette (PRIMARY — use this)

> Inspired by: Framer dashboard, Linear, Vercel dark, VS Code. Deep charcoal surfaces, not pure black. White text hierarchy. Single teal + amber accent pair on dark canvas.

| Token | Hex | Usage |
|---|---|---|
| `color.bg.base` | `#0C0C0C` | App root background (deepest layer) |
| `color.bg.sidebar` | `#111111` | Left sidebar background |
| `color.bg.panel` | `#161616` | Main content area, panel background |
| `color.bg.card` | `#1C1C1C` | Cards, chat bubbles, document tiles |
| `color.bg.card.hover` | `#242424` | Card hover state |
| `color.bg.input` | `#1A1A1A` | Input fields, text areas |
| `color.bg.overlay` | `#202020` | Modals, dropdowns, popovers |
| `color.bg.selected` | `#1E2A2D` | Active nav item background (teal-tinted dark) |
| `color.border.subtle` | `#2A2A2A` | Hairline borders between panels (Framer-style) |
| `color.border.default` | `#333333` | Card borders, dividers |
| `color.border.strong` | `#444444` | Input borders |
| `color.border.focus` | `#2A8FA8` | Focus rings (teal) |
| `color.text.primary` | `#F0F0F0` | Main headings, body text |
| `color.text.secondary` | `#8A8A8A` | Subtitles, timestamps, metadata |
| `color.text.tertiary` | `#555555` | Placeholder text, disabled states |
| `color.text.bangla` | `#E8E8E8` | Bangla body text (slightly softer than primary) |
| `color.text.inverse` | `#0C0C0C` | Text on light accent backgrounds |
| `color.accent.teal.500` | `#2A8FA8` | Primary teal — links, active states, focus |
| `color.accent.teal.400` | `#3BAEC9` | Hover teal, lighter teal accents |
| `color.accent.teal.900` | `#0D2C35` | Dark teal tint for selected bg |
| `color.accent.amber.500` | `#E8A020` | CTA buttons, Guide Mode pill, warning |
| `color.accent.amber.900` | `#2A1E06` | Dark amber tint for warning backgrounds |
| `color.status.error` | `#E05252` | Overdue tasks, error states |
| `color.status.error.bg` | `#1E0F0F` | Error background tint |
| `color.status.warning` | `#E8A020` | Due-soon, caution |
| `color.status.success` | `#3DBE82` | Completed, indexed |
| `color.status.success.bg` | `#0D1E16` | Success background tint |

### ☀️ Light Theme Color Palette (Flowstate-Inspired — Pure White + Acid Green)

> Inspired by: Flowstate.io — pure white background, near-black text (not pure black), **acid/lime green** (`#BEFF00`) as the single pop accent. Pill-shaped buttons. Clean label uppercase text. The same editorial serif headline works beautifully here too: large Instrument Serif near-black on white.

| Token | Hex | Usage |
|---|---|---|
| `light.bg.base` | `#FFFFFF` | App root (pure white — same as Flowstate) |
| `light.bg.sidebar` | `#F5F5F5` | Left sidebar (barely-off-white, 1px darker than main) |
| `light.bg.card` | `#FFFFFF` | Card surfaces |
| `light.bg.card.hover` | `#F8F8F8` | Card hover, row hover |
| `light.bg.input` | `#FFFFFF` | Input fields |
| `light.bg.selected` | `#F0FDE0` | Selected state tint (lime green tinted) |
| `light.border.subtle` | `#F0F0F0` | Hairline borders between panels |
| `light.border.default` | `#E4E4E4` | Card borders, dividers |
| `light.border.strong` | `#CCCCCC` | Input borders, focused input |
| `light.border.focus` | `#2A8FA8` | Focus ring (keep teal for accessibility) |
| `light.text.primary` | `#0A0A0A` | Main headings, body text (near-black, NOT pure #000) |
| `light.text.secondary` | `#6B6B6B` | Subtitles, descriptions, body copy |
| `light.text.tertiary` | `#AAAAAA` | Placeholders, disabled, timestamps |
| `light.text.label` | `#888888` | Small uppercase category labels ("GUIDE MODE", "DOCUMENTS") |
| `light.text.bangla` | `#1A1A1A` | Bangla body text |
| `light.accent.lime` | `#BEFF00` | **Primary CTA** — "Guide Mode" pill, primary button, active badge |
| `light.accent.lime.hover` | `#AAEE00` | Lime button hover |
| `light.accent.lime.text` | `#0A0A0A` | Text ON lime green (always near-black, not white) |
| `light.accent.lime.bg` | `#F5FFD6` | Very light lime tint for selected rows, active bg |
| `light.accent.teal` | `#2A8FA8` | Secondary accent — links, source indicators, focus |
| `light.status.error` | `#DC2626` | Overdue tasks, error states |
| `light.status.error.bg` | `#FEF2F2` | Error background tint |
| `light.status.warning` | `#D97706` | Due-soon, caution |
| `light.status.warning.bg` | `#FFFBEB` | Warning background tint |
| `light.status.success` | `#16A34A` | Completed, indexed |
| `light.status.success.bg` | `#F0FDF4` | Success background tint |

**Light Theme Button System (Flowstate-Style Pill Buttons):**

| Button | Background | Text | Border | Border Radius |
|---|---|---|---|---|
| Primary CTA | `#BEFF00` (lime) | `#0A0A0A` | none | `999px` (full pill) |
| Secondary | `#FFFFFF` | `#0A0A0A` | `1.5px solid #0A0A0A` | `999px` (full pill) |
| Tertiary / Ghost | transparent | `#6B6B6B` | `1px solid #E4E4E4` | `999px` |
| Danger | `#FEF2F2` | `#DC2626` | `1px solid #FCA5A5` | `8px` |
| Nav CTA ("Sign up") | `#0A0A0A` | `#FFFFFF` | none | `999px` |

**Category Label Style (Flowstate "WORKFLOW AUTOMATION, REIMAGINED"):**
```
font: Inter 11px 600
letter-spacing: 0.1em
text-transform: uppercase
color: #AAAAAA
```

**Light Theme Sidebar:**
- Background: `#F5F5F5`, right border: `1px solid #F0F0F0`
- Active nav item: `2px solid #0A0A0A` left border + background `#F0FDE0` (lime tint)
- Hover: background `#F0F0F0`
- Text: `#0A0A0A` active, `#6B6B6B` inactive
- Guide Mode pill: `#BEFF00` background, `#0A0A0A` text, full pill radius

---

### Typography

> **Font stack (Unicorn Studio / editorial dark aesthetic):**
> - **Display & headings:** `Instrument Serif` — elegant transitional serif with high stroke contrast. As seen on unicorn.studio. Free on Google Fonts. Use at 22px+ for page titles, hero text, section headers. This is what gives BhaiOS a distinct, non-generic look against the charcoal dark background.
> - **UI & body:** `Inter` — geometric sans-serif for all UI labels, chat messages, metadata. Same as Framer, Linear, Vercel.
> - **Bangla:** `Noto Sans Bengali` — renders Unicode Bangla correctly. Use for all Bangla content.
> - **Metrics & numbers:** `JetBrains Mono` — monospace for latency, stats, model names, timestamps.
>
> **The key typographic move (from Unicorn Studio):** Large `Instrument Serif` white headline on dark charcoal bg → smaller `Inter` muted gray body below. The font contrast alone creates hierarchy — no color needed.

| Token | Font | Size | Weight | Line Height | Usage |
|---|---|---|---|---|---|
| `type.display` | **Instrument Serif** | 36px | 400 | 1.2 | Hero text, empty state headings, onboarding |
| `type.heading.xl` | **Instrument Serif** | 28px | 400 | 1.25 | Page titles ("My Study Materials", "Weekly Progress") |
| `type.heading.lg` | **Instrument Serif** | 22px | 400 | 1.3 | Section headers, review card titles |
| `type.heading.md` | Inter | 15px | 600 | 1.4 | Card titles, panel headers, sub-sections |
| `type.heading.sm` | Inter | 11px | 600 | 1.4 | Sidebar section labels (uppercase, letter-spaced 0.08em) |
| `type.body.lg` | Inter | 15px | 400 | 1.6 | Main body text, chat messages |
| `type.body.md` | Inter | 14px | 400 | 1.6 | Secondary body, descriptions, tooltips |
| `type.label` | Inter | 12px | 500 | 1.4 | Badges, tags, metadata |
| `type.label.sm` | Inter | 11px | 500 | 1.3 | Timestamps, tiny metadata (Framer-style compact density) |
| `type.mono` | JetBrains Mono | 13px | 400 | 1.5 | Latency stats, metric numbers, CER/WER values |
| `type.code` | JetBrains Mono | 12px | 400 | 1.5 | Inline code, model names, file paths |
| `type.bangla.body` | Noto Sans Bengali | 15px | 400 | 1.8 | Bangla body text in chat/docs |
| `type.bangla.label` | Noto Sans Bengali | 13px | 400 | 1.6 | Bangla tags, subject labels |

**Where to use Instrument Serif:**
- Welcome / empty state: `"What would you like to study today?"` — 36px, `#F0F0F0`, Instrument Serif italic optional
- Page titles: "My Study Materials", "Tasks & Deadlines", "Weekly Progress" — 28px
- Weekly review card header — editorial serif gives it a dignified, reportlike feel
- Large stat numerals in progress view (e.g. "7" completed) — Instrument Serif numerals look elegant at big sizes
- **Never use for:** nav labels, input fields, badges, small UI text — Inter only there

**Google Fonts import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap');
```

**Fallback stack:**
```css
/* Display headings */
font-family: 'Instrument Serif', 'Playfair Display', 'DM Serif Display', Georgia, serif;
/* UI / body */
font-family: 'Inter', 'Helvetica Neue', system-ui, sans-serif;
```

---

### Spacing & Layout

> **Density:** Framer-style compact density — tighter than typical SaaS apps. Rows feel dense; padding is purposeful.

| Token | Value | Usage |
|---|---|---|
| `space.xs` | 4px | Inline icon gaps |
| `space.sm` | 8px | Inner component padding, row height padding |
| `space.md` | 16px | Card padding, section gaps |
| `space.lg` | 24px | Column gaps, section breaks |
| `space.xl` | 40px | Page-level padding |
| `space.2xl` | 64px | Between major sections |
| `border.radius.xs` | 4px | Tags, chips (Framer-style very tight rounding) |
| `border.radius.sm` | 6px | Buttons, small elements |
| `border.radius.md` | 10px | Cards, panels |
| `border.radius.lg` | 16px | Message bubbles, mode pills |
| `shadow.card` | `0 1px 4px rgba(0,0,0,0.4)` | Dark-theme cards (deeper shadow on dark bg) |
| `shadow.sidebar` | `1px 0 0 #2A2A2A` | Sidebar right hairline border (Framer-style) |
| `shadow.popover` | `0 8px 32px rgba(0,0,0,0.6)` | Dropdowns, modals on dark bg |
| `shadow.glow.teal` | `0 0 12px rgba(42,143,168,0.2)` | Active state subtle glow on dark bg |

---

## 🌑 Dark Theme Design Rules (Framer-Style)

Apply these rules across every screen:

1. **Never use pure black (#000).** Use `#0C0C0C` for the deepest background. Layers stack upward in luminance: `#0C0C0C` → `#111111` → `#161616` → `#1C1C1C` → `#242424`.
2. **Borders are hairlines, not heavy.** Use `1px solid #2A2A2A` between panels. Use `1px solid #333333` for card outlines. Never use thick decorative borders.
3. **Text is NOT pure white.** Primary text is `#F0F0F0`. Secondary is `#8A8A8A`. Tertiary is `#555555`. This creates a natural hierarchy without harsh contrast.
4. **Teal and amber are the ONLY accent colors.** Everything else is neutral gray. No purple, blue, or red except for semantic states (error = `#E05252`).
5. **Sidebar** has a hairline right border (`1px solid #2A2A2A`), not a shadow. Active nav item gets a teal left border (2px) and a very subtle dark-teal background (`#1E2A2D`).
6. **Inter font everywhere.** The same Inter used by Framer, Linear, Vercel. No other sans-serif. Only Noto Sans Bengali for Bangla text and JetBrains Mono for numbers.
7. **Icons:** 16px or 20px, `color: #8A8A8A` by default, `#F0F0F0` on hover/active. Use Lucide icons or Heroicons (same as Framer/Linear aesthetic).
8. **Hover states:** Subtle — `background: #242424` for rows, `border-color: #444444` for inputs. No dramatic color changes.
9. **Focus states:** `2px solid #2A8FA8` ring with `2px offset`. Visible but not garish.
10. **Status colors always pair with an icon** — never color alone (accessibility rule).

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

**Sidebar specs (Dark Theme):**
- Background: `#111111`
- Right edge: `1px solid #2A2A2A` (hairline, Framer-style — no box shadow)
- Width: 280px (collapses to 56px icon-only at < 1280px)
- Logo area (56px height): BhaiOS icon (teal on dark) + wordmark "BhaiOS" in `#F0F0F0` Inter 600 15px
- Nav items: icon (18px, `#8A8A8A` default → `#F0F0F0` hover/active) + label (Inter 13px 500, `#8A8A8A` default → `#F0F0F0` active)
- Active nav item: `2px solid #2A8FA8` left border + background `#1E2A2D` (dark teal tint)
- Hover nav item: background `#1A1A1A`
- Section separator: `1px solid #2A2A2A` horizontal rule
- Bottom section: "🧭 Guide Mode" pill (amber `#E8A020` tint) + latency chip in JetBrains Mono 11px (`#555555`)
- RAM/model indicator: "llama3.2:3b • 7.2 GB RAM" in `#555555` 11px at very bottom

---

## Screen 1 — Chat Interface (Guide Mode)

**URL/Route:** `/chat`

### Layout
```
[Sidebar] | [Chat Panel (flex)] | [Context Panel (320px, collapsible)]
```

**Top Bar (Dark Theme):**
- Background: `#161616`, bottom border: `1px solid #2A2A2A`
- Left: "Chat" page title (`#F0F0F0`, Inter 15px 500)
- Center: Mode toggle pills:
  - "🧭 Guide Mode" active: `background #2A1E06`, `border 1px solid #E8A020`, text `#E8A020`, Inter 12px 500
  - "💬 Answer Mode" inactive: `background #1A1A1A`, `border 1px solid #333333`, text `#555555`, Inter 12px 500
- Right: Latency chip (JetBrains Mono 11px, `#555555`): "~8s / resp" in a `#1A1A1A` pill with `#2A2A2A` border

**Chat Area (Dark Theme):**
- Background: `#161616`
- Message alignment: User right, Assistant left
- **User message bubble:**
  - Background: `#1E2A2D` (dark teal tint)
  - Border: `1px solid #2A3D45`
  - Border radius: 14px 14px 4px 14px
  - Max width: 68%
  - Padding: 10px 14px
  - Text: `#E8E8E8`, Inter 14px
  - Timestamp below in `#555555` 11px JetBrains Mono
- **Assistant message bubble:**
  - Background: `#1C1C1C`
  - Border: `1px solid #2A2A2A`
  - Left accent bar: `3px solid #2A8FA8` (teal)
  - Border radius: 4px 14px 14px 14px
  - Max width: 76%
  - Padding: 12px 14px
  - BhaiOS icon (14px, teal) top-left inside bubble
  - Bangla text: Noto Sans Bengali 15px, `#E8E8E8`, line-height 1.8
  - Below message: "Show source →" in `#2A8FA8` 12px Inter
- **Scroll behavior:** Auto-scroll to latest; "↓ New message" pill in teal when scrolled up

**Input Bar (Dark Theme, bottom sticky):**
- Background: `#111111`, top border: `1px solid #2A2A2A`
- Height: 60px, padding: 0 16px
- Left icon: paperclip `#555555`, hover `#8A8A8A`
- Input field: `background #1A1A1A`, `border 1px solid #333333`, `border-radius 8px`, `padding 8px 12px`
  - Placeholder "Ask BhaiOS anything..." in `#555555`, Inter 14px
  - Focus: `border-color #2A8FA8`, teal ring
- Right icons: mic `#333333` (disabled/future), send button `#2A8FA8` filled circle, `#F0F0F0` arrow icon

**Context Panel (Dark Theme, right 320px):**
- Background: `#111111`, left border: `1px solid #2A2A2A`
- Header: "Related from your notes" in `#8A8A8A` Inter 11px 500 uppercase tracking-wide + collapse arrow
- Chunk cards: `background #1C1C1C`, `border 1px solid #2A2A2A`, `border-radius 8px`, padding 10px
  - File type icon (16px, `#555555`)
  - File name: `#F0F0F0` Inter 12px 500
  - Snippet: `#8A8A8A` Inter 12px, 2-line clamp
  - "Page 4 · Physics_Notes.pdf" in `#555555` 11px
- Section divider: `1px solid #2A2A2A`
- "Recent Documents": 3 rows, `hover background #1A1A1A`, same density as Framer sidebar items

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
| **Overall dark theme & density** | **Framer dashboard** — deep charcoal surfaces, hairline borders, Inter font, compact nav |
| **UI components & block patterns** | **[blocks.so](https://blocks.so/)** — clean, modern `shadcn/ui`-style application blocks (AI chat, file upload, dialogs, stats, data tables) |
| **Light theme palette** | **Flowstate** — pure white `#FFFFFF`, near-black `#0A0A0A`, acid lime `#BEFF00` CTA pills |
| **Display typography** | **Unicorn Studio** — `Instrument Serif` large headlines paired with muted `Inter` body |
| Navigation & shell | **Linear app** — clean, dense, keyboard-driven, icon+label sidebar |
| Chat UI | **Claude.ai** — calm, readable, assistant-forward message layout |
| Dark surface layering | **Vercel dashboard** — `#0A0A0A` → `#111` → `#1A1A1A` elevation system |
| Document grid | **Notion dark mode** — card-based, preview-first, tight radius |
| Task tracker | **Linear Issues** — compact list rows, status chips, priority dots |
| Monospace metrics | **Vercel analytics** — JetBrains Mono numbers, clean stat layout |
| Bangla text rendering | **Prothom Alo web app** — Noto Sans Bengali, generous line-height |
| Accent color on dark | **Raycast** — single accent color (teal) pops against charcoal canvas |

---

## Accessibility Requirements

- All text on dark backgrounds must meet **WCAG AA (4.5:1 contrast ratio minimum)** — `#8A8A8A` on `#161616` = 4.6:1 ✅
- Interactive elements must have visible focus states: `2px solid #2A8FA8`, `2px offset`
- Icon-only buttons must have tooltip on hover
- Bangla text must have `line-height ≥ 1.8` for readability
- Status indicators always pair icon + color (never color alone)
- Hover states must be visible even on the darkest backgrounds
```
