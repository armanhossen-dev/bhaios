import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../lib/api";
import type { DocumentAsset, DocumentChunk, IngestionJob, StudyDocument } from "../../types";
import { MarkdownMath } from "../MarkdownMath";
import { Badge, EmptyState, PageHeader, Panel } from "../ui/Primitives";

interface QueueItem {
  id: string;
  file: File;
  status: "queued" | "uploading" | "done" | "duplicate" | "error";
  error?: string;
}

const PAGE_SIZE = 20;

export const DocumentsView: React.FC = () => {
  const {
    documents,
    refreshDocuments,
    activeDoc,
    setActiveDoc,
    targetPage,
    setTargetPage,
    activeCourseId,
    academicTree,
    visionModel,
    pushNotification,
    setView,
  } = useApp();

  const [pipeline, setPipeline] = useState<"ocr" | "vlm">("ocr");
  const [backgroundQueueMode, setBackgroundQueueMode] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [serverJobs, setServerJobs] = useState<IngestionJob[]>([]);
  const [uploading, setUploading] = useState(false);
  const cancelQueueRef = useRef(false);

  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [assets, setAssets] = useState<DocumentAsset[]>([]);
  const [rawContent, setRawContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [pageIdx, setPageIdx] = useState(0);
  const [searchResults, setSearchResults] = useState<
    Array<{ doc_id: string; filename: string; page_num: number; source_location?: string; content: string; score: number }>
  >([]);

  // Visual Studio state + Safe QR Modal
  const [visualTask, setVisualTask] = useState<"qr" | "equation" | "diagram" | "table" | "code_screenshot">("diagram");
  const [visualOutput, setVisualOutput] = useState<{ qr_payloads: string[]; analysis: string } | null>(null);
  const [visualBusy, setVisualBusy] = useState(false);
  const [qrInspectUrl, setQrInspectUrl] = useState<string | null>(null);

  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
      folderInputRef.current.setAttribute("directory", "");
    }
  }, []);

  const refreshJobs = async () => {
    try {
      setServerJobs(await api.ingestionJobs(filterCourse !== "all" ? filterCourse : undefined));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    refreshJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCourse]);

  useEffect(() => {
    const hasPending = serverJobs.some((j) => j.status === "queued" || j.status === "processing");
    if (!hasPending) return;
    const t = setInterval(async () => {
      await refreshJobs();
      await refreshDocuments();
    }, 1200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverJobs]);

  const inspectDoc = async (doc: StudyDocument) => {
    setActiveDoc(doc);
    setVisualOutput(null);
    try {
      const [chk, txt, ast] = await Promise.all([
        api.documentChunks(doc.id),
        api.documentContent(doc.id).catch(() => doc.summary),
        api.documentAssets(doc.id).catch(() => []),
      ]);
      setChunks(chk);
      setRawContent(txt);
      setAssets(ast);
    } catch {
      setChunks([]);
      setAssets([]);
      setRawContent(doc.summary);
    }
  };

  useEffect(() => {
    if (activeDoc) {
      inspectDoc(activeDoc);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDoc?.id]);

  const processQueue = async (items: QueueItem[]) => {
    cancelQueueRef.current = false;
    setUploading(true);
    const targetCourse = filterCourse !== "all" ? filterCourse : activeCourseId;

    if (backgroundQueueMode) {
      try {
        const res = await api.batchUploadDocuments(
          items.map((i) => i.file),
          pipeline,
          visionModel,
          targetCourse
        );
        setServerJobs((prev) => [...res.jobs, ...prev]);
        setQueue([]);
        pushNotification(`Queued ${res.queued} file(s) in background ingestion worker.`);
      } catch (err) {
        pushNotification(`Batch queue error: ${(err as Error).message}`);
      } finally {
        setUploading(false);
      }
      return;
    }

    let lastDoc: StudyDocument | null = null;
    for (const item of items) {
      if (cancelQueueRef.current) break;
      if (item.status === "done" || item.status === "duplicate") continue;

      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: "uploading", error: undefined } : q))
      );
      try {
        const doc = await api.uploadDocument(item.file, pipeline, visionModel, targetCourse);
        lastDoc = doc;
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: doc.duplicate ? "duplicate" : "done" } : q
          )
        );
      } catch (err) {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: "error", error: (err as Error).message } : q
          )
        );
      }
    }

    await refreshDocuments();
    if (lastDoc) await inspectDoc(lastDoc);
    setUploading(false);
    pushNotification("Batch upload processing finished.");
  };

  const enqueueFiles = (files: File[]) => {
    const valid = files.filter((f) => !f.name.startsWith("."));
    if (!valid.length) return;
    const newItems: QueueItem[] = valid.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${file.name}`,
      file,
      status: "queued",
    }));
    setQueue(newItems);
    processQueue(newItems);
  };

  const handleDelete = async (id: string) => {
    await api.deleteDocument(id);
    if (activeDoc?.id === id) {
      setActiveDoc(null);
      setChunks([]);
      setAssets([]);
      setRawContent("");
    }
    await refreshDocuments();
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchResults(
      await api.searchDocuments(searchQuery, filterCourse !== "all" ? filterCourse : undefined)
    );
  };

  const handleVisualAnalyze = async (task: typeof visualTask) => {
    if (!activeDoc) return;
    setVisualTask(task);
    setVisualBusy(true);
    try {
      const res = await api.analyzeVisual({
        doc_id: activeDoc.id,
        task,
        vision_model: visionModel,
        page_number: targetPage || 1,
      });
      setVisualOutput({ qr_payloads: res.qr_payloads, analysis: res.analysis });
      if (res.qr_payloads.length > 0 && task === "qr") {
        setQrInspectUrl(res.qr_payloads[0]);
      }
    } catch (err) {
      pushNotification(`Visual analysis error: ${(err as Error).message}`);
    } finally {
      setVisualBusy(false);
    }
  };

  const filteredDocs =
    filterCourse === "all" ? documents : documents.filter((d) => d.course_id === filterCourse);
  const totalPages = Math.max(1, Math.ceil(filteredDocs.length / PAGE_SIZE));
  const visibleDocs = filteredDocs.slice(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE);
  const doneCount = queue.filter((q) => q.status === "done" || q.status === "duplicate").length;

  const qrAssets = assets.filter((a) => a.asset_type === "qr");

  return (
    <div className="flex-1 overflow-y-auto p-5 md:p-7">
      <div className="max-w-6xl mx-auto space-y-5">
        <PageHeader
          icon="bx-file"
          title="Document & Visual Studio"
          subtitle="PDF (PyMuPDF), PPTX slides, DOCX, Code, XLSX/CSV, ZIP bundles, Audio & QR/Diagram scans."
          badge={<Badge tone="blue">{filteredDocs.length} files</Badge>}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterCourse}
                onChange={(e) => {
                  setFilterCourse(e.target.value);
                  setPageIdx(0);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
              >
                <option value="all">All Courses</option>
                {academicTree.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.title}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setBackgroundQueueMode((v) => !v)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                  backgroundQueueMode
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                    : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]"
                }`}
                title="Queue large batches asynchronously via background ingestion worker"
              >
                {backgroundQueueMode ? "Async Worker: ON" : "Sync Queue"}
              </button>

              <div className="flex bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPipeline("ocr")}
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${
                    pipeline === "ocr" ? "bg-[var(--accent-blue)] text-white" : "text-[var(--text-muted)]"
                  }`}
                >
                  Text / OCR
                </button>
                <button
                  type="button"
                  onClick={() => setPipeline("vlm")}
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${
                    pipeline === "vlm" ? "bg-[var(--accent-blue)] text-white" : "text-[var(--text-muted)]"
                  }`}
                >
                  VLM Vision
                </button>
              </div>

              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--accent-blue)] text-xs font-semibold cursor-pointer">
                <i className="bx bx-folder-plus text-sm" />
                Folder
                <input
                  ref={folderInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    enqueueFiles(Array.from(e.target.files || []));
                    e.target.value = "";
                  }}
                  disabled={uploading}
                />
              </label>

              <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white text-xs font-semibold cursor-pointer">
                <i className="bx bx-upload text-sm" />
                {uploading ? "Uploading…" : "Upload Files"}
                <input
                  type="file"
                  multiple
                  accept=".pdf,.pptx,.docx,.xlsx,.zip,.txt,.md,.csv,.rtf,.xml,.png,.jpg,.jpeg,.webp,.wav,.mp3,.m4a,.ogg,.webm,.flac,.c,.h,.cpp,.hpp,.py,.java,.js,.ts,.jsx,.tsx,.html,.css,.sql,.json"
                  className="hidden"
                  onChange={(e) => {
                    enqueueFiles(Array.from(e.target.files || []));
                    e.target.value = "";
                  }}
                  disabled={uploading}
                />
              </label>
            </div>
          }
        />

        {/* Background Ingestion Jobs Tray */}
        {serverJobs.length > 0 && serverJobs.some((j) => j.status !== "completed") && (
          <Panel title="Background Ingestion Jobs" subtitle="Queued & processed asynchronously via worker pool">
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {serverJobs.slice(0, 8).map((job) => (
                <div key={job.id} className="flex items-center justify-between gap-2 text-xs py-1">
                  <span className="font-mono truncate">{job.filename}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      tone={
                        job.status === "completed"
                          ? "emerald"
                          : job.status === "failed"
                          ? "red"
                          : job.status === "processing"
                          ? "blue"
                          : "amber"
                      }
                    >
                      {job.status} ({job.progress}%)
                    </Badge>
                    {(job.status === "queued" || job.status === "processing") && (
                      <button
                        type="button"
                        onClick={() => api.cancelJob(job.id).then(refreshJobs)}
                        className="text-[11px] text-red-400 cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                    {job.status === "failed" && (
                      <button
                        type="button"
                        onClick={() => api.retryJob(job.id).then(refreshJobs)}
                        className="text-[11px] text-amber-400 cursor-pointer"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* Sync Client Queue */}
        {queue.length > 0 && (
          <Panel
            title={`Upload Queue (${doneCount} / ${queue.length} processed)`}
            actions={
              <div className="flex items-center gap-2">
                {uploading && (
                  <button
                    type="button"
                    onClick={() => {
                      cancelQueueRef.current = true;
                    }}
                    className="px-2.5 py-1 rounded-md bg-red-500/15 text-red-400 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
                {!uploading && queue.some((q) => q.status === "error") && (
                  <button
                    type="button"
                    onClick={() => processQueue(queue)}
                    className="px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-400 text-xs font-semibold cursor-pointer"
                  >
                    Retry Failed
                  </button>
                )}
                {!uploading && (
                  <button
                    type="button"
                    onClick={() => setQueue([])}
                    className="text-xs text-[var(--text-muted)] cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            }
          >
            <div className="space-y-2">
              <div className="h-1.5 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div
                  className="h-full bg-[var(--accent-blue)] transition-all"
                  style={{ width: `${Math.round((doneCount / queue.length) * 100)}%` }}
                />
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {queue.map((q) => (
                  <div key={q.id} className="flex items-center justify-between text-xs py-1">
                    <span className="truncate font-mono">{q.file.name}</span>
                    <Badge
                      tone={
                        q.status === "done"
                          ? "emerald"
                          : q.status === "duplicate"
                          ? "amber"
                          : q.status === "error"
                          ? "red"
                          : q.status === "uploading"
                          ? "blue"
                          : "neutral"
                      }
                    >
                      {q.status === "error" ? q.error?.slice(0, 32) || "failed" : q.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        )}

        {/* Drag & Drop + Search */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            enqueueFiles(Array.from(e.dataTransfer.files || []));
          }}
          className={`rounded-xl border border-dashed px-4 py-3 text-xs text-center transition ${
            dragOver
              ? "border-[var(--accent-blue)] bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]"
              : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/50 text-[var(--text-muted)]"
          }`}
        >
          Drag & drop PDFs, PPTX slides, DOCX, Code, XLSX/CSV, ZIP bundles, Audio recordings, or QR/Note scans.
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <i className="bx bx-search text-base text-[var(--text-muted)]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hybrid FTS5 + Vector search across notes, slides & code (Bangla / English)…"
              className="flex-1 bg-transparent text-xs outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold hover:border-[var(--accent-blue)] cursor-pointer"
          >
            Search
          </button>
        </form>

        {searchResults.length > 0 && (
          <Panel title={`Hybrid Search Matches (${searchResults.length})`}>
            <div className="space-y-2">
              {searchResults.map((hit, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    const found = documents.find((d) => d.id === hit.doc_id);
                    if (found) {
                      setTargetPage(hit.page_num);
                      inspectDoc(found);
                    }
                  }}
                  className="w-full text-left p-3 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] hover:border-[var(--accent-blue)] text-xs space-y-1 cursor-pointer"
                >
                  <div className="flex justify-between font-semibold">
                    <span>
                      {hit.filename} · {hit.source_location || `Slide/Page ${hit.page_num}`}
                    </span>
                    <span className="font-mono text-[var(--text-muted)]">RRF {hit.score}</span>
                  </div>
                  <p className="text-[var(--text-secondary)]">{hit.content}</p>
                </button>
              ))}
            </div>
          </Panel>
        )}

        <div className="grid lg:grid-cols-12 gap-5">
          {/* Document List with Pagination */}
          <div className="lg:col-span-5 space-y-2">
            {visibleDocs.length === 0 ? (
              <EmptyState
                icon="bx-folder-open"
                title="No documents in this view"
                description="Upload PDFs, slides, DOCX, code, XLSX, ZIP archives, audio, or scans to populate this view."
              />
            ) : (
              visibleDocs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => {
                    setTargetPage(null);
                    inspectDoc(doc);
                  }}
                  className={`p-3 rounded-xl border transition cursor-pointer flex items-start justify-between gap-2 ${
                    activeDoc?.id === doc.id
                      ? "border-[var(--accent-blue)] bg-[var(--accent-blue)]/5"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)]"
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center shrink-0 text-[var(--accent-blue)]">
                      <i
                        className={`bx ${
                          doc.file_type === "code"
                            ? "bx-code-alt"
                            : doc.file_type === "pptx"
                            ? "bx-slideshow"
                            : doc.file_type === "zip"
                            ? "bx-archive"
                            : doc.file_type === "audio"
                            ? "bx-volume-full"
                            : doc.pipeline === "vlm" || doc.file_type === "image"
                            ? "bx-image"
                            : "bx-file"
                        } text-base`}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{doc.original_name}</div>
                      <div className="text-[10px] font-mono text-[var(--text-muted)]">
                        {doc.page_count} {doc.file_type === "pptx" ? "slides" : "p"} ·{" "}
                        {Math.max(1, Math.round(doc.size_bytes / 1024))} KB ·{" "}
                        {(doc.file_type || doc.pipeline).toUpperCase()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDoc(doc);
                        setView("chat");
                      }}
                      className="px-2 py-1 rounded bg-[var(--bg-elevated)] text-[10px] font-semibold hover:text-[var(--accent-blue)] cursor-pointer"
                    >
                      Ask Bhai
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(doc.id);
                      }}
                      className="p-1 rounded hover:text-red-400 text-[var(--text-muted)] cursor-pointer"
                    >
                      <i className="bx bx-trash text-sm" />
                    </button>
                  </div>
                </div>
              ))
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2 text-xs text-[var(--text-muted)]">
                <button
                  type="button"
                  disabled={pageIdx === 0}
                  onClick={() => setPageIdx((p) => Math.max(0, p - 1))}
                  className="px-2.5 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] disabled:opacity-40 cursor-pointer"
                >
                  Prev
                </button>
                <span className="font-mono">
                  Page {pageIdx + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={pageIdx + 1 >= totalPages}
                  onClick={() => setPageIdx((p) => Math.min(totalPages - 1, p + 1))}
                  className="px-2.5 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Document & Visual Studio Viewer */}
          <div className="lg:col-span-7 space-y-4">
            <Panel
              title={activeDoc ? activeDoc.original_name : "Document & Visual Viewer"}
              subtitle={
                activeDoc
                  ? `${chunks.length} chunks · ${
                      targetPage ? `Jumped to Slide/Page ${targetPage}` : activeDoc.file_type || "document"
                    }`
                  : "Select any uploaded file to preview or run Visual Studio tools"
              }
              actions={targetPage ? <Badge tone="amber">Slide/Page {targetPage}</Badge> : undefined}
            >
              {!activeDoc ? (
                <div className="py-12 text-center text-xs text-[var(--text-muted)]">
                  Click a file on the left—or click any citation in AI Chat—to inspect pages, slides, code, or diagrams.
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Visual Studio Actions for Images & PDFs */}
                  {(activeDoc.mime_type.startsWith("image/") || activeDoc.file_type === "pdf") && (
                    <div className="flex items-center gap-1.5 flex-wrap pb-2 border-b border-[var(--border-subtle)]">
                      <span className="text-[11px] font-semibold text-amber-400 mr-1">Visual Studio:</span>
                      {(
                        [
                          { id: "qr", label: "Scan QR" },
                          { id: "equation", label: "Equation → LaTeX" },
                          { id: "diagram", label: "Diagram / UML / Circuit" },
                          { id: "table", label: "Extract Table" },
                          { id: "code_screenshot", label: "Screenshot → Code" },
                        ] as const
                      ).map((tool) => (
                        <button
                          key={tool.id}
                          type="button"
                          disabled={visualBusy}
                          onClick={() => handleVisualAnalyze(tool.id)}
                          className={`px-2 py-1 rounded-md text-[11px] border cursor-pointer disabled:opacity-50 ${
                            visualTask === tool.id && visualOutput
                              ? "border-amber-400 bg-amber-500/15 text-amber-300 font-semibold"
                              : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-amber-400"
                          }`}
                        >
                          {tool.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Decoded QR Payloads stored in document_assets */}
                  {qrAssets.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <span className="font-semibold text-amber-300">Decoded QR Payload: </span>
                        <span className="font-mono text-[var(--text-primary)] truncate">
                          {qrAssets[0].extracted_payload}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQrInspectUrl(qrAssets[0].extracted_payload)}
                        className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 text-[11px] font-semibold shrink-0 cursor-pointer"
                      >
                        Inspect Safely
                      </button>
                    </div>
                  )}

                  {visualOutput && (
                    <div className="p-3 rounded-lg bg-[var(--bg-base)] border border-[var(--accent-blue)]/40 space-y-2">
                      {visualOutput.qr_payloads.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {visualOutput.qr_payloads.map((qr, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setQrInspectUrl(qr)}
                              className="px-2 py-1 rounded bg-amber-500/15 text-amber-300 text-xs font-mono cursor-pointer"
                            >
                              QR #{i + 1}: {qr.slice(0, 48)}
                            </button>
                          ))}
                        </div>
                      )}
                      {visualOutput.analysis && <MarkdownMath content={visualOutput.analysis} className="text-xs" />}
                    </div>
                  )}

                  {activeDoc.mime_type.startsWith("image/") ? (
                    <img
                      src={`/api/documents/${activeDoc.id}/file`}
                      alt={activeDoc.original_name}
                      className="w-full max-h-[480px] object-contain rounded-lg border border-[var(--border-subtle)] bg-black/20"
                    />
                  ) : activeDoc.file_type === "pdf" || activeDoc.mime_type === "application/pdf" ? (
                    <iframe
                      key={`${activeDoc.id}-${targetPage || 1}`}
                      title={activeDoc.original_name}
                      src={`/api/documents/${activeDoc.id}/file${targetPage ? `#page=${targetPage}` : ""}`}
                      className="w-full h-[480px] rounded-lg border border-[var(--border-subtle)] bg-white"
                    />
                  ) : activeDoc.file_type === "pptx" ? (
                    <div className="space-y-2.5 max-h-[480px] overflow-y-auto">
                      {chunks.map((c) => {
                        const isTarget = targetPage === c.page_num;
                        return (
                          <div
                            key={c.id}
                            className={`p-3.5 rounded-lg border text-xs space-y-1 ${
                              isTarget
                                ? "border-amber-400 bg-amber-500/10"
                                : "border-[var(--border-subtle)] bg-[var(--bg-base)]"
                            }`}
                          >
                            <div className="font-mono text-[11px] font-semibold text-amber-400">
                              Slide {c.page_num}
                            </div>
                            <div className="text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                              {c.content}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <pre className="p-3.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] text-xs font-mono whitespace-pre-wrap max-h-[480px] overflow-auto text-[var(--text-secondary)]">
                      {rawContent || activeDoc.summary}
                    </pre>
                  )}
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>

      {/* Safe QR URL Inspection Modal (never auto-opens) */}
      {qrInspectUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
          onClick={() => setQrInspectUrl(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <i className="bx bx-qr-scan text-lg" />
              Untrusted QR Payload Inspection
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              BhaiOS never opens decoded QR links automatically. Verify the exact destination below before opening it in your browser.
            </p>
            <div className="p-3 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] text-xs font-mono break-all text-[var(--text-primary)]">
              {qrInspectUrl}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(qrInspectUrl);
                  pushNotification("Copied QR payload.");
                }}
                className="px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] text-xs font-semibold cursor-pointer"
              >
                Copy Text
              </button>
              {/^https?:\/\//i.test(qrInspectUrl) && (
                <a
                  href={qrInspectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-semibold"
                >
                  Open External Link
                </a>
              )}
              <button
                type="button"
                onClick={() => setQrInspectUrl(null)}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
