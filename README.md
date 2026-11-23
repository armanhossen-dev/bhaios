# BhaiOS

**A Local-First, Bangla-Aware Guided Learning Agent for Students**

BhaiOS is your "big brother" for studying. It doesn't do your work for you. It guides you, reminds you, reviews your progress, and helps you get it done yourself, in Bangla and English, on your own laptop.

> Status: 🚧 Early development (Final Year Project, Daffodil International University)

## Research Question

Does a guide-first (hint-based) local assistant improve task completion and learning engagement for Bangla-speaking students compared with a direct-answer assistant?

## Why BhaiOS?

- **Guide, don't solve:** hints and next steps instead of final answers
- **Bangla-aware:** reads and answers questions over Bangla and English documents
- **Local-first:** core features run offline, so your notes stay on your device
- **Accountability:** tracks tasks and deadlines, sends reminders, and reviews your week
- **Extensible:** optional external APIs for extra help

## Planned Features

- [ ] Local LLM chat (Ollama / llama.cpp)
- [ ] Bangla + English PDF and scanned-note ingestion (OCR)
- [ ] Local retrieval and question answering over your documents
- [ ] Guide mode vs. Answer mode
- [ ] Task, deadline, and reminder tracker
- [ ] Weekly progress review
- [ ] Voice input (Whisper)
- [ ] Bangla student-document benchmark
- [ ] User study and evaluation

## Tech Stack

Python · Ollama · llama.cpp · Whisper · Tesseract OCR · ChromaDB · SQLite · FastAPI · PyQt

## Architecture (planned)

```
Documents (PDF/scans) → OCR → Chunking → Local Vector Store
                                              ↓
Student input (text/voice) → Guide-mode policy → Local LLM → Hints / next steps
                                              ↓
                          Task memory + reminders + weekly review
```

## Roadmap

| Weeks | Goal |
|-------|------|
| 1-2 | Local LLM + chat UI |
| 3-4 | Document ingestion and retrieval |
| 5-6 | Task memory, reminders, guide-mode policy |
| 7-8 | Benchmark, user study, evaluation |

## Getting Started

```bash
git clone https://github.com/armanhossen-dev/bhaios.git
cd bhaios
pip install -r requirements.txt
```

Setup instructions will be added as the project develops.

## Author

**Arman Hossen** · CSE, Daffodil International University          
Portfolio: [armanhossen.is-a.dev](https://armanhossen.is-a.dev)     
GitHub: [@armanhossen-dev](https://github.com/armanhossen-dev)       

## License

MIT (to be confirmed)
