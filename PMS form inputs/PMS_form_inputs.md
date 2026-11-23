# Project Management System (PMS) Form Inputs

> **Project Name:** BhaiOS  
> **Prepared for:** Final Year Project (FYP) Submission — Daffodil International University (DIU)  
> **Notice:** Double-check the title before submitting to the portal (maximum 3 edits allowed).

---

## Quick Copy-Paste Form Fields

### 1. Project Title
```text
BhaiOS: A Local-First, Bangla-Aware Guided Learning Agent for Students
```

---

### 2. Type
```text
Software, Research
```

---

### 3. Research Fields
```text
Generative AI & LLMs, NLP & Bangla NLP, Human-computer interaction, Educational technology, Local-first AI
```

---

### 4. Technologies Used
*(Press **Enter** or add comma after each in the portal)*
```text
Python, Ollama, llama.cpp, Whisper, Tesseract OCR, ChromaDB, SQLite, FastAPI, PyQt, Hugging Face Transformers
```

**Individual Items List:**
- `Python`
- `Ollama`
- `llama.cpp`
- `Whisper`
- `Tesseract OCR`
- `ChromaDB`
- `SQLite`
- `FastAPI`
- `PyQt`
- `Hugging Face Transformers`

---

### 5. Description
```text
BhaiOS is a local-first, Bangla-aware personal agent built for students. Instead of solving academic work for the student, it acts like a "big brother": it gives hints, asks guiding questions, reminds the student of deadlines, and reviews weekly progress so the student completes the work themselves. It reads Bangla and English documents (PDFs, scanned notes, slides) using on-device OCR and retrieval, then generates summaries, practice questions, and study plans from the student's own material. All core features run offline on a laptop, so private documents never leave the device; optional external APIs can be added for extra help. Beyond guidance, BhaiOS can optionally recommend study resources (such as relevant YouTube videos for a topic) and, in an opt-in agent mode with user confirmation, run simple automations on the student's behalf. Voice-controlled tool use and IDE integration are planned as future extensions.

Research question: Does a guide-first (hint-based) local assistant improve task completion and learning engagement for Bangla-speaking students compared with a direct-answer assistant?

The system is built as a working tool and evaluated as research through a small Bangla student-document benchmark and a short user study.
```

---

### 6. Objective
```text
1. Build a local-first student assistant that runs offline on a standard laptop.
2. Implement Bangla and English document ingestion (OCR, chunking, local retrieval) for question answering over a student's own material.
3. Design a guide-first mode (hints and next steps) and a direct-answer mode, and compare them.
4. Add a task, deadline, and reminder tracker with automated weekly progress reviews.
5. Create a small Bangla student-document benchmark (about 100 questions over real course material) to evaluate retrieval and answer quality.
6. Run a user study with 10-15 students over 2-3 weeks, measuring task completion, missed deadlines, and satisfaction.
7. Release the core as an open-source tool.
8. Add a study-resource recommender (topic-based video search) and an opt-in agent mode with confirmation for simple automations.
```

---

### 7. Motivation
```text
Most AI tools students use today give final answers, which weakens learning and builds dependence. They also support Bangla poorly, need internet, and send private academic documents to remote servers. Many students in Bangladesh struggle with deadlines and self-discipline and have no affordable tool that supports them in their own language. BhaiOS addresses this by being private, offline-capable, Bangla-aware, and designed to make the student do the work with guidance. The project also contributes evidence on guided versus direct-answer assistance and a reusable Bangla document benchmark.
```

---

### 8. Google Site URL
```text
https://armanhossen.is-a.dev
```

---

### 9. Code Repository
```text
https://github.com/armanhossen-dev/bhaios
```

---

### 10. Live Demo / Demo Video
*(Leave blank for now)*

---

## Portfolio Prompt (Key Features Grid)

Use these points for your portfolio website showcase grid:

- **Study resource finder:** Suggests relevant videos and materials per topic (e.g., YouTube video recommendation)
- **Opt-in agent mode:** Confirmation-based execution for safe and simple automations on the student's behalf
- **Roadmap & extensions:** Voice-controlled tools and local AI IDE integration

---

## Submission Checklist

- [x] Git repository created: [`https://github.com/armanhossen-dev/bhaios`](https://github.com/armanhossen-dev/bhaios)
- [x] Initial `README.md` updated with planned features and pushed
- [ ] Title verified before submitting (allowed edits: **3**)
- [ ] PMS form inputs submitted
- [ ] Title Defense Report prepared
- [ ] Title Approval document prepared
