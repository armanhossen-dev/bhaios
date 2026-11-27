import React, { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../lib/api";
import type { Citation, Flashcard, QuizSession } from "../../types";
import { MarkdownMath } from "../MarkdownMath";
import { Badge, EmptyState, LoadingState, PageHeader, Panel } from "../ui/Primitives";

export const StudyStudioView: React.FC<{ courseIdOverride?: string | null }> = ({
  courseIdOverride,
}) => {
  const { activeCourseId, activeCourse, activeModel, language, openCitation, pushNotification } = useApp();
  const scopedCourseId = courseIdOverride !== undefined ? courseIdOverride : activeCourseId;

  const [tab, setTab] = useState<"flashcards" | "quizzes" | "summary">("flashcards");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [quizzes, setQuizzes] = useState<QuizSession[]>([]);
  const [loading, setLoading] = useState(true);

  const [topicInput, setTopicInput] = useState("Deadlocks & Synchronization");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [questionType, setQuestionType] = useState<"mcq" | "short" | "descriptive">("mcq");
  const [generating, setGenerating] = useState(false);
  const [chapterSummary, setChapterSummary] = useState<{
    summary: string;
    model_used: string;
    citations: Citation[];
  } | null>(null);

  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<QuizSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<{ score: number; correct: number; total: number } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [fc, qz] = await Promise.all([
        api.flashcards(scopedCourseId),
        api.quizzes(scopedCourseId),
      ]);
      setFlashcards(fc);
      setQuizzes(qz);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedCourseId]);

  const handleGenerateFlashcards = async () => {
    if (!topicInput.trim()) return;
    setGenerating(true);
    try {
      const model = activeModel.startsWith("gemini:") ? "qwen2.5:3b" : activeModel;
      await api.generateFlashcards({
        course_id: scopedCourseId,
        topic: topicInput.trim(),
        count: 4,
        model,
      });
      await load();
      setCardIdx(0);
      setFlipped(false);
      pushNotification("Generated grounded flashcards.");
    } finally {
      setGenerating(false);
    }
  };

  const handleReviewCard = async (quality: number) => {
    const card = flashcards[cardIdx];
    if (!card) return;
    await api.reviewFlashcard(card.id, quality);
    setFlipped(false);
    setCardIdx((i) => (i + 1 < flashcards.length ? i + 1 : 0));
    await load();
  };

  const handleGenerateQuiz = async () => {
    if (!topicInput.trim()) return;
    setGenerating(true);
    setQuizResult(null);
    setAnswers({});
    try {
      const model = activeModel.startsWith("gemini:") ? "qwen2.5:3b" : activeModel;
      const qz = await api.generateQuiz({
        course_id: scopedCourseId,
        topic: topicInput.trim(),
        difficulty,
        question_type: questionType,
        count: 4,
        model,
      });
      setActiveQuiz(qz);
      await load();
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!topicInput.trim()) return;
    setGenerating(true);
    try {
      const model = activeModel.startsWith("gemini:") ? "qwen2.5:3b" : activeModel;
      const res = await api.chapterSummary({
        course_id: scopedCourseId,
        topic: topicInput.trim(),
        model,
        ui_language: language,
      });
      setChapterSummary(res);
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!activeQuiz) return;
    const res = await api.submitQuiz(activeQuiz.id, answers);
    setQuizResult({ score: res.score, correct: res.correct, total: res.total });
    setActiveQuiz({ ...activeQuiz, questions: res.questions });
    await load();
  };

  const currentCard = flashcards[cardIdx];

  return (
    <div className="flex-1 overflow-y-auto p-5 md:p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <PageHeader
          icon="bx-brain"
          title="Study Studio"
          subtitle="Spaced-repetition flashcards (SM-2) and grounded practice quizzes from your course materials."
          badge={activeCourse ? <Badge tone="blue">{activeCourse.code}</Badge> : undefined}
          actions={
            <div className="flex bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTab("flashcards")}
                className={`px-3 py-1 rounded-md cursor-pointer ${
                  tab === "flashcards" ? "bg-[var(--accent-blue)] text-white" : "text-[var(--text-muted)]"
                }`}
              >
                Flashcards ({flashcards.length})
              </button>
              <button
                type="button"
                onClick={() => setTab("quizzes")}
                className={`px-3 py-1 rounded-md cursor-pointer ${
                  tab === "quizzes" ? "bg-[var(--accent-blue)] text-white" : "text-[var(--text-muted)]"
                }`}
              >
                Quizzes ({quizzes.length})
              </button>
              <button
                type="button"
                onClick={() => setTab("summary")}
                className={`px-3 py-1 rounded-md cursor-pointer ${
                  tab === "summary" ? "bg-[var(--accent-blue)] text-white" : "text-[var(--text-muted)]"
                }`}
              >
                Chapter Summary
              </button>
            </div>
          }
        />

        {/* Generator Bar */}
        <Panel>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="Topic or chapter name from your course…"
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs outline-none focus:border-[var(--accent-blue)]"
            />
            {tab === "quizzes" && (
              <>
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value as any)}
                  className="px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
                >
                  <option value="mcq">MCQ</option>
                  <option value="short">Short Answer</option>
                  <option value="descriptive">Descriptive</option>
                </select>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  className="px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </>
            )}
            <button
              type="button"
              disabled={generating}
              onClick={
                tab === "flashcards"
                  ? handleGenerateFlashcards
                  : tab === "quizzes"
                  ? handleGenerateQuiz
                  : handleGenerateSummary
              }
              className="px-4 py-2 rounded-lg bg-[var(--accent-blue)] text-white text-xs font-semibold cursor-pointer disabled:opacity-50 shrink-0"
            >
              {generating
                ? "Generating…"
                : tab === "flashcards"
                ? "Generate Flashcards"
                : tab === "quizzes"
                ? "Generate Quiz"
                : "Summarize Chapter"}
            </button>
          </div>
        </Panel>

        {loading ? (
          <LoadingState />
        ) : tab === "flashcards" ? (
          flashcards.length === 0 ? (
            <EmptyState
              icon="bx-layer"
              title="No flashcards yet"
              description="Enter a chapter or topic above to generate grounded SM-2 flashcards from your course notes."
            />
          ) : (
            <Panel
              title={`Card ${cardIdx + 1} of ${flashcards.length}`}
              actions={
                <Badge tone="emerald">
                  Interval: {currentCard?.interval_days || 0}d · Reps: {currentCard?.repetitions || 0}
                </Badge>
              }
            >
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setFlipped(!flipped)}
                  className="w-full min-h-[180px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-6 text-center flex flex-col items-center justify-center gap-2 hover:border-[var(--accent-blue)] transition cursor-pointer"
                >
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                    {flipped ? "Answer (click to flip)" : "Prompt (click to reveal)"}
                  </span>
                  <div className="text-base font-medium max-w-xl">
                    {flipped ? currentCard?.back : currentCard?.front}
                  </div>
                </button>

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    {[
                      { q: 1, label: "Again", cls: "text-red-400 border-red-500/30" },
                      { q: 3, label: "Hard", cls: "text-amber-400 border-amber-500/30" },
                      { q: 4, label: "Good", cls: "text-blue-400 border-blue-500/30" },
                      { q: 5, label: "Easy", cls: "text-emerald-400 border-emerald-500/30" },
                    ].map((btn) => (
                      <button
                        key={btn.q}
                        type="button"
                        onClick={() => handleReviewCard(btn.q)}
                        className={`px-3 py-1.5 rounded-lg border bg-[var(--bg-elevated)] text-xs font-semibold cursor-pointer ${btn.cls}`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!currentCard) return;
                      await api.deleteFlashcard(currentCard.id);
                      await load();
                    }}
                    className="text-xs text-[var(--text-muted)] hover:text-red-400 cursor-pointer"
                  >
                    Delete card
                  </button>
                </div>
              </div>
            </Panel>
          )
        ) : tab === "summary" ? (
          !chapterSummary ? (
            <EmptyState
              icon="bx-book-open"
              title="No chapter summary yet"
              description="Enter a chapter or topic above and click Summarize Chapter to extract structured exam revision notes with citations."
            />
          ) : (
            <Panel
              title={`Revision Summary · ${topicInput}`}
              actions={<Badge tone="blue">{chapterSummary.model_used}</Badge>}
            >
              <div className="space-y-3">
                {chapterSummary.citations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {chapterSummary.citations.map((cit, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => openCitation(cit.doc_id, cit.page_num)}
                        className="px-2 py-0.5 rounded bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] text-[11px] font-mono cursor-pointer"
                      >
                        {cit.filename} · p.{cit.page_num}
                      </button>
                    ))}
                  </div>
                )}
                <MarkdownMath content={chapterSummary.summary} className="text-xs" />
              </div>
            </Panel>
          )
        ) : !activeQuiz ? (
          <EmptyState
            icon="bx-task"
            title="Ready for a grounded practice quiz"
            description="Select Easy, Medium, or Hard and generate questions directly from your course materials."
          />
        ) : (
          <Panel
            title={`Practice Quiz (${activeQuiz.difficulty.toUpperCase()})`}
            actions={
              quizResult && (
                <Badge tone={quizResult.score >= 70 ? "emerald" : "amber"}>
                  Score: {quizResult.score}% ({quizResult.correct}/{quizResult.total})
                </Badge>
              )
            }
          >
            <div className="space-y-4">
              {(activeQuiz.questions || []).map((q, idx) => (
                <div
                  key={q.id}
                  className="p-4 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] space-y-2.5"
                >
                  <div className="text-sm font-medium">
                    {idx + 1}. {q.prompt}
                  </div>
                  {q.options && q.options.length > 0 ? (
                    <div className="grid sm:grid-cols-2 gap-2">
                      {q.options.map((opt) => {
                        const selected = answers[q.id] === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setAnswers((p) => ({ ...p, [q.id]: opt }))}
                            className={`p-2.5 rounded-lg border text-left text-xs transition cursor-pointer ${
                              selected
                                ? "border-[var(--accent-blue)] bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] font-semibold"
                                : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)]"
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <textarea
                      rows={3}
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                      placeholder="Write your concise answer here…"
                      className="w-full p-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs outline-none focus:border-[var(--accent-blue)]"
                    />
                  )}
                  {quizResult && (
                    <div className="text-xs pt-1 text-[var(--text-secondary)]">
                      <span className={q.is_correct ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                        {q.is_correct ? "Correct" : `Answer: ${q.correct_answer}`}
                      </span>
                      {" · "}
                      {q.explanation}
                      {q.source_citation && (
                        <span className="ml-2 font-mono text-[10px] text-[var(--text-muted)]">
                          [{q.source_citation}]
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {!quizResult && (
                <button
                  type="button"
                  onClick={handleSubmitQuiz}
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 text-xs font-semibold cursor-pointer"
                >
                  Submit & Grade Quiz
                </button>
              )}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
};
