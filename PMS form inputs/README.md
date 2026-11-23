# Final PMS Submission Record — BhaiOS

> **Project Name:** BhaiOS: A Local Vision-Language Study Assistant with Guide-First Assistance for Bangla-Speaking Students  
> **Team Name:** Swift Lions  
> **Project ID:** PRJ-fall-2026-12485  
> **Stage:** Title Defense  
> **Status:** Published (Submitted in DIU PMS Portal)  
> **Title Edits Used:** 0 / 3  

---

## 📋 Exact Submitted Portal Data

### Project Header
- **Project Title:** `BhaiOS: A Local Vision-Language Study Assistant with Guide-First Assistance for Bangla-Speaking Students`
- **Team:** `Swift Lions`
- **Project ID:** `PRJ-fall-2026-12485`
- **Stage:** `Title Defense`
- **Publication Status:** `Published`
- **Title Edits Used:** `0 / 3`

---

### Project Overview

#### TYPE
```text
Software, Research
```

#### RESEARCH FIELDS
- `Generative AI & LLMs`
- `Computer vision`
- `NLP & Bangla NLP`
- `Human-computer interaction`
- `Educational technology`

#### TECHNOLOGIES
```text
Python, LLM, Ollama, llama.cpp, Vision-Language Models, Whisper, Tesseract OCR, OpenCV, ChromaDB, SQLite, FastAPI, PyQt, YouTube Data API, Hugging Face Transformers
```
*(Status: Awaiting supervisor confirmation)*

#### GOOGLE SITE
```text
www.armanhossen.is-a.dev/bhaios
```
URL: [https://www.armanhossen.is-a.dev/bhaios](https://www.armanhossen.is-a.dev/bhaios)

#### CODE, DEMO & VIDEO
- **Code:** `https://github.com/armanhossen-dev/bhaios` *(Awaiting supervisor confirmation)*
- **Live Demo:** `Not provided`
- **Demo Video:** `Not provided`

---

### Description & Goals

#### DESCRIPTION
```text
BhaiOS is a local-first study assistant for Bangla-speaking students that combines a large language model with a vision-language model. It can see and understand the student's study material, including scanned pages, handwritten notes, slides, diagrams, and screenshots, in Bangla and English. Instead of giving final answers, it works in guide-first mode: it gives hints, asks guiding questions, reminds students of deadlines, and reviews weekly progress so the student completes the work themselves. It also recommends study resources such as relevant YouTube videos, and in an optional opt-in agent mode with user confirmation it can run simple automations. Voice control and local AI IDE integration are planned as future extensions. All core features run offline on a laptop, so private documents never leave the device.

Research questions: (1) How well do local vision-language models understand Bangla and English study material compared with an OCR + LLM pipeline? (2) Does a guide-first local assistant improve task completion and learning engagement for Bangla-speaking students compared with a direct-answer assistant?

The system is built as a working tool and evaluated through a small Bangla study-material benchmark and a short user study.

Evaluation and data: the benchmark is built from the author's own notes, volunteer-provided handwritten pages, and openly licensed course material; questions are written by the author and verified by a second reviewer. The user study compares guide-first and direct-answer modes using task completion, on-time submission, pre/post quiz gain, and a short survey; with a small sample, results are reported descriptively with effect sizes. Timeline: weeks 1-2 model setup and Bangla testing; weeks 3-4 document understanding and retrieval; weeks 5-6 guide-mode policy, task tracker, reminders; weeks 7-8 benchmark, user study, evaluation. Agent mode and resource recommendation are stretch goals.
```

#### OBJECTIVE
```text
1. Build a local-first study assistant that runs offline on a standard laptop (target: 16 GB RAM, no dedicated GPU, 4-bit quantized models).
2. Integrate a local vision-language model (VLM) to understand scanned pages, handwritten notes, slides, and diagrams in Bangla and English.
3. Compare the VLM approach against an OCR + LLM pipeline using: transcription error rate (CER/WER), answer accuracy (rubric score on the benchmark), and latency per page.
4. Implement local retrieval for question answering over the student's own documents.
5. Design a guide-first mode (hints and next steps) and a direct-answer mode, and compare them on task completion rate, on-time submission rate, pre/post quiz score gain, and a short engagement survey.
6. Add a task, deadline, and reminder tracker with weekly progress reviews.
7. Add a study-resource recommender and an opt-in agent mode with user confirmation (stretch goals).
8. Build a Bangla study-material benchmark of about 100 questions over about 40 pages (printed Bangla, handwritten Bangla, English slides, diagrams), with ground-truth transcriptions.
9. Run a user study with 10-15 students over 2-3 weeks with informed consent and anonymized local logs.
10. Release the core as an open-source tool.
```

#### MOTIVATION
```text
Most AI tools students use today give final answers, which weakens learning and builds dependence. They also support Bangla poorly, struggle with handwritten and scanned Bangla material, need internet, and send private academic documents to remote servers. Many students in Bangladesh struggle with deadlines and self-discipline and have no affordable tool that supports them in their own language. BhaiOS addresses this by being private, offline-capable, able to see Bangla study material, and designed to keep the student doing the work with guidance. The project also contributes a comparison of local vision-language models on Bangla study material and a reusable benchmark.
```

---

## 🛡️ Defense Notes & Talking Points

- **Team:** Swift Lions (`PRJ-fall-2026-12485`)
- **Key Technical Priority:** Week 1 benchmarks for local vision-language models on handwritten Bangla.
- **Differentiation vs. Cloud Assistants:**
  - **100% Local & Private:** No sensitive notes sent to external servers.
  - **Vision-Language Native:** Direct OCR-free understanding of diagrams and handwritten scripts.
  - **Pedagogical Scaffolding (Guide-First):** Socratic hints rather than spoon-fed solutions.
