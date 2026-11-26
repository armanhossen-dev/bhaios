# BhaiOS — Demo Ideas

This folder contains detailed design and specification prompts for BhaiOS.

## Files

| File | Purpose | Use With |
|---|---|---|
| [`01_app_spec_prompt.md`](./01_app_spec_prompt.md) | Full system design prompt — modules, DB schema, API spec, evaluation protocol, risk table | GPT-4o, Claude, Gemini (paste the prompt to generate a full technical spec doc) |
| [`02_ui_ux_generation_prompt.md`](./02_ui_ux_generation_prompt.md) | Per-screen UI prompts + AI image generator prompts for each app screen and app icon | v0.dev, Galileo AI, Uizard, Midjourney, DALL·E 3, Ideogram |
| [`03_figma_prompt.md`](./03_figma_prompt.md) | Complete Figma design brief — design tokens, component library, layout spec, interaction spec, file structure | Figma AI, Galileo AI → Figma export, human designer handoff |

## How to Use

1. **Start with `01_app_spec_prompt.md`** to generate the full technical architecture from an AI assistant. This gives you the system design document, API routes, DB schema, prompt templates, and evaluation protocol.

2. **Use `02_ui_ux_generation_prompt.md`** to quickly generate UI mockups per screen. Paste individual screen prompts into v0.dev or Galileo for instant React/HTML mockups, or into Midjourney/DALL·E for visual concepts.

3. **Hand `03_figma_prompt.md` to a designer or Figma AI** to produce a production-ready design file with the full design token system, component library, and prototype flow.

## Design System Summary

- **UI Component Patterns:** [`blocks.so`](https://blocks.so/) (`shadcn/ui` modular app blocks — AI chat, file upload, stats, dialogs, tables)
- **Dark Theme (Primary):** Framer-inspired charcoal layering (`#0C0C0C` → `#111111` → `#161616` → `#1C1C1C`) with hairline `#2A2A2A` borders and Teal (`#2A8FA8`) + Amber (`#E8A020`) accents
- **Light Theme (Secondary):** Flowstate-inspired pure white (`#FFFFFF`), near-black (`#0A0A0A`), and acid lime (`#BEFF00`) pill CTAs
- **Typography:** `Instrument Serif` (Unicorn Studio-style display headlines) · `Inter` (UI/body) · `Noto Sans Bengali` (Bangla) · `JetBrains Mono` (metrics)

## Project Reference

- **Repo:** [https://github.com/armanhossen-dev/bhaios](https://github.com/armanhossen-dev/bhaios)
- **Google Site:** [https://www.armanhossen.is-a.dev/bhaios](https://www.armanhossen.is-a.dev/bhaios)
- **Team:** Swift Lions · `PRJ-fall-2026-12485` · DIU FYP
