# BhaiOS

**A Local Vision-Language Study Assistant with Guide-First Assistance for Bangla-Speaking Students**

BhaiOS is a local-first study assistant for Bangla-speaking students that combines a large language model with a vision-language model. It can see and understand the student's study material—including scanned pages, handwritten notes, slides, diagrams, and screenshots—in Bangla and English. Instead of giving final answers, it works in **guide-first mode**: it provides hints, asks guiding questions, reminds students of deadlines, and reviews weekly progress so the student completes the work themselves.

> **Status:** 🛡️ Published for Title Defense (Team: **Swift Lions** · ID: `PRJ-fall-2026-12485` · Daffodil International University)

---

## Research Questions

1. **Vision vs. OCR Pipeline:** How well do local vision-language models understand Bangla and English study material compared with an OCR + LLM pipeline?
2. **Guide-First vs. Direct Answer:** Does a guide-first (hint-based) local assistant improve task completion and learning engagement for Bangla-speaking students compared with a direct-answer assistant?

---

## Why BhaiOS?

- **Vision-Language Understanding:** Comprehends handwritten notes, scanned pages, textbook diagrams, and screenshots directly.
- **Guide, Don't Solve:** Prompts with hints, breakdowns, and next steps instead of spoon-feeding final answers.
- **Bangla & English Aware:** Native understanding across mixed Bangla and English course materials.
- **Local-First & Private:** Core features run completely offline on a standard laptop (target: 16 GB RAM, no dedicated GPU, 4-bit quantized models)—private study materials never leave your device.
- **Accountability & Tracking:** Tracks tasks and deadlines, schedules reminders, and generates weekly progress reviews.
- **Study Resource Recommender:** Suggests topic-specific video explanations (e.g., YouTube) and provides an opt-in agent mode with confirmation for simple automations (stretch goals).

---

## Planned Features

- [ ] Local Vision-Language Model inference (target: 16 GB RAM, 4-bit quantized via Ollama / llama.cpp)
- [ ] Handwritten notes, scanned documents, slides, and diagram comprehension in Bangla & English
- [ ] VLM vs. OCR + LLM comparative evaluation (CER/WER, answer accuracy, latency per page)
- [ ] Local vector retrieval (ChromaDB) over course documents
- [ ] Guide mode (Socratic hints) vs. Direct Answer mode (evaluated via task completion, on-time rate, quiz gain)
- [ ] Task, deadline, and reminder tracker with weekly progress reviews
- [ ] Study-resource recommender (topic-based video search - stretch goal)
- [ ] Opt-in Agent mode with confirmation for simple automations (stretch goal)
- [ ] Bangla study-material benchmark (~100 questions over ~40 pages of real student course material)
- [ ] User study & evaluation (10–15 students over 2–3 weeks with anonymized local logs)
- [ ] Future: Voice input (Whisper) & local AI IDE integration

---

## Tech Stack

Python · LLM · Ollama · llama.cpp · Vision-Language Models · Whisper · Tesseract OCR · OpenCV · ChromaDB · SQLite · FastAPI · PyQt · YouTube Data API · Hugging Face Transformers

---

## Architecture (planned)

```
Study Material (Scans, Handwriting, Diagrams, PDFs)
                          ↓
      Local VLM / OCR + Chunking → Local Vector Store (ChromaDB)
                                              ↓
Student Query (Text/Voice) → Guide-First Policy → Local LLM/VLM → Hints & Next Steps
                                              ↓
             Task Memory + Reminders + Resource Finder + Weekly Review
```

---

## Roadmap

| Weeks | Milestone |
|-------|-----------|
| **1–2** | Local VLM & LLM setup + testing Bangla handwriting/scans + Chat UI |
| **3–4** | Document ingestion, diagram analysis, and local retrieval |
| **5–6** | Task memory, reminders, resource recommender, guide-mode policy |
| **7–8** | Benchmark dataset creation, user study (10–15 students), evaluation |

---

## Getting Started

```bash
git clone https://github.com/armanhossen-dev/bhaios.git
cd bhaios
pip install -r requirements.txt
```

*Setup instructions and model weights guide will be added as the project develops.*

---

## Author

**Arman Hossen** · Department of Computer Science & Engineering, Daffodil International University  
Portfolio: [armanhossen.is-a.dev](https://armanhossen.is-a.dev) · Project Site: [armanhossen.is-a.dev/bhaios](https://www.armanhossen.is-a.dev/bhaios) · GitHub: [@armanhossen-dev](https://github.com/armanhossen-dev)

---

## License

MIT (to be confirmed)
