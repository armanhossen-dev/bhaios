import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../lib/api";
import type { LectureTranscript } from "../../types";

interface FinalSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  language: string;
}

interface EngineInfo {
  model_id: string;
  model_cached: boolean;
  model_loaded: boolean;
  compute_type: string;
  offline_ready: boolean;
}

export const SpeechView: React.FC = () => {
  const { pushNotification, activeCourseId, academicTree, activeModel, language: uiLang } = useApp();

  const [lectures, setLectures] = useState<LectureTranscript[]>([]);
  const [selectedLecture, setSelectedLecture] = useState<LectureTranscript | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  const [engineInfo, setEngineInfo] = useState<EngineInfo | null>(null);
  const [status, setStatus] = useState<"idle" | "recording" | "paused">("idle");
  const [durationSec, setDurationSec] = useState(0);
  const [segments, setSegments] = useState<FinalSegment[]>([]);
  const [partialText, setPartialText] = useState("");
  const [levels, setLevels] = useState<number[]>([0.3, 0.6, 0.4, 0.3]);

  // Configurable transcription settings
  const [language, setLanguage] = useState<"auto" | "bn" | "en">("auto");
  const [outputStyle, setOutputStyle] = useState<"mixed" | "bn_script" | "roman_banglish">("mixed");
  const [chunkSeconds, setChunkSeconds] = useState(6);
  const [vadSensitivity, setVadSensitivity] = useState(0.45);
  const [beamSize, setBeamSize] = useState(5);
  const [punctuation, setPunctuation] = useState(true);
  const [saveLocally, setSaveLocally] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    fetch("/api/engine")
      .then((r) => r.json())
      .then(setEngineInfo)
      .catch(() => {});
    api.lectures(activeCourseId).then(setLectures).catch(() => {});
    return () => {
      cleanupAudio();
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCourseId]);

  const handleUploadLectureAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAudio(true);
    try {
      const model = activeModel.startsWith("gemini:") ? "qwen2.5:3b" : activeModel;
      const res = await api.uploadAnalyzeLecture(file, activeCourseId, file.name, model, uiLang);
      setLectures((prev) => [res, ...prev]);
      setSelectedLecture(res);
      pushNotification(`Transcribed & summarized lecture: ${res.title}`);
    } catch (err) {
      pushNotification(`Lecture upload failed: ${(err as Error).message}`);
    } finally {
      setUploadingAudio(false);
      e.target.value = "";
    }
  };

  useEffect(() => {
    if (status === "recording") {
      timerRef.current = window.setInterval(() => setDurationSec((d) => d + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  // Push live settings updates over active WebSocket
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "config",
          settings: {
            language,
            output_style: outputStyle,
            chunk_seconds: chunkSeconds,
            vad_sensitivity: vadSensitivity,
            beam_size: beamSize,
            punctuation,
            save_locally: saveLocally,
          },
        })
      );
    }
  }, [language, outputStyle, chunkSeconds, vadSensitivity, beamSize, punctuation, saveLocally]);

  const cleanupAudio = () => {
    procRef.current?.disconnect();
    procRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLevels([0.3, 0.6, 0.4, 0.3]);
  };

  const downsampleTo16k = (input: Float32Array, origRate: number): Float32Array => {
    if (origRate === 16000) return input;
    const ratio = origRate / 16000;
    const outLen = Math.floor(input.length / ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      out[i] = input[Math.floor(i * ratio)];
    }
    return out;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${proto}//${window.location.host}/ws/transcribe`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "config",
            settings: {
              language,
              output_style: outputStyle,
              chunk_seconds: chunkSeconds,
              vad_sensitivity: vadSensitivity,
              beam_size: beamSize,
              punctuation,
              save_locally: saveLocally,
            },
          })
        );
      };

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === "partial") {
          setPartialText(msg.text || "");
        } else if (msg.type === "final" && msg.segment) {
          setSegments((prev) => [...prev, msg.segment]);
          setPartialText("");
        } else if (msg.type === "error") {
          pushNotification(`Speech error: ${msg.error}`);
        }
      };

      ws.onerror = () => {
        pushNotification("Speech WebSocket connection failed. Ensure backend server is running.");
      };

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      procRef.current = processor;

      processor.onaudioprocess = (e) => {
        const raw = e.inputBuffer.getChannelData(0);
        // Simple RMS meter for 4 orange bars
        let sum = 0;
        for (let i = 0; i < raw.length; i++) sum += raw[i] * raw[i];
        const rms = Math.min(1, Math.sqrt(sum / raw.length) * 6);
        setLevels([
          Math.max(0.2, rms * 0.8),
          Math.max(0.25, rms * 1.1),
          Math.max(0.2, rms * 0.95),
          Math.max(0.2, rms * 0.7),
        ]);

        if (ws.readyState === WebSocket.OPEN) {
          const pcm16k = downsampleTo16k(raw, ctx.sampleRate);
          ws.send(pcm16k.buffer);
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      setDurationSec(0);
      setStatus("recording");
    } catch {
      pushNotification("Microphone permission denied or unavailable.");
    }
  };

  const togglePause = () => {
    if (!wsRef.current) return;
    if (status === "recording") {
      wsRef.current.send(JSON.stringify({ type: "pause" }));
      setStatus("paused");
    } else if (status === "paused") {
      wsRef.current.send(JSON.stringify({ type: "resume" }));
      setStatus("recording");
    }
  };

  const stopRecording = () => {
    cleanupAudio();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
    }
    setStatus("idle");
  };

  const handleExport = async (fmt: "txt" | "srt") => {
    const resp = await fetch("/api/speech/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segments, format: fmt, save_locally: saveLocally }),
    });
    const text = await resp.text();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bhaios-transcript.${fmt}`;
    a.click();
    URL.revokeObjectURL(url);
    if (saveLocally) pushNotification(`Saved ${fmt.toUpperCase()} transcript locally.`);
  };

  const fullText = [
    ...segments.map((s) => s.text),
    partialText ? `[Draft] ${partialText}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const mm = String(Math.floor(durationSec / 60)).padStart(2, "0");
  const ss = String(durationSec % 60).padStart(2, "0");

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header + Status Badges */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <i className="bx bx-microphone text-xl text-amber-400" />
              BhaiOS Lecture Studio
            </h1>
            <p className="text-xs text-[var(--text-secondary)]">
              Live mic Banglish transcription + uploaded lecture summarization & topic extraction ({academicTree.courses.find((c) => c.id === activeCourseId)?.code || "All Courses"}).
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white text-xs font-semibold cursor-pointer">
              <i className="bx bx-upload text-sm" />
              {uploadingAudio ? "Analyzing Audio…" : "Upload Lecture Audio"}
              <input
                type="file"
                accept=".wav,.mp3,.m4a,.ogg,.webm,.flac"
                className="hidden"
                onChange={handleUploadLectureAudio}
                disabled={uploadingAudio}
              />
            </label>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold">
              <i className="bx bx-shield-quarter text-sm" />
              100% Offline
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-secondary)]">
              <span
                className={`w-2 h-2 rounded-full ${
                  engineInfo?.offline_ready ? "bg-amber-400" : "bg-red-400"
                }`}
              />
              {engineInfo?.model_id || "kayees/whisper-medium-bn-en-cs-faster"} · INT8
            </span>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          {/* Left 2 Columns: Mic Studio + Live Transcript */}
          <div className="lg:col-span-2 space-y-4">
            {/* Large Microphone Control Card */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 flex flex-col items-center justify-center space-y-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={status === "idle" ? startRecording : stopRecording}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    status === "recording"
                      ? "bg-amber-500 text-slate-950 shadow-[0_0_28px_rgba(245,158,11,0.5)] scale-105"
                      : status === "paused"
                      ? "bg-amber-500/30 text-amber-300 border-2 border-amber-400"
                      : "bg-[var(--bg-elevated)] border-2 border-amber-500/50 text-amber-400 hover:bg-amber-500 hover:text-slate-950"
                  }`}
                >
                  {status === "recording" ? (
                    <span className="flex items-center gap-1 h-7">
                      {levels.map((lvl, idx) => (
                        <span
                          key={idx}
                          className="w-1.5 rounded-full bg-slate-950 transition-all duration-75"
                          style={{ height: `${Math.round(lvl * 28)}px` }}
                        />
                      ))}
                    </span>
                  ) : (
                    <i className="bx bx-microphone text-3xl" />
                  )}
                </button>
              </div>

              <div className="text-center space-y-1">
                <div className="text-2xl font-mono font-bold tracking-wider">
                  {mm}:{ss}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {status === "recording"
                    ? "Listening… speak naturally in Bangla + English"
                    : status === "paused"
                    ? "Paused — click Resume or Stop"
                    : "Click microphone to start live offline transcription"}
                </div>
              </div>

              {status !== "idle" && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={togglePause}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold hover:border-amber-400 cursor-pointer"
                  >
                    <i className={`bx ${status === "paused" ? "bx-play" : "bx-pause"} text-base`} />
                    {status === "paused" ? "Resume" : "Pause"}
                  </button>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 text-xs font-semibold cursor-pointer"
                  >
                    <i className="bx bx-stop text-base" /> Stop & Finalize
                  </button>
                </div>
              )}
            </div>

            {/* Live Transcript Display */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Live Transcript
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(fullText);
                      pushNotification("Transcript copied.");
                    }}
                    disabled={!fullText}
                    className="px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs hover:border-amber-400 disabled:opacity-40 cursor-pointer"
                  >
                    <i className="bx bx-copy mr-1" /> Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport("txt")}
                    disabled={segments.length === 0}
                    className="px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs hover:border-amber-400 disabled:opacity-40 cursor-pointer"
                  >
                    Export TXT
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport("srt")}
                    disabled={segments.length === 0}
                    className="px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs hover:border-amber-400 disabled:opacity-40 cursor-pointer"
                  >
                    Export SRT
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSegments([]);
                      setPartialText("");
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-red-400 hover:border-red-400 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="min-h-[220px] max-h-[380px] overflow-y-auto rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] p-4 space-y-2.5">
                {segments.length === 0 && !partialText ? (
                  <p className="text-xs text-[var(--text-muted)] italic">
                    Finalized segments and live partial drafts will appear here…
                  </p>
                ) : (
                  <>
                    {segments.map((seg) => (
                      <div key={seg.id} className="flex items-start gap-2.5 text-sm leading-relaxed">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] shrink-0 mt-1">
                          {seg.start.toFixed(1)}s
                        </span>
                        <span className="text-[var(--text-primary)]">{seg.text}</span>
                      </div>
                    ))}
                    {partialText && (
                      <div className="flex items-start gap-2.5 text-sm leading-relaxed opacity-80">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 shrink-0 mt-1">
                          DRAFT
                        </span>
                        <span className="italic text-amber-200">{partialText}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Transcription Settings */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4 h-fit">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <i className="bx bx-slider-alt text-base text-amber-400" />
              Transcription Settings
            </h2>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-muted)]">Language</label>
              <div className="grid grid-cols-3 gap-1">
                {(["auto", "bn", "en"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLanguage(l)}
                    className={`py-1.5 rounded-lg text-xs font-semibold uppercase cursor-pointer ${
                      language === l
                        ? "bg-amber-500 text-slate-950"
                        : "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {l === "bn" ? "Bengali" : l === "en" ? "English" : "Auto"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-muted)]">Output Style</label>
              <select
                value={outputStyle}
                onChange={(e) => setOutputStyle(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
              >
                <option value="mixed">Mixed Script (Default BN + EN)</option>
                <option value="bn_script">Bengali Script (।)</option>
                <option value="roman_banglish">Roman Banglish</option>
              </select>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-muted)]">Chunk Duration</span>
                <span className="font-mono text-amber-400">{chunkSeconds}s</span>
              </div>
              <input
                type="range"
                min={3}
                max={10}
                step={1}
                value={chunkSeconds}
                onChange={(e) => setChunkSeconds(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-muted)]">VAD Sensitivity</span>
                <span className="font-mono text-amber-400">{vadSensitivity}</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={0.8}
                step={0.05}
                value={vadSensitivity}
                onChange={(e) => setVadSensitivity(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-muted)]">Beam Size</span>
                <span className="font-mono text-amber-400">{beamSize}</span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={beamSize}
                onChange={(e) => setBeamSize(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>

            <label className="flex items-center justify-between text-xs cursor-pointer pt-1">
              <span>Punctuation</span>
              <input
                type="checkbox"
                checked={punctuation}
                onChange={(e) => setPunctuation(e.target.checked)}
                className="accent-amber-500"
              />
            </label>

            <label className="flex items-center justify-between text-xs cursor-pointer">
              <span>Save transcripts locally</span>
              <input
                type="checkbox"
                checked={saveLocally}
                onChange={(e) => setSaveLocally(e.target.checked)}
                className="accent-amber-500"
              />
            </label>
          </div>
        </div>

        {/* Saved Uploaded Lectures + Auto-Notes */}
        {(selectedLecture || lectures.length > 0) && (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Saved Lecture Recordings & Auto-Notes ({lectures.length})</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {lectures.map((lec) => (
                  <div
                    key={lec.id}
                    onClick={() => setSelectedLecture(lec)}
                    className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between ${
                      selectedLecture?.id === lec.id
                        ? "border-amber-400 bg-amber-500/10"
                        : "border-[var(--border-subtle)] bg-[var(--bg-base)]"
                    }`}
                  >
                    <span className="truncate font-medium">{lec.title}</span>
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        api.deleteLecture(lec.id).then(() => {
                          setLectures((prev) => prev.filter((x) => x.id !== lec.id));
                          if (selectedLecture?.id === lec.id) setSelectedLecture(null);
                        });
                      }}
                      className="text-[var(--text-muted)] hover:text-red-400 cursor-pointer"
                    >
                      <i className="bx bx-trash text-sm" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="md:col-span-2 p-3.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] text-xs space-y-2">
                {selectedLecture ? (
                  <>
                    <div className="font-semibold text-sm">{selectedLecture.title}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedLecture.topics.map((tp, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[10px]">
                          {tp}
                        </span>
                      ))}
                    </div>
                    <div className="text-[var(--text-secondary)] leading-relaxed">{selectedLecture.summary}</div>
                    {selectedLecture.segments.length > 0 && (
                      <div className="max-h-36 overflow-y-auto pt-2 border-t border-[var(--border-subtle)] space-y-1 font-mono text-[11px] text-[var(--text-muted)]">
                        {selectedLecture.segments.map((s) => (
                          <div key={s.line}>{s.text}</div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-[var(--text-muted)]">Select a saved lecture recording to view extracted topics & summary.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
