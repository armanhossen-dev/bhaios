import React, { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../lib/api";

export const SettingsView: React.FC = () => {
  const {
    theme,
    setTheme,
    language,
    setLanguage,
    fontSize,
    setFontSize,
    installedModels,
    suggestedModels,
    activeModel,
    setActiveModel,
    visionModel,
    setVisionModel,
    refreshModels,
    health,
    pushNotification,
  } = useApp();

  const [pulling, setPulling] = useState<string | null>(null);
  const [pullStatus, setPullStatus] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [googleKeyInput, setGoogleKeyInput] = useState("");
  const [hasGoogleKey, setHasGoogleKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [voiceModels, setVoiceModels] = useState<
    Array<{
      name: string;
      title: string;
      size: string;
      bangla_quality: string;
      description: string;
      installed: boolean;
      active: boolean;
    }>
  >([]);
  const [downloadingVoice, setDownloadingVoice] = useState<string | null>(null);
  const [ttsModels, setTtsModels] = useState<
    Array<{
      id: string;
      title: string;
      language: string;
      size: string;
      description: string;
      installed: boolean;
    }>
  >([]);
  const [downloadingTts, setDownloadingTts] = useState<string | null>(null);

  const loadTtsModels = () => {
    api
      .ttsModels()
      .then((res) => setTtsModels(res.models))
      .catch(() => {});
  };

  const loadVoiceModels = () => {
    api
      .voiceModels()
      .then((res) => setVoiceModels(res.models))
      .catch(() => {});
  };

  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        setHasGoogleKey(s.has_google_api_key);
        setMaskedKey(s.google_api_key_masked);
      })
      .catch(() => {});
    loadVoiceModels();
    loadTtsModels();
  }, []);

  const handleDownloadTts = async (id: string) => {
    setDownloadingTts(id);
    try {
      const resp = await fetch("/api/tts/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!resp.body) throw new Error("No stream");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n");
        for (const l of lines) {
          if (!l.trim()) continue;
          const evt = JSON.parse(l);
          if (evt.error) pushNotification(`TTS download error: ${evt.error}`);
        }
      }
      loadTtsModels();
      pushNotification(`Voice output model '${id}' downloaded.`);
    } catch (err) {
      pushNotification(`Download failed: ${(err as Error).message}`);
    } finally {
      setDownloadingTts(null);
    }
  };

  const handleDownloadVoice = async (name: string) => {
    setDownloadingVoice(name);
    try {
      const resp = await fetch("/api/voice/models/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!resp.body) throw new Error("No stream");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n");
        for (const l of lines) {
          if (!l.trim()) continue;
          const evt = JSON.parse(l);
          if (evt.error) pushNotification(`Voice download error: ${evt.error}`);
        }
      }
      loadVoiceModels();
      pushNotification(`Bangla voice model '${name}' is ready and active.`);
    } catch (err) {
      pushNotification(`Download failed: ${(err as Error).message}`);
    } finally {
      setDownloadingVoice(null);
    }
  };

  const handleSaveGoogleKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingKey(true);
    try {
      const res = await api.saveSettings(googleKeyInput.trim());
      setHasGoogleKey(res.has_google_api_key);
      setMaskedKey(res.google_api_key_masked);
      setGoogleKeyInput("");
      await refreshModels();
      pushNotification(
        res.has_google_api_key
          ? "Google Gemini API key saved. Gemini models added to selector."
          : "Google API key cleared."
      );
    } finally {
      setSavingKey(false);
    }
  };

  const handlePull = async (name: string) => {
    setPulling(name);
    setPullStatus(`Starting pull for ${name}…`);
    try {
      const resp = await fetch("/api/models/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!resp.body) throw new Error("No stream body");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.status) setPullStatus(`${name}: ${evt.status}`);
            if (evt.error) setPullStatus(`Error: ${evt.error}`);
          } catch {
            /* ignore partial */
          }
        }
      }
      await refreshModels();
      pushNotification(`Model ${name} ready locally.`);
    } catch (err) {
      pushNotification(`Pull failed: ${(err as Error).message}`);
    } finally {
      setPulling(null);
    }
  };

  const handleDelete = async (name: string) => {
    setDeleting(name);
    try {
      await api.deleteModel(name);
      setConfirmDelete(null);
      await refreshModels();
      pushNotification(`Deleted local model ${name}`);
    } catch (err) {
      pushNotification(`Delete failed: ${(err as Error).message}`);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Settings & Local Model Manager</h1>
            <p className="text-xs text-[var(--text-secondary)]">
              Manage local Ollama models, quantization footprints, language, and accessibility.
            </p>
          </div>
          <button
            type="button"
            onClick={() => refreshModels()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold hover:border-[var(--accent-blue)] cursor-pointer"
          >
            <i className="bx bx-refresh text-sm" /> Rescan Ollama
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-2">
            <div className="text-xs font-semibold text-[var(--text-muted)]">Theme</div>
            <div className="flex gap-1.5">
              {(["system", "light", "dark"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTheme(m)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                    theme === m
                      ? "bg-[var(--accent-blue)] text-white"
                      : "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-2">
            <div className="text-xs font-semibold text-[var(--text-muted)]">Interface Language</div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  language === "en"
                    ? "bg-[var(--accent-blue)] text-white"
                    : "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage("bn")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  language === "bn"
                    ? "bg-[var(--accent-blue)] text-white"
                    : "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
                }`}
              >
                বাংলা
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-2">
            <div className="text-xs font-semibold text-[var(--text-muted)]">Font Scale</div>
            <div className="flex gap-1.5">
              {(["small", "medium", "large"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFontSize(s)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                    fontSize === s
                      ? "bg-[var(--accent-blue)] text-white"
                      : "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <i className="bx bx-key text-base text-amber-400" />
                Google Gemini API Key (Optional)
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Add a Google AI Studio key to unlock Gemini 2.5 Flash/Pro & high-accuracy Bangla voice transcription. Leave empty for 100% offline mode.
              </p>
            </div>
            {hasGoogleKey && (
              <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400">
                Connected ({maskedKey})
              </span>
            )}
          </div>

          <form onSubmit={handleSaveGoogleKey} className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={googleKeyInput}
              onChange={(e) => setGoogleKeyInput(e.target.value)}
              placeholder={hasGoogleKey ? "Enter new key to replace…" : "AIzaSy..."}
              className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm font-mono outline-none focus:border-[var(--accent-blue)]"
            />
            <button
              type="submit"
              disabled={savingKey || !googleKeyInput.trim()}
              className="px-4 py-2 rounded-xl bg-[var(--accent-blue)] text-white text-xs font-semibold cursor-pointer disabled:opacity-40"
            >
              {savingKey ? "Saving…" : "Save Key"}
            </button>
            {hasGoogleKey && (
              <button
                type="button"
                onClick={async () => {
                  const res = await api.saveSettings("");
                  setHasGoogleKey(res.has_google_api_key);
                  setMaskedKey("");
                  await refreshModels();
                  pushNotification("Google API key removed.");
                }}
                className="px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-red-400 hover:border-red-400 cursor-pointer"
              >
                Clear
              </button>
            )}
          </form>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <i className="bx bx-chip text-base text-[var(--accent-blue)]" />
              Installed Local Models ({installedModels.length})
            </h2>
            <span className="text-xs inline-flex items-center gap-1 text-emerald-400">
              <i className="bx bx-shield-quarter text-sm" />
              {health?.ollama_online ? "Ollama Connected" : "Ollama Offline"}
            </span>
          </div>

          {installedModels.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">
              No models found. Ensure `ollama serve` is running or pull a suggested model below.
            </p>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {installedModels.map((m) => (
                <div
                  key={m.name}
                  className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-semibold truncate">{m.name}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {m.size} · {m.parameter_size || "quantized"} {m.quantization} ·{" "}
                      {m.is_vision ? "Vision" : "Text"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => (m.is_vision ? setVisionModel(m.name) : setActiveModel(m.name))}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                        activeModel === m.name || visionModel === m.name
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {activeModel === m.name || visionModel === m.name ? "Active" : "Use"}
                    </button>
                    {!m.name.startsWith("gemini:") && (
                      confirmDelete === m.name ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={deleting === m.name}
                            onClick={() => handleDelete(m.name)}
                            className="px-2 py-1 rounded-lg bg-red-500 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                          >
                            {deleting === m.name ? "Deleting…" : "Confirm"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            className="px-2 py-1 rounded-lg bg-[var(--bg-surface)] text-[11px] text-[var(--text-muted)] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(m.name)}
                          title={`Delete ${m.name} from disk`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-red-400 hover:text-red-400 text-[11px] font-semibold text-[var(--text-muted)] cursor-pointer"
                        >
                          <i className="bx bx-trash text-xs" /> Delete
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bangla Voice Input Models (Local Whisper) */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <i className="bx bx-microphone text-base text-[var(--accent-blue)]" />
              Bangla Voice Input Models (Local Whisper)
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Download larger offline Whisper models for much better Bangla & Banglish voice recognition.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            {voiceModels.map((vm) => (
              <div
                key={vm.name}
                className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">{vm.title}</span>
                    <span className="text-[11px] font-mono text-[var(--text-muted)] shrink-0">
                      {vm.size}
                    </span>
                  </div>
                  <div className="mt-1">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]">
                      {vm.bangla_quality}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-2">{vm.description}</p>
                </div>

                <div className="flex items-center justify-between gap-2">
                  {vm.installed ? (
                    <>
                      <button
                        type="button"
                        onClick={() => api.selectVoiceModel(vm.name).then(loadVoiceModels)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                          vm.active
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        {vm.active ? "Active" : "Use"}
                      </button>
                      <button
                        type="button"
                        onClick={() => api.deleteVoiceModel(vm.name).then(loadVoiceModels)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] text-xs text-red-400 hover:border-red-400 border border-[var(--border-subtle)] cursor-pointer"
                      >
                        <i className="bx bx-trash text-xs" /> Delete
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={downloadingVoice !== null}
                      onClick={() => handleDownloadVoice(vm.name)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      <i className="bx bx-download text-sm" />
                      {downloadingVoice === vm.name ? "Downloading…" : "Download"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hugging Face Neural Voice Output (TTS) */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <i className="bx bx-volume-full text-base text-emerald-400" />
              Voice Output Models (Hugging Face Neural TTS)
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Download Meta/Hugging Face MMS-TTS models for offline Bangla & English voice output.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {ttsModels.map((tm) => (
              <div
                key={tm.id}
                className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">{tm.title}</span>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">{tm.size}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{tm.description}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">{tm.id}</span>
                  {tm.installed ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                      <i className="bx bx-check text-sm" /> Ready
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={downloadingTts !== null}
                      onClick={() => handleDownloadTts(tm.id)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[var(--accent-blue)] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      <i className="bx bx-download text-sm" />
                      {downloadingTts === tm.id ? "Downloading…" : "Download"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recommended Study Models</h2>
            {pulling && <span className="text-xs font-mono text-[var(--accent-blue)]">{pullStatus}</span>}
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {suggestedModels.map((s) => (
              <div
                key={s.name}
                className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{s.title}</span>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                      {s.size} · {s.ram}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{s.description}</p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {s.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full bg-[var(--bg-surface)] text-[10px] text-[var(--text-muted)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  {s.installed ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                        <i className="bx bx-check text-sm" /> Installed
                      </span>
                      {confirmDelete === s.name ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={deleting === s.name}
                            onClick={() => handleDelete(s.name)}
                            className="px-2 py-1 rounded-lg bg-red-500 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                          >
                            {deleting === s.name ? "Deleting…" : "Confirm"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            className="px-2 py-1 rounded-lg bg-[var(--bg-surface)] text-[11px] text-[var(--text-muted)] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(s.name)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-red-400 hover:text-red-400 text-[11px] font-semibold text-[var(--text-muted)] cursor-pointer"
                        >
                          <i className="bx bx-trash text-xs" /> Delete
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={pulling !== null}
                      onClick={() => handlePull(s.name)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[var(--accent-blue)] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      <i className="bx bx-download text-sm" /> Pull
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Local Privacy & Data Controls */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <i className="bx bx-lock-alt text-base text-emerald-400" />
              Privacy & Local Workspace Data
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Export your entire local academic database as JSON, or reset workspace records cleanly without deleting local models.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                const blob = await api.exportWorkspace();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "bhaios-workspace-export.json";
                a.click();
                URL.revokeObjectURL(url);
                pushNotification("Exported local workspace JSON.");
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-blue)] text-xs font-semibold cursor-pointer"
            >
              <i className="bx bx-export text-sm" /> Export Workspace JSON
            </button>
            <button
              type="button"
              onClick={async () => {
                const typed = window.prompt("Type RESET to clear all courses, chats, tasks & uploaded records (downloaded Ollama/Whisper models remain untouched):");
                if (typed === "RESET") {
                  await api.resetWorkspace("RESET");
                  pushNotification("Workspace data cleared.");
                  window.location.reload();
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold cursor-pointer"
            >
              <i className="bx bx-trash text-sm" /> Reset Workspace Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
