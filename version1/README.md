# BhaiOS — Version 1 Interactive Prototype

An interactive HTML/CSS/JS prototype of **BhaiOS**, built 1:1 from the 5-screen Figma design system (`PRJ-fall-2026-12485`).

## Structure

```text
version1/
├── index.html          # App shell, 280px sidebar, and all 6 screen views + task modal
├── css/
│   ├── tokens.css      # Dark Theme (Framer-style) & Light Theme (Flowstate + #FF5C16) tokens
│   └── styles.css      # Pixel-accurate layout, typography, cards, and component styles
├── js/
│   ├── data.js         # Bilingual Bangla/English study data, tasks, docs, and benchmark metrics
│   └── app.js          # Screen routing, Guide/Answer mode chat, upload, tasks, and CSV export
└── README.md
```

## Screens & Features Included

1. **Chat (`Dark`):** Guide Mode vs. Answer Mode toggle, bilingual Bangla/English Socratic hint cards, live message sending, and collapsible 320px `Retrieved context` panel with search & `Show source ↗` highlighting.
2. **Documents (`Dark`):** Drag-and-drop & file browser upload simulation, VLM/OCR badges, subject filter, search, and 3-column card grid.
3. **Tasks (`Dark`):** Overdue / This week / Upcoming sections, checkable tasks, `+ New task` modal, July 2025 mini week calendar, offline nudge card, and 45-min focus session trigger.
4. **Progress (`Light` with `#FF5C16`):** Flowstate-inspired light theme with `Instrument Serif` KPIs, 7-day study rhythm bar chart, subject focus bars, and `Start a quick review →` CTA.
5. **Benchmark / Dev (`Dark`):** Side-by-side VLM vs. OCR+LLM pipeline cards, CER/WER/latency/RAM comparison table, and working `Export CSV` button.
6. **Settings (`Dark`):** Local runtime configuration overview (`Qwen2.5 · 3B · Q4`, `Qwen2.5-VL · 3B`, strict offline mode).

## How to Run

Because `index.html` uses ES modules (`type="module"`), serve `version1/` over a local HTTP server:

```bash
cd version1
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.
