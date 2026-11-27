import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../lib/api";
import type { ChatMessage, Citation, HintLadderData, IntelligenceMode, RoutingMetadata } from "../../types";
import { Composer } from "../Composer";
import { HintLadder } from "../HintLadder";
import { MarkdownMath } from "../MarkdownMath";

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
    intelligenceMode,
    setIntelligenceMode,
    visionModel,
    studyMode,
    agentMode,
    answerPolicy,
    setAnswerPolicy,
    showThinking,
    setShowThinking,
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
  const [streamingThinking, setStreamingThinking] = useState("");
  const [streamingCitations, setStreamingCitations] = useState<Citation[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [routingMeta, setRoutingMeta] = useState<RoutingMetadata | null>(null);
  const [activityExpanded, setActivityExpanded] = useState(false);

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
    setStreamingThinking("");
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
          intelligence_mode: intelligenceMode,
          vision_model: visionModel,
          image_base64: imageBase64 || null,
          doc_id: activeDoc?.id || null,
          course_id: scopedCourseId || null,
          agent_mode: agentMode,
          answer_policy: answerPolicy,
          language,
          show_thinking: showThinking,
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
            if (evt.routing) setRoutingMeta(evt.routing);
          } else if (evt.type === "thinking") {
            setStreamingThinking((prev) => prev + evt.content);
          } else if (evt.type === "token") {
            setStreamingText((prev) => prev + evt.content);
          } else if (evt.type === "error") {
            pushNotification(`Model error: ${evt.error}`);
          } else if (evt.type === "done" && evt.message) {
            setMessages((prev) => [...prev, evt.message]);
            setStreamingText("");
            setStreamingThinking("");
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

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      {/* Clean compact header */}
      <div className="px-4 md:px-6 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {activeCourse && (
            <span className="text-[11px] font-mono font-semibold text-[var(--accent-blue)]">
              {activeCourse.code}
            </span>
          )}
          {/* Model selector pill group */}
          <div className="flex items-center bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg p-0.5 text-[11px]">
            {(
              [
                { id: "auto", label: "Auto" },
                { id: "qwen", label: "Qwen" },
                { id: "nemotron", label: "Nemotron" },
                { id: "lightweight", label: "Lite" },
              ] as Array<{ id: IntelligenceMode; label: string }>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setIntelligenceMode(opt.id)}
                className={`px-2 py-0.5 rounded-md font-medium cursor-pointer transition ${
                  intelligenceMode === opt.id
                    ? "bg-[var(--accent-blue)] text-white shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right side: icon toggles */}
        <div className="flex items-center gap-1 text-[11px]">
          {routingMeta && (
            <button
              type="button"
              onClick={() => setActivityExpanded((v) => !v)}
              title={`${routingMeta.selected_model} — ${activityExpanded ? "Hide" : "Show"} routing details`}
              className={`p-1.5 rounded-md border cursor-pointer transition ${
                activityExpanded
                  ? "border-[var(--accent-blue)]/40 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <i className="bx bx-scatter-chart text-sm" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowThinking(!showThinking)}
            title={showThinking ? "Hide model thinking" : "Show model thinking"}
            className={`p-1.5 rounded-md border cursor-pointer transition ${
              showThinking
                ? "border-purple-500/40 bg-purple-500/10 text-purple-400"
                : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <i className="bx bx-brain text-sm" />
          </button>
          <button
            type="button"
            onClick={() => setAnswerPolicy(answerPolicy === "source_only" ? "balanced" : "source_only")}
            title={answerPolicy === "source_only" ? "Source-Only mode (switch to Balanced)" : "Balanced mode (switch to Source-Only)"}
            className={`p-1.5 rounded-md border cursor-pointer transition ${
              answerPolicy === "source_only"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <i className={`bx ${answerPolicy === "source_only" ? "bx-book-bookmark" : "bx-equalizer"} text-sm`} />
          </button>
        </div>
      </div>

      {/* Expandable activity detail — only when toggled */}
      {activityExpanded && routingMeta && (
        <div className="px-4 md:px-6 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] text-[11px] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap text-[var(--text-secondary)]">
            <span className="font-mono font-semibold text-[var(--text-primary)]">{routingMeta.selected_model}</span>
            {(routingMeta.activity_steps || []).map((st, idx) => (
              <span key={idx} className="inline-flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-emerald-400" />
                {st}
              </span>
            ))}
          </div>
          <span className="font-mono text-[var(--text-muted)] truncate max-w-[200px]">{routingMeta.reason}</span>
        </div>
      )}

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
                    {/* Thinking block (collapsible) */}
                    {showThinking && msg.thinking && msg.thinking.trim() && (
                      <details className="group/think">
                        <summary className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted)] cursor-pointer select-none hover:text-[var(--text-secondary)] transition">
                          <i className="bx bx-brain text-sm text-purple-400" />
                          <span>Thinking</span>
                          <i className="bx bx-chevron-right text-xs transition-transform group-open/think:rotate-90" />
                        </summary>
                        <div className="mt-1.5 pl-3 border-l-2 border-purple-500/20 text-[12px] text-[var(--text-muted)] leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                          {msg.thinking}
                        </div>
                      </details>
                    )}
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
                          title="Read aloud (Offline TTS)"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-blue)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition cursor-pointer"
                        >
                          <i className="bx bx-volume-full text-xs text-[var(--accent-blue)]" />
                          Listen
                        </button>
                      </div>
                      {msg.tokens > 0 && (
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">
                          {msg.tokens} tokens · local
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isStreaming && (
              <div className="flex justify-start">
                <div className="max-w-[92%] rounded-xl rounded-tl-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-4 py-3 space-y-2">
                  {/* Live thinking stream */}
                  {showThinking && streamingThinking && (
                    <details open className="group/think">
                      <summary className="flex items-center gap-1.5 text-[11px] font-medium text-purple-400 cursor-pointer select-none">
                        <i className="bx bx-brain text-sm animate-pulse" />
                        <span>Thinking…</span>
                        <i className="bx bx-chevron-right text-xs transition-transform group-open/think:rotate-90" />
                      </summary>
                      <div className="mt-1.5 pl-3 border-l-2 border-purple-500/30 text-[12px] text-[var(--text-muted)] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {streamingThinking}
                      </div>
                    </details>
                  )}
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
