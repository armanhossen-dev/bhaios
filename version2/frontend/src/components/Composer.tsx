import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../lib/api";

interface ComposerProps {
  onSend: (text: string, imageBase64?: string | null) => void;
  isStreaming: boolean;
  onStop: () => void;
}

export const Composer: React.FC<ComposerProps> = ({
  onSend,
  isStreaming,
  onStop,
}) => {
  const {
    t,
    language,
    installedModels,
    activeModel,
    setActiveModel,
    studyMode,
    setStudyMode,
    visionModel,
    activeCourseId,
    refreshDocuments,
    setActiveDoc,
    pushNotification,
    consumePendingChatFocus,
    consumePendingVoiceCapture,
  } = useApp();

  const [text, setText] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageB64, setImageB64] = useState<string | null>(null);
  const [voiceLang, setVoiceLang] = useState<"auto" | "bn" | "en">("auto");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [levels, setLevels] = useState<number[]>([0.35, 0.75, 0.55, 0.35]);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const speechRecRef = useRef<any>(null);
  const baseTextRef = useRef<string>("");
  const liveTranscriptRef = useRef<string>("");

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  const handleInputChange = (val: string) => {
    setText(val);
    adjustHeight();
  };

  useEffect(() => {
    adjustHeight();
  }, [text, liveTranscript]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
      try {
        speechRecRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const submit = () => {
    const combined = (liveTranscript ? `${text} ${liveTranscript}` : text).trim();
    if (!combined && !imageB64) return;
    onSend(combined || "Analyze this attached image.", imageB64);
    setText("");
    setLiveTranscript("");
    setImagePreview(null);
    setImageB64(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming) submit();
    }
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        setImagePreview(res);
        setImageB64(res.split(",")[1] || null);
      };
      reader.readAsDataURL(file);
    }
    try {
      const doc = await api.uploadDocument(
        file,
        file.type.startsWith("image/") ? "vlm" : "ocr",
        visionModel,
        activeCourseId
      );
      setActiveDoc(doc);
      await refreshDocuments();
      pushNotification(`Indexed "${doc.original_name}" (${doc.chunk_count || 1} chunks).`);
    } catch (err) {
      pushNotification(`Upload failed: ${(err as Error).message}`);
    }
    e.target.value = "";
  };

  const stopAudioMeter = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevels([0.35, 0.75, 0.55, 0.35]);
  };

  const toggleVoice = async () => {
    if (recording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      try {
        speechRecRef.current?.stop();
      } catch {
        /* ignore */
      }
      stopAudioMeter();
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      baseTextRef.current = text.trim();
      setLiveTranscript("");

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 32;
        source.connect(analyser);
        audioCtxRef.current = ctx;
        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          analyser.getByteFrequencyData(data);
          const bars = [1, 3, 5, 7].map((idx) => {
            const v = (data[idx] || 0) / 255;
            return Math.max(0.22, Math.min(1, 0.22 + v * 1.15));
          });
          setLevels(bars);
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }

      const SpeechRec =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        const rec = new SpeechRec();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = voiceLang === "bn" || (voiceLang === "auto" && language === "bn") ? "bn-BD" : "en-US";
        rec.onresult = (event: any) => {
          let interim = "";
          let finals = "";
          for (let i = 0; i < event.results.length; i++) {
            const res = event.results[i];
            if (res.isFinal) finals += res[0].transcript + " ";
            else interim += res[0].transcript;
          }
          const combined = (finals + interim).trim();
          liveTranscriptRef.current = combined;
          setLiveTranscript(combined);
        };
        rec.onerror = () => {};
        try {
          rec.start();
          speechRecRef.current = rec;
        } catch {
          /* ignore */
        }
      }

      const mime =
        typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const outMime = recorder.mimeType || mime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: outMime });
        if (blob.size < 256) {
          pushNotification("Voice clip too short — hold/speak for at least 1 second.");
          liveTranscriptRef.current = "";
          setLiveTranscript("");
          return;
        }
        const effectiveLang = voiceLang === "auto" && language === "bn" ? "bn" : voiceLang;
        setTranscribing(true);
        try {
          const res = await api.transcribe(blob, effectiveLang);
          const finalVoice = (res.text || liveTranscriptRef.current).trim();
          if (finalVoice) {
            setText(baseTextRef.current ? `${baseTextRef.current} ${finalVoice}` : finalVoice);
            textareaRef.current?.focus();
          } else {
            pushNotification("No speech detected — try speaking closer to the mic.");
          }
        } catch (err) {
          if (liveTranscriptRef.current) {
            setText(
              baseTextRef.current
                ? `${baseTextRef.current} ${liveTranscriptRef.current}`
                : liveTranscriptRef.current
            );
          } else {
            pushNotification(`Voice transcription failed: ${(err as Error).message}`);
          }
        } finally {
          liveTranscriptRef.current = "";
          setLiveTranscript("");
          setTranscribing(false);
        }
      };
      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setRecording(true);
      textareaRef.current?.focus();
    } catch {
      pushNotification("Microphone permission denied or unavailable.");
    }
  };

  const toggleVoiceRef = useRef(toggleVoice);
  toggleVoiceRef.current = toggleVoice;

  useEffect(() => {
    const onFocusChat = () => {
      textareaRef.current?.focus();
    };
    const onToggleVoice = () => {
      toggleVoiceRef.current();
    };
    window.addEventListener("bhaios:focus-chat", onFocusChat);
    window.addEventListener("bhaios:toggle-voice", onToggleVoice);

    if (consumePendingChatFocus()) {
      setTimeout(() => textareaRef.current?.focus(), 40);
    }
    if (consumePendingVoiceCapture()) {
      setTimeout(() => toggleVoiceRef.current(), 60);
    }

    return () => {
      window.removeEventListener("bhaios:focus-chat", onFocusChat);
      window.removeEventListener("bhaios:toggle-voice", onToggleVoice);
    };
  }, [consumePendingChatFocus, consumePendingVoiceCapture]);

  const displayValue =
    recording && liveTranscript
      ? baseTextRef.current
        ? `${baseTextRef.current} ${liveTranscript}`
        : liveTranscript
      : text;

  return (
    <div className="relative w-full max-w-3xl mx-auto space-y-2">
      {imagePreview && (
        <div className="inline-flex items-center gap-2 p-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <img src={imagePreview} alt="Attachment" className="w-11 h-11 rounded-lg object-cover" />
          <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
            <i className="bx bx-image text-sm text-[var(--accent-blue)]" />
            Vision attached ({visionModel})
          </span>
          <button
            type="button"
            onClick={() => {
              setImagePreview(null);
              setImageB64(null);
            }}
            className="p-1 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] cursor-pointer"
          >
            <i className="bx bx-x text-base" />
          </button>
        </div>
      )}

      <div
        className={`rounded-[22px] border bg-[var(--bg-surface)] px-4 pt-3 pb-2.5 shadow-md transition-all ${
          recording
            ? "border-amber-500/70 ring-2 ring-amber-500/20"
            : "border-[var(--border-subtle)] focus-within:border-[var(--accent-blue)]"
        }`}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={displayValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={recording ? t("listening") : t("askAnything")}
          className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none border-none shadow-none max-h-40"
        />

        <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]/60 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md"
              className="hidden"
              onChange={handleFileAttach}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach scan, PDF, or handwritten note"
              className="w-8 h-8 rounded-full flex items-center justify-center border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--accent-blue)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
            >
              <i className="bx bx-plus text-base" />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setModelMenuOpen(!modelMenuOpen)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-blue)] text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
              >
                <i className="bx bx-chip text-sm text-[var(--accent-blue)]" />
                <span className="max-w-[120px] truncate">{activeModel}</span>
                <i className="bx bx-chevron-down text-sm" />
              </button>
              {modelMenuOpen && (
                <div className="absolute bottom-10 left-0 z-30 w-60 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xl p-1.5 space-y-0.5">
                  {installedModels.length === 0 ? (
                    <div className="px-2.5 py-2 text-xs text-[var(--text-muted)]">
                      No Ollama models detected.
                    </div>
                  ) : (
                    installedModels.map((m) => (
                      <button
                        key={m.name}
                        type="button"
                        onClick={() => {
                          setActiveModel(m.name);
                          setModelMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer ${
                          activeModel === m.name
                            ? "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] font-semibold"
                            : "hover:bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                        }`}
                      >
                        <span className="truncate font-mono">{m.name}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">{m.size}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setStudyMode(studyMode === "guide" ? "answer" : "guide")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                studyMode === "guide"
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                  : "border-blue-500/40 bg-blue-500/15 text-blue-400"
              }`}
            >
              <i className={`bx ${studyMode === "guide" ? "bx-compass" : "bx-bolt"} text-sm`} />
              <span>{studyMode === "guide" ? t("guideMode") : t("answerMode")}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setVoiceLang((l) => (l === "auto" ? "bn" : l === "bn" ? "en" : "auto"))
              }
              title="Whisper voice language (Auto / Bangla / English)"
              className="px-2.5 py-1.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] font-mono uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              {voiceLang}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {transcribing && (
              <span className="text-[11px] font-mono text-amber-400 animate-pulse">
                Transcribing…
              </span>
            )}

            <button
              type="button"
              onClick={toggleVoice}
              title={recording ? "Stop voice recording (⌘⇧V / Ctrl+M)" : "Voice input (⌘⇧V / Ctrl+M)"}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                recording
                  ? "bg-amber-400 text-slate-950 shadow-[0_0_18px_rgba(245,158,11,0.55)] scale-105"
                  : "bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-amber-400 hover:text-amber-400"
              }`}
            >
              {recording ? (
                <span className="flex items-center gap-[2.5px] h-4">
                  {levels.map((lvl, idx) => (
                    <span
                      key={idx}
                      className="w-[3px] rounded-full bg-slate-950 transition-all duration-75"
                      style={{ height: `${Math.round(lvl * 16)}px` }}
                    />
                  ))}
                </span>
              ) : (
                <i className="bx bx-microphone text-lg" />
              )}
            </button>

            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                title="Stop generation"
                className="w-9 h-9 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center cursor-pointer"
              >
                <i className="bx bx-stop text-xl" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!displayValue.trim() && !imageB64}
                className="w-9 h-9 rounded-full bg-[var(--accent-blue)] text-white flex items-center justify-center disabled:opacity-35 hover:opacity-90 transition cursor-pointer"
              >
                <i className="bx bx-up-arrow-alt text-xl" />
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-[11px] text-[var(--text-muted)]">
        {t("aiDisclaimer")}
      </p>
    </div>
  );
};
