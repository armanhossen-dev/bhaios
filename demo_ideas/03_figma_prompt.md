# BhaiOS — Figma Design Prompt (2,000-Character Limit)

> **Exact Length:** `2,000` characters inside the code block below — ready to paste directly into **Figma AI / Figma Make** without hitting character limits.

```text
Design a complete Figma desktop app UI (1440x900) for BhaiOS, a local-first offline AI study assistant for Bangla & English students.

VISUAL SYSTEM & BLOCKS:
- Components: blocks.so (shadcn/ui modular blocks: AI chat, dropzone, tables, stat cards, modals).
- Dark Theme (Primary, Framer-style): Charcoal #0C0C0C root, #111111 sidebar, #161616 main, #1C1C1C cards, #242424 hover. Hairline 1px #2A2A2A panel borders, #333333 cards. Text: #F0F0F0 primary, #8A8A8A secondary, #555555 muted. Accents: Teal #2A8FA8 (active nav #1E2A2D + 2px left border, links, focus) & Amber #E8A020 (Guide pill #2A1E06, CTAs). Status: #3DBE82 ok, #E05252 err.
- Light Theme (Secondary, Flowstate-style): #FFFFFF base, #F5F5F5 sidebar, #0A0A0A text, #6B6B6B muted, #BEFF00 lime pill CTAs (999px radius) with #0A0A0A text.
- Typography (Unicorn Studio style): Instrument Serif (28-36px page titles, hero headers, big stat numbers) + Inter (11-15px UI, nav, body) + Noto Sans Bengali (15px, 1.8 line-height for Bangla) + JetBrains Mono (11-13px metrics/latency).

APP SHELL & 5 SCREENS:
- Left Sidebar (280px): Logo, nav (Chat, Documents, Tasks, Progress, Settings), bottom Guide Mode pill & local model/RAM status.
1. Chat: Top bar with Guide vs Answer Mode toggle pills + "~8s / resp" chip. User bubbles right (#1E2A2D); Assistant Socratic hint cards left (#1C1C1C, 3px #2A8FA8 left bar, Bangla/English text, "Show source"). Sticky input (attach, mic, send). Collapsible 320px right Context Panel with retrieved note snippets.
2. Documents: Drag-and-drop upload zone + 3-col library grid (thumbnail, VLM/OCR badge, progress bar, Indexed/Processing).
3. Tasks: Overdue/This Week/Upcoming rows (checkbox, subject chip, priority dot) + mini week calendar + reminder banner.
4. Progress: Weekly review card (stat chips, subject bars, Instrument Serif numerals, streak).
5. Benchmark (Dev): Side-by-side VLM vs OCR+LLM pipeline cards + CER/WER/latency table.

WCAG AA contrast, 2px #2A8FA8 focus rings, and icon+color markers.
```
