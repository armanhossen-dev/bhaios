# Final PMS Submission — BhaiOS

> **Project Name:** BhaiOS  
> **Prepared for:** Final Year Project (FYP) Submission — Daffodil International University (DIU)  
> **Status:** Submitted in PMS

---

## PMS Form Fields (Exact Submission Record)

### 1. Project Title
```text
BhaiOS: A Local Vision-Language Study Assistant with Guide-First Assistance for Bangla-Speaking Students
```

---

### 2. Type
```text
Software, Research
```

---

### 3. Research Fields
```text
Generative AI & LLMs, Computer vision, NLP & Bangla NLP, Human-computer interaction, Educational technology
```

---

### 4. Technologies Used
```text
Python, LLM, Ollama, llama.cpp, Vision-Language Models, Whisper, Tesseract OCR, OpenCV, ChromaDB, SQLite, FastAPI, PyQt, YouTube Data API, Hugging Face Transformers
```

**Individual Items List:**
- `Python`
- `LLM`
- `Ollama`
- `llama.cpp`
- `Vision-Language Models`
- `Whisper`
- `Tesseract OCR`
- `OpenCV`
- `ChromaDB`
- `SQLite`
- `FastAPI`
- `PyQt`
- `YouTube Data API`
- `Hugging Face Transformers`

---

### 5. Description
```text
BhaiOS is a local-first study assistant for Bangla-speaking students that combines a large language model with a vision-language model. It can see and understand the student's study material, including scanned pages, handwritten notes, slides, diagrams, and screenshots, in Bangla and English. Instead of giving final answers, it works in guide-first mode: it gives hints, asks guiding questions, reminds students of deadlines, and reviews weekly progress so the student completes the work themselves. It also recommends study resources such as relevant YouTube videos, and in an optional opt-in agent mode with user confirmation it can run simple automations. Voice control and local AI IDE integration are planned as future extensions. All core features run offline on a laptop, so private documents never leave the device.

Research questions: (1) How well do local vision-language models understand Bangla and English study material compared with an OCR + LLM pipeline? (2) Does a guide-first local assistant improve task completion and learning engagement for Bangla-speaking students compared with a direct-answer assistant?

The system is built as a working tool and evaluated through a small Bangla study-material benchmark and a short user study.
```

---

### 6. Objective
```text
1. Build a local-first study assistant that runs offline on a standard laptop.
2. Integrate a local vision-language model to understand scanned pages, handwritten notes, slides, diagrams, and screenshots.
3. Compare a vision-language approach against an OCR + LLM pipeline on Bangla and English study material.
4. Implement local retrieval for question answering over the student's own documents.
5. Design a guide-first mode (hints and next steps) and a direct-answer mode, and compare them.
6. Add a task, deadline, and reminder tracker with weekly progress reviews.
7. Add a study-resource recommender and an opt-in agent mode with confirmation for simple automations.
8. Create a small Bangla study-material benchmark (about 100 questions over real course pages, including handwriting and diagrams).
9. Run a user study with 10-15 students over 2-3 weeks, measuring task completion, missed deadlines, and satisfaction.
10. Release the core as an open-source tool.
```

---

### 7. Motivation
```text
Most AI tools students use today give final answers, which weakens learning and builds dependence. They also support Bangla poorly, struggle with handwritten and scanned Bangla material, need internet, and send private academic documents to remote servers. Many students in Bangladesh struggle with deadlines and self-discipline and have no affordable tool that supports them in their own language. BhaiOS addresses this by being private, offline-capable, able to see Bangla study material, and designed to keep the student doing the work with guidance. The project also contributes a comparison of local vision-language models on Bangla study material and a reusable benchmark.
```

---

### 8. Google Site URL
```text
https://www.armanhossen.is-a.dev/bhaios
```

---

### 9. Code Repository
```text
https://github.com/armanhossen-dev/bhaios
```

---

### 10. Live Demo
```text
Not provided
```

---

### 11. Demo Video
```text
Not provided
```

---

## Portfolio Prompt (Key Features Grid)

Use these points for your portfolio website showcase grid:

- **Vision-Language Understanding:** Comprehends Bangla & English handwritten notes, diagrams, and scanned pages on-device
- **Guide-First Assistance:** Encourages active learning through hints, questions, and progressive step guidance instead of direct answers
- **Study Resource Finder:** Suggests relevant videos per topic (e.g., YouTube search)
- **Opt-In Agent Mode:** Safe, confirmation-based local automations on the student's behalf
- **Privacy & Local-First:** Runs 100% offline on standard laptops without transmitting academic documents
- **Roadmap & Extensions:** Voice-controlled tool execution and local AI IDE integration

---

## Defense Prep & Project Checklist

### Crucial Notes for Supervisor & Panel
1. **Week 1 Technical Risk:** Immediately test Bangla handwriting and scanned documents on candidate local vision models (Qwen2-VL, MiniCPM-V, etc.).
2. **Core Defense Differentiation Question:**
   - *Question:* "How is this different from ChatGPT, Claude, or Google NotebookLM?"
   - *Answer:* **"BhaiOS is local-first (100% offline & private), natively sees Bangla handwritten notes and diagrams without third-party cloud APIs, and uses a guide-first Socratic policy to scaffold learning rather than generating ready-made answers."**

---

## Next Steps / Pending Documents
- [ ] **Title Approval Document**
- [ ] **Title Defense Report**
