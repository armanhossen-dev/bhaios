# 🧠 BhaiOS

**A local, private study assistant that sees your notes and teaches you to solve, not just copy.**

Built for Bangla-speaking students. Runs offline on a standard laptop.
<!--
![Status](https://img.shields.io/badge/status-title%20defense-blue)
-->
![Runs](https://img.shields.io/badge/runs-100%25%20local-green)
![Languages](https://img.shields.io/badge/language-বাংলা%20%7C%20English-orange)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

> Research project · Team **Swift Lions** · Daffodil International University

---

## Why BhaiOS?

Most AI tools hand students the final answer. BhaiOS doesn't.

| | |
|---|---|
| 👁️ **Sees your material** | Handwritten notes, scans, slides, diagrams, screenshots, in Bangla and English |
| 🧭 **Guide-first** | Hints, guiding questions, and next steps instead of final answers |
| 🔒 **Local & private** | Offline, 4-bit quantized models, target 16 GB RAM, no GPU. Your notes never leave your device |
| ⏰ **Accountable** | Tracks tasks and deadlines, sends reminders, writes weekly progress reviews |

---

## Research Questions

1. **VLM vs. OCR + LLM:** How well do local vision-language models understand Bangla and English study material compared with an OCR + LLM pipeline?
2. **Guide-first vs. direct answer:** Does a hint-based assistant improve task completion and learning engagement compared with a direct-answer one?

---

## How It Works

```
Scans / Handwriting / Diagrams / PDFs
              ↓
   Local VLM or OCR → Chunking → ChromaDB
                                    ↓
Student Query → Guide-First Policy → Local LLM/VLM → Hints & Next Steps
                                    ↓
        Tasks · Reminders · Resource Finder · Weekly Review
```

**Stack:** Python · Ollama · llama.cpp · Hugging Face Transformers · Tesseract · OpenCV · ChromaDB · SQLite · FastAPI · PyQt · Whisper

---

## Roadmap

- [ ] **Wk 1–2:** Local VLM/LLM setup, Bangla handwriting and scan tests, chat UI
- [ ] **Wk 3–4:** Document ingestion, diagram analysis, local retrieval
- [ ] **Wk 5–6:** Task memory, reminders, guide-mode policy
- [ ] **Wk 7–8:** Bangla benchmark (~100 questions, ~40 pages), user study (10–15 students), evaluation

**Stretch goals:** video resource recommender · opt-in agent mode · Whisper voice input

---

## Evaluation

- **VLM vs. OCR + LLM:** CER/WER, answer accuracy, latency per page
- **Guide vs. direct mode:** task completion, on-time rate, quiz gain

---

## Quick Start

```bash
git clone https://github.com/armanhossen-dev/bhaios.git
cd bhaios
pip install -r requirements.txt
```

Model setup guide coming as the project develops.

---

## Author

**Arman Hossen** · CSE, Daffodil International University
[Portfolio](https://armanhossen.is-a.dev) · [Project site](https://www.armanhossen.is-a.dev/bhaios) · [@armanhossen-dev](https://github.com/armanhossen-dev)

## License

MIT (to be confirmed)# 🧠 BhaiOS

**A local, private study assistant that sees your notes and teaches you to solve, not just copy.**

Built for Bangla-speaking students. Runs offline on a standard laptop.

![Status](https://img.shields.io/badge/status-title%20defense-blue)
![Runs](https://img.shields.io/badge/runs-100%25%20local-green)
![Languages](https://img.shields.io/badge/language-বাংলা%20%7C%20English-orange)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

> Research project · Team **Swift Lions** · Daffodil International University

---

## Why BhaiOS?

Most AI tools hand students the final answer. BhaiOS doesn't.

| | |
|---|---|
| 👁️ **Sees your material** | Handwritten notes, scans, slides, diagrams, screenshots, in Bangla and English |
| 🧭 **Guide-first** | Hints, guiding questions, and next steps instead of final answers |
| 🔒 **Local & private** | Offline, 4-bit quantized models, target 16 GB RAM, no GPU. Your notes never leave your device |
| ⏰ **Accountable** | Tracks tasks and deadlines, sends reminders, writes weekly progress reviews |

---

## Research Questions

1. **VLM vs. OCR + LLM:** How well do local vision-language models understand Bangla and English study material compared with an OCR + LLM pipeline?
2. **Guide-first vs. direct answer:** Does a hint-based assistant improve task completion and learning engagement compared with a direct-answer one?

---

## How It Works

```
Scans / Handwriting / Diagrams / PDFs
              ↓
   Local VLM or OCR → Chunking → ChromaDB
                                    ↓
Student Query → Guide-First Policy → Local LLM/VLM → Hints & Next Steps
                                    ↓
        Tasks · Reminders · Resource Finder · Weekly Review
```

**Stack:** Python · Ollama · llama.cpp · Hugging Face Transformers · Tesseract · OpenCV · ChromaDB · SQLite · FastAPI · PyQt · Whisper

---

## Roadmap

- [ ] **Wk 1–2:** Local VLM/LLM setup, Bangla handwriting and scan tests, chat UI
- [ ] **Wk 3–4:** Document ingestion, diagram analysis, local retrieval
- [ ] **Wk 5–6:** Task memory, reminders, guide-mode policy
- [ ] **Wk 7–8:** Bangla benchmark (~100 questions, ~40 pages), user study (10–15 students), evaluation

**Stretch goals:** video resource recommender · opt-in agent mode · Whisper voice input

---

## Evaluation

- **VLM vs. OCR + LLM:** CER/WER, answer accuracy, latency per page
- **Guide vs. direct mode:** task completion, on-time rate, quiz gain

---

## Quick Start

```bash
git clone https://github.com/armanhossen-dev/bhaios.git
cd bhaios
pip install -r requirements.txt
```

Model setup guide coming as the project develops.

---

## Author

**Arman Hossen** · CSE, Daffodil International University
[Portfolio](https://armanhossen.is-a.dev) · [Project site](https://www.armanhossen.is-a.dev/bhaios) · [@armanhossen-dev](https://github.com/armanhossen-dev)

## License

MIT (to be confirmed)
