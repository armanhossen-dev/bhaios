import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../lib/api";
import type { ChatMessage, Citation, HintLadderData } from "../../types";
import { Composer } from "../Composer";
import { HintLadder } from "../HintLadder";
import { MarkdownMath } from "../MarkdownMath";
import { Badge } from "../ui/Primitives";

function extractHintsClient(text: string): HintLadderData | null {
  if (!/\[\/?(NUDGE|HINT|SCAFFOLD)\]/i.test(text)) return null;
  const grab = (tag: string) => {
    const exact = text.match(new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, "i"));
    const loose = exact || text.match(new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\[\\/?(NUDGE|HINT|SCAFFOLD)\\]|$)`, "i"));
    return loose ? loose[1].replace(/\[\/?(NUDGE|HINT|SCAFFOLD)\]/gi, "").trim() : "";
  };
  const nudge = grab("NUDGE");
  const hint = grab("HINT");
  const scaffold = grab("SCAFFOLD");
  if (!nudge && !hint && !scaffold) return null;
  return { nudge, hint, scaffold };
}

function cleanDisplayContent(text: string): string {
  return text.replace(/\[\/?(NUDGE|HINT|SCAFFOLD)\]/gi, "").replace(/\n{3,}/g, "\n\n").trim();
}

export const ChatView: React.FC<{ courseIdOverride?: string | null }> = ({
  courseIdOverride,
}) => {
  const {
    t,
    language,
    activeChatId,
    setActiveChatId,
    activeModel,
    visionModel,
    studyMode,
    agentMode,
    answerPolicy,
    setAnswerPolicy,
    activeCourseId,
    activeCourse,
    activeDoc,
    openCitation,
    refreshChats,
    addSessionTokens,
    pushNotification,
  } = useApp();

  const scopedCourseId = courseIdOverride !== undefined ? courseIdOverride : activeCourseId;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [streamingCitations, setStreamingCitations] = useState<Citation[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [factChecks, setFactChecks] = useState<Record<string, string>>({});
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.suggestions(language).then((res) => setSuggestions(res.suggestions)).catch(() => {});
  }, [language]);

  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    api
      .getChat(activeChatId)
      .then((chat) => setMessages(chat.messages || []))
      .catch(() => setMessages([]));
  }, [activeChatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const sendMessage = async (text: string, imageBase64?: string | null) => {
    const tempUserMsg: ChatMessage = {
      id: `tmp-${Date.now()}`,
      chat_id: activeChatId || "",
      role: "user",
      content: text,
      tokens: 0,
      created_at: Date.now() / 1000,
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsStreaming(true);
    setStreamingText("");
    setStreamingCitations([]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          chat_id: activeChatId,
          message: text,
          mode: studyMode,
          model: activeModel,
          vision_model: visionModel,
          image_base64: imageBase64 || null,
          doc_id: activeDoc?.id || null,
          course_id: scopedCourseId || null,
          agent_mode: agentMode,
          answer_policy: answerPolicy,
          language,
        }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`Server returned ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line);
          if (evt.type === "meta") {
            if (!activeChatId && evt.chat_id) {
              setActiveChatId(evt.chat_id);
            }
            if (evt.citations) setStreamingCitations(evt.citations);
          } else if (evt.type === "token") {
            setStreamingText((prev) => prev + evt.content);
          } else if (evt.type === "error") {
            pushNotification(`Model error: ${evt.error}`);
          } else if (evt.type === "done" && evt.message) {
            setMessages((prev) => [...prev, evt.message]);
            setStreamingText("");
            addSessionTokens(evt.message.tokens || 0);
            refreshChats();
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        pushNotification(`Chat error: ${(err as Error).message}`);
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleRepeatFrom = async (msg: ChatMessage) => {
    if (!activeChatId || isStreaming) return;
    if (!msg.id.startsWith("tmp-")) {
      await api.truncateChat(activeChatId, msg.id).catch(() => {});
    }
    const idx = messages.findIndex((m) => m.id === msg.id);
    if (idx !== -1) {
      setMessages(messages.slice(0, idx));
    }
    await sendMessage(msg.content);
  };

  const handleFactCheck = async (msgIndex: number, msg: ChatMessage) => {
    const prevUser = [...messages.slice(0, msgIndex)].reverse().find((m) => m.role === "user");
    const question = prevUser?.content || "Verify this explanation";
    setCheckingId(msg.id);
    try {
      const res = await api.factCheck(question, msg.content, language);
      setFactChecks((prev) => ({ ...prev, [msg.id]: res.report }));
    } catch (err) {
      pushNotification((err as Error).message);
    } finally {
      setCheckingId(null);
    }
  };

  const isCloudModel = activeModel.startsWith("gemini:");

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      {/* Compact Grounding & Agent Header */}
      <div className="px-4 md:px-6 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/50 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {activeCourse && (
            <Badge tone="blue" className="font-mono">
              {activeCourse.code}
            </Badge>
          )}
          <Badge tone="neutral">{agentMode.replace("_", " ")}</Badge>
          {isCloudModel && (
            <Badge tone="amber">
              <i className="bx bx-cloud text-xs" /> Cloud API ({activeModel.replace("gemini:", "")})
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => setAnswerPolicy(answerPolicy === "source_only" ? "balanced" : "source_only")}
            className={`px-2.5 py-1 rounded-md border font-medium cursor-pointer ${
              answerPolicy === "source_only"
                ? "border-emerald-500/40 bg-emerald-500/12 text-emerald-400"
                : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
            }`}
          >
            {answerPolicy === "source_only" ? "Source-Only" : "Balanced"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        {messages.length === 0 && !isStreaming ? (
          <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-5">
            <div className="w-12 h-12 rounded-xl bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30 flex items-center justify-center text-[var(--accent-blue)]">
              <i className="bx bx-sparkles text-2xl" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{t("emptyChatTitle")}</h1>
              <p className="text-xs text-[var(--text-secondary)] mt-1.5">{t("emptyChatSubtitle")}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-2.5 w-full">
              {suggestions.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => sendMessage(chip)}
                  className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--accent-blue)] text-left text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "user" ? (
                  <div className="group max-w-[82%] rounded-xl rounded-tr-sm bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30 px-4 py-2.5 space-y-1">
                    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition">
                      <button
                        type="button"
                        onClick={() => handleRepeatFrom(msg)}
                        title="Repeat prompt"
                        className="inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--accent-blue)] cursor-pointer"
                      >
                        <i className="bx bx-revision text-xs" /> Repeat
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[92%] rounded-xl rounded-tl-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-4 py-3 space-y-2.5">
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.citations.map((cit, i) => (
                          <button
                            key={`${cit.doc_id}-${i}`}
                            type="button"
                            onClick={() => openCitation(cit.doc_id, cit.page_num)}
                            title={`Open ${cit.filename} at Page/Slide ${cit.page_num}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-blue)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition cursor-pointer"
                          >
                            <i className="bx bx-file text-xs text-[var(--accent-blue)]" />
                            {cit.filename} · Slide/Page {cit.page_num}
                            <i className="bx bx-link-external text-[10px]" />
                          </button>
                        ))}
                      </div>
                    )}

                    {(() => {
                      const resolvedHints = msg.hints || extractHintsClient(msg.content);
                      return resolvedHints ? (
                        <HintLadder hints={resolvedHints} />
                      ) : (
                        <MarkdownMath content={cleanDisplayContent(msg.content)} />
                      );
                    })()}

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => api.speak(msg.content, language).catch(() => {})}
                          title="Read aloud (Hugging Face MMS-TTS)"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-blue)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition cursor-pointer"
                        >
                          <i className="bx bx-volume-full text-xs text-[var(--accent-blue)]" />
                          Listen
                        </button>
                        <button
                          type="button"
                          disabled={checkingId === msg.id}
                          onClick={() => handleFactCheck(messages.indexOf(msg), msg)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-amber-400 text-[11px] font-medium text-[var(--text-secondary)] hover:text-amber-400 transition cursor-pointer disabled:opacity-50"
                        >
                          <i className="bx bx-check-shield text-xs text-amber-400" />
                          {checkingId === msg.id ? "Fact-checking…" : "Fact-check (Gemini)"}
                        </button>
                      </div>
                      {msg.tokens > 0 && (
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">
                          {msg.tokens} tokens · {isCloudModel ? "cloud" : "local"}
                        </div>
                      )}
                    </div>

                    {factChecks[msg.id] && (
                      <div className="mt-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs space-y-1">
                        <div className="font-semibold text-amber-400 flex items-center gap-1">
                          <i className="bx bx-check-shield text-sm" /> Gemini Fact-Check
                        </div>
                        <MarkdownMath content={factChecks[msg.id]} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {isStreaming && (
              <div className="flex justify-start">
                <div className="max-w-[92%] rounded-xl rounded-tl-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-4 py-3 space-y-2">
                  {streamingCitations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {streamingCitations.map((cit, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-elevated)] text-[11px] text-[var(--text-secondary)]"
                        >
                          <i className="bx bx-file text-xs text-[var(--accent-blue)]" />
                          {cit.filename} · Page {cit.page_num}
                        </span>
                      ))}
                    </div>
                  )}
                  <MarkdownMath content={cleanDisplayContent(streamingText) || "Thinking locally…"} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="px-4 md:px-8 pb-4 pt-2">
        <Composer
          onSend={sendMessage}
          isStreaming={isStreaming}
          onStop={() => abortRef.current?.abort()}
        />
      </div>
    </div>
  );
};
