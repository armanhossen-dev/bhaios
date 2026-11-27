import React, { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../lib/api";
import type { IntelligenceMode, ModelDashboardData } from "../../types";
import { Badge, LoadingState, PageHeader, Panel } from "../ui/Primitives";

export const ModelsView: React.FC = () => {
  const { intelligenceMode, setIntelligenceMode, refreshModels, pushNotification } = useApp();
  const [data, setData] = useState<ModelDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState<string | null>(null);
  const [pullStatus, setPullStatus] = useState("");
  const [testing, setTesting] = useState<string | null>(null);
  const [customPath, setCustomPath] = useState("");
  const [ollamaPath, setOllamaPath] = useState("");
  const [numCtx, setNumCtx] = useState(4096);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [blockedLog, setBlockedLog] = useState<Array<{ host: string; port?: number; timestamp: number }>>([]);
  const [auditLog, setAuditLog] = useState<Array<{ id: string; action: string; status: string; result_preview: string }>>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [d, audit, ag] = await Promise.all([
        api.modelsDashboard(),
        api.offlineAudit(),
        api.agentAuditLog().catch(() => []),
      ]);
      setData(d);
      setCustomPath(d.storage.models_root);
      setOllamaPath(d.storage.ollama_models_path);
      setNumCtx(d.context_window);
      setMaxTokens(d.max_tokens);
      setBlockedLog(audit.blocked_outbound_attempts);
      setAuditLog(ag);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handlePull = async (id: string) => {
    setPulling(id);
    setPullStatus(`Checking disk & RAM for ${id}…`);
    try {
      const resp = await fetch("/api/models/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: id }),
      });
      if (!resp.body) throw new Error("No stream");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.status) setPullStatus(`${id}: ${evt.status}`);
            if (evt.error) {
              pushNotification(evt.error);
              setPullStatus(`Error: ${evt.error}`);
            }
          } catch {
            /* ignore partial chunk */
          }
        }
      }
      await Promise.all([load(), refreshModels()]);
    } catch (err) {
      pushNotification(`Download failed: ${(err as Error).message}`);
    } finally {
      setPulling(null);
    }
  };

  const handleUnload = async (id: string) => {
    await api.unloadModel(id);
    pushNotification(`Unloaded ${id} from unified memory.`);
    await load();
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const res = await api.testModel(id);
      if (res.ok) {
        pushNotification(`${id} responded in ${res.latency_ms} ms: "${res.reply}"`);
      } else {
        pushNotification(`${id} test error: ${res.error}`);
      }
      await load();
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (id: string) => {
    await api.deleteModel(id);
    pushNotification(`Deleted ${id} from local storage.`);
    await Promise.all([load(), refreshModels()]);
  };

  const saveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = await api.updateModelConfig({
      intelligence_mode: intelligenceMode,
      context_window: numCtx,
      max_tokens: maxTokens,
      custom_models_path: customPath,
      ollama_models_path: ollamaPath,
    });
    setData(updated);
    pushNotification("Saved local model & 16GB memory configuration.");
  };

  if (loading && !data) return <LoadingState label="Inspecting local models & unified memory…" />;

  return (
    <div className="flex-1 overflow-y-auto p-5 md:p-7">
      <div className="max-w-6xl mx-auto space-y-5">
        <PageHeader
          icon="bx-chip"
          title="AI Models & Installation Manager"
          subtitle="100% offline multi-model ecosystem tuned for Apple Silicon 16 GB Unified Memory."
          badge={
            <Badge tone="emerald">
              <i className="bx bx-shield-quarter text-xs" />
              LOCAL MODE — ALL PROCESSING ON THIS DEVICE
            </Badge>
          }
          actions={
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold hover:border-[var(--accent-blue)] cursor-pointer"
            >
              <i className="bx bx-refresh text-sm" /> Refresh Status
            </button>
          }
        />

        {/* Telemetry & AI Intelligence Mode */}
        {data && (
          <div className="grid md:grid-cols-4 gap-3">
            <Panel>
              <div className="text-[11px] text-[var(--text-muted)]">Unified Memory</div>
              <div className="text-lg font-mono font-bold mt-0.5">
                {data.ram_used_gb} / {data.ram_total_gb} GB
              </div>
              <div className="text-[10px] text-emerald-400 mt-0.5">Single-LLM guard active</div>
            </Panel>
            <Panel>
              <div className="text-[11px] text-[var(--text-muted)]">Disk Free</div>
              <div className="text-lg font-mono font-bold mt-0.5">{data.storage.free_gb} GB</div>
              <div className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{data.storage.models_root}</div>
            </Panel>
            <Panel>
              <div className="text-[11px] text-[var(--text-muted)]">Ollama Runtime</div>
              <div className={`text-lg font-bold mt-0.5 ${data.ollama_online ? "text-emerald-400" : "text-amber-400"}`}>
                {data.ollama_online ? "Online (127.0.0.1)" : "Offline"}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                {data.ollama_installed ? "CLI detected" : "Install Ollama"}
              </div>
            </Panel>
            <Panel>
              <div className="text-[11px] text-[var(--text-muted)] mb-1">AI Intelligence Mode</div>
              <select
                value={intelligenceMode}
                onChange={(e) => setIntelligenceMode(e.target.value as IntelligenceMode)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold"
              >
                <option value="auto">Auto (Smart Router)</option>
                <option value="qwen">Qwen 3.5 (4B)</option>
                <option value="nemotron">Nemotron-3-Nano (4B)</option>
                <option value="lightweight">Lightweight Mode</option>
              </select>
            </Panel>
          </div>
        )}

        {pulling && (
          <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs font-mono text-amber-300">
            {pullStatus}
          </div>
        )}

        {/* Model Registry Cards */}
        <div className="grid md:grid-cols-2 gap-3.5">
          {(data?.models || []).map((m) => (
            <div
              key={m.id}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm flex items-center gap-2">
                      {m.display_name}
                      <Badge
                        tone={
                          m.status === "Running"
                            ? "emerald"
                            : m.status === "Ready"
                            ? "blue"
                            : m.status === "Downloading"
                            ? "amber"
                            : m.status === "Error"
                            ? "red"
                            : "neutral"
                        }
                      >
                        {m.status}
                      </Badge>
                    </div>
                    <div className="text-[11px] font-mono text-[var(--text-muted)]">
                      {m.id} · {m.category} · {m.size_gb} GB · min {m.min_ram_gb} GB RAM
                    </div>
                  </div>
                  {m.running && m.memory_gb > 0 && (
                    <span className="text-[11px] font-mono text-emerald-400 shrink-0">{m.memory_gb} GB VRAM</span>
                  )}
                </div>

                <p className="text-xs text-[var(--text-secondary)]">{m.recommended_for}</p>
                <div className="text-[10px] font-mono text-[var(--text-muted)] truncate">
                  Path: {m.storage_path} · License: {m.license_note}
                </div>
                {m.warnings.length > 0 && (
                  <div className="text-[11px] text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md">
                    {m.warnings.join(" ")}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-1">
                {m.kind === "ollama_llm" && !m.installed && (
                  <button
                    type="button"
                    disabled={pulling !== null || !m.compatible}
                    onClick={() => handlePull(m.id)}
                    className="px-3 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white text-xs font-semibold cursor-pointer disabled:opacity-40"
                  >
                    {pulling === m.id ? "Downloading…" : "Download"}
                  </button>
                )}
                {m.kind === "ollama_llm" && m.installed && (
                  <>
                    <button
                      type="button"
                      disabled={testing === m.id}
                      onClick={() => handleTest(m.id)}
                      className="px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold hover:border-[var(--accent-blue)] cursor-pointer"
                    >
                      {testing === m.id ? "Testing…" : "Test"}
                    </button>
                    {m.running && (
                      <button
                        type="button"
                        onClick={() => handleUnload(m.id)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 text-xs font-semibold cursor-pointer"
                      >
                        Unload RAM
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id)}
                      className="px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] text-red-400 text-xs font-semibold cursor-pointer"
                    >
                      Delete
                    </button>
                  </>
                )}
                {m.kind !== "ollama_llm" && (
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {m.installed ? "Cached locally" : "Install via Settings / CLI wizard"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Memory, Context & External SSD Configuration + Offline Audit */}
        <div className="grid lg:grid-cols-2 gap-4">
          <Panel title="Memory, Context & External SSD Paths">
            <form onSubmit={saveConfig} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[var(--text-muted)]">Context Window (num_ctx)</span>
                  <input
                    type="number"
                    value={numCtx}
                    onChange={(e) => setNumCtx(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] font-mono"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[var(--text-muted)]">Max Output Tokens</span>
                  <input
                    type="number"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] font-mono"
                  />
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-[var(--text-muted)]">Local Models Directory (External SSD supported)</span>
                <input
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] font-mono"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[var(--text-muted)]">Ollama Models Path (OLLAMA_MODELS)</span>
                <input
                  value={ollamaPath}
                  onChange={(e) => setOllamaPath(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] font-mono"
                />
              </label>
              {data && data.storage.external_volumes.length > 0 && (
                <div className="text-[11px] text-emerald-400">
                  Detected external SSD volumes: {data.storage.external_volumes.join(", ")}
                </div>
              )}
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white font-semibold cursor-pointer"
              >
                Save Configuration
              </button>
            </form>
          </Panel>

          <Panel title="Offline Verification & Agent Audit Log">
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)]">
                <span>Strict Offline Socket Guard</span>
                <Badge tone={data?.offline_mode ? "emerald" : "amber"}>
                  {data?.offline_mode ? "ACTIVE (Blocks Outbound)" : "Install Mode"}
                </Badge>
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                Blocked outbound attempts: <span className="font-mono">{blockedLog.length}</span> · Recent agent tool logs:{" "}
                <span className="font-mono">{auditLog.length}</span>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {auditLog.slice(0, 6).map((a) => (
                  <div key={a.id} className="p-2 rounded bg-[var(--bg-base)] font-mono text-[11px] flex justify-between">
                    <span>{a.action}</span>
                    <span className="text-[var(--text-muted)]">{a.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};
