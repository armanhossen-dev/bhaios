import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../lib/api";
import type { ViewId } from "../types";

export const Sidebar: React.FC = () => {
  const {
    view,
    setView,
    theme,
    setTheme,
    language,
    setLanguage,
    t,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileNavOpen,
    setMobileNavOpen,
    chats,
    activeChatId,
    setActiveChatId,
    activeCourse,
    refreshChats,
    health,
    installedModels,
    activeModel,
    sessionTokens,
  } = useApp();

  const [pastOpen, setPastOpen] = useState(false);

  const navGroups: Array<{
    label: string;
    items: Array<{ id: ViewId; label: string; icon: string }>;
  }> = [
    {
      label: "Workspace",
      items: [
        { id: "home", label: t("home"), icon: "bx-home-alt-2" },
        { id: "courses", label: t("courses"), icon: "bx-buildings" },
        { id: "workspace", label: t("workspace"), icon: "bx-layout" },
        { id: "chat", label: t("chat"), icon: "bx-message-square-detail" },
        { id: "documents", label: t("documents"), icon: "bx-file" },
      ],
    },
    {
      label: "Studios & Labs",
      items: [
        { id: "codelab", label: t("codelab"), icon: "bx-code-alt" },
        { id: "study", label: t("study"), icon: "bx-brain" },
        { id: "speech", label: t("speech"), icon: "bx-microphone" },
        { id: "graph", label: t("graph"), icon: "bx-network-chart" },
      ],
    },
    {
      label: "Planning",
      items: [
        { id: "tasks", label: t("tasks"), icon: "bx-list-check" },
        { id: "progress", label: t("progress"), icon: "bx-bar-chart-alt-2" },
        { id: "resources", label: t("resources"), icon: "bx-book-bookmark" },
        { id: "models", label: t("models"), icon: "bx-chip" },
        { id: "settings", label: t("settings"), icon: "bx-cog" },
      ],
    },
  ];

  const activeModelMeta = installedModels.find((m) => m.name === activeModel);

  const navigate = (v: ViewId) => {
    setView(v);
    setMobileNavOpen(false);
  };

  const handleDeleteChat = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await api.deleteChat(id);
    if (activeChatId === id) setActiveChatId(null);
    await refreshChats();
  };

  const sidebarBody = (
    <aside
      className={`h-full flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-all duration-200 shrink-0 overflow-hidden ${
        sidebarCollapsed ? "w-[64px]" : "w-[248px]"
      }`}
    >
      {/* Brand Header */}
      <div
        className={`flex border-b border-[var(--border-subtle)] ${
          sidebarCollapsed
            ? "flex-col items-center gap-2 px-2 py-2.5"
            : "items-center justify-between px-3 py-3"
        }`}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent-blue)] text-white font-bold flex items-center justify-center shrink-0 text-xs">
            ভাই
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <div className="font-bold text-sm leading-tight tracking-tight flex items-center gap-1.5">
                BhaiOS <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--accent-blue)]">v3</span>
              </div>
              <div className="text-[9px] font-semibold tracking-wider text-[var(--text-muted)] truncate">
                {t("subtitle")}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden md:inline-flex items-center justify-center p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] cursor-pointer shrink-0"
        >
          <i className={`bx ${sidebarCollapsed ? "bx-dock-right text-xl" : "bx-dock-left text-lg"}`} />
        </button>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="md:hidden p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] cursor-pointer"
        >
          <i className="bx bx-x text-lg" />
        </button>
      </div>

      {/* Active Course Pill + New Conversation */}
      <div className={`${sidebarCollapsed ? "px-2 py-2.5" : "p-2.5"} space-y-1.5`}>
        {!sidebarCollapsed && activeCourse && (
          <button
            type="button"
            onClick={() => navigate("workspace")}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/25 text-left hover:bg-[var(--accent-blue)]/15 transition cursor-pointer"
          >
            <div className="min-w-0">
              <div className="text-[10px] font-mono font-semibold text-[var(--accent-blue)]">
                {activeCourse.code}
              </div>
              <div className="text-xs font-medium truncate text-[var(--text-primary)]">
                {activeCourse.title}
              </div>
            </div>
            <i className="bx bx-chevron-right text-sm text-[var(--accent-blue)] shrink-0" />
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setActiveChatId(null);
            navigate("chat");
          }}
          title={sidebarCollapsed ? t("newChat") : undefined}
          className={`w-full flex items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--accent-blue)] text-xs font-semibold transition cursor-pointer ${
            sidebarCollapsed ? "px-0 py-2" : "px-3 py-1.5"
          }`}
        >
          <i className={`bx bx-plus text-[var(--accent-blue)] ${sidebarCollapsed ? "text-xl" : "text-lg"}`} />
          {!sidebarCollapsed && <span>{t("newChat")}</span>}
        </button>
      </div>

      {/* Grouped Navigation */}
      <nav className={`flex-1 overflow-y-auto px-2 pb-2 ${sidebarCollapsed ? "space-y-2" : "space-y-3"}`}>
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-0.5">
            {!sidebarCollapsed && (
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id)}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center rounded-lg text-[13px] transition cursor-pointer ${
                    sidebarCollapsed ? "justify-center px-0 py-2" : "gap-2.5 px-2.5 py-1.5"
                  } ${
                    active
                      ? "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] font-semibold"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <i className={`bx ${item.icon} ${sidebarCollapsed ? "text-xl" : "text-lg"} shrink-0`} />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}

        {/* Collapsible Past Chats */}
        {!sidebarCollapsed && (
          <div className="pt-2 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setPastOpen(!pastOpen)}
              className="w-full flex items-center justify-between px-2.5 py-1 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <i className={`bx ${pastOpen ? "bx-chevron-down" : "bx-chevron-right"} text-sm`} />
                {t("pastChats")}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[10px] font-mono">
                {chats.length}
              </span>
            </button>

            {pastOpen && (
              <div className="mt-1 space-y-0.5 max-h-40 overflow-y-auto pr-1">
                {chats.length === 0 ? (
                  <p className="px-2.5 py-1.5 text-xs text-[var(--text-muted)]">No saved sessions.</p>
                ) : (
                  chats.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setActiveChatId(c.id);
                        navigate("chat");
                      }}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                        activeChatId === c.id
                          ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] font-medium"
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/60"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{c.title}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">{c.subject}</div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteChat(e, c.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-red-400 cursor-pointer"
                      >
                        <i className="bx bx-trash text-xs" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Footer Controls + Hardware Telemetry */}
      <div className="p-2.5 border-t border-[var(--border-subtle)] space-y-2">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center bg-[var(--bg-elevated)] p-0.5 rounded-lg border border-[var(--border-subtle)]">
              {(
                [
                  { id: "system", icon: "bx-desktop" },
                  { id: "light", icon: "bx-sun" },
                  { id: "dark", icon: "bx-moon" },
                ] as const
              ).map(({ id, icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTheme(id)}
                  className={`flex-1 flex items-center justify-center py-1 rounded-md text-xs transition cursor-pointer ${
                    theme === id
                      ? "bg-[var(--bg-surface)] text-[var(--accent-blue)]"
                      : "text-[var(--text-muted)]"
                  }`}
                >
                  <i className={`bx ${icon} text-sm`} />
                </button>
              ))}
            </div>

            <div className="flex items-center bg-[var(--bg-elevated)] p-0.5 rounded-lg border border-[var(--border-subtle)] text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`px-2 py-1 rounded-md cursor-pointer ${
                  language === "en" ? "bg-[var(--bg-surface)] text-[var(--accent-blue)]" : "text-[var(--text-muted)]"
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage("bn")}
                className={`px-2 py-1 rounded-md cursor-pointer ${
                  language === "bn" ? "bg-[var(--bg-surface)] text-[var(--accent-blue)]" : "text-[var(--text-muted)]"
                }`}
              >
                বাং
              </button>
            </div>
          </div>
        )}

        {!sidebarCollapsed && (
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2 space-y-1.5">
            <div className="flex items-center justify-between gap-1 text-[11px]">
              <span className="inline-flex items-center gap-1 font-mono font-medium truncate text-[var(--text-primary)]">
                <i className="bx bx-chip text-xs text-[var(--accent-blue)] shrink-0" />
                {activeModel}
              </span>
              <span
                className={`inline-flex items-center gap-1 font-semibold shrink-0 ${
                  activeModel.startsWith("gemini:")
                    ? "text-amber-400"
                    : health?.ollama_online
                    ? "text-emerald-400"
                    : "text-amber-400"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    activeModel.startsWith("gemini:")
                      ? "bg-amber-400"
                      : health?.ollama_online
                      ? "bg-emerald-400"
                      : "bg-amber-400"
                  }`}
                />
                {activeModel.startsWith("gemini:") ? "Cloud" : health?.ollama_online ? "Live" : "Offline"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <div className="text-[var(--text-muted)] font-semibold">{t("systemRam")}</div>
                <div className="font-mono font-semibold text-[var(--text-primary)]">
                  {health ? `${health.ram_used_gb}/${health.ram_total_gb} GB` : "--/16 GB"}
                </div>
              </div>
              <div>
                <div className="text-[var(--text-muted)] font-semibold">{t("modelSize")}</div>
                <div className="font-mono font-semibold text-[var(--text-primary)]">
                  {activeModelMeta?.size || "1.9 GB"}
                </div>
              </div>
            </div>

            <div className="h-1 w-full rounded-full bg-[var(--bg-base)] overflow-hidden">
              <div
                className="h-full bg-[var(--accent-blue)] transition-all duration-500"
                style={{ width: `${Math.min(health?.ram_percent || 35, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                <i className="bx bx-shield-quarter text-xs" />
                {t("onDevice")}
              </span>
              <span className="font-mono">{sessionTokens.toLocaleString()} tok</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden md:block h-screen shrink-0">{sidebarBody}</div>
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden bg-black/60 flex"
          onClick={() => setMobileNavOpen(false)}
        >
          <div className="h-full" onClick={(e) => e.stopPropagation()}>
            {sidebarBody}
          </div>
        </div>
      )}
    </>
  );
};
