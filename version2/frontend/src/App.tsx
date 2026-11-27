import React, { Suspense, lazy } from "react";
import { AppProvider, useApp } from "./context/AppContext";
import { CommandPalette } from "./components/CommandPalette";
import { RightPanel } from "./components/RightPanel";
import { Sidebar } from "./components/Sidebar";
import { LoadingState } from "./components/ui/Primitives";
import { ChatView } from "./components/views/ChatView";
import { DocumentsView } from "./components/views/DocumentsView";
import { HomeView } from "./components/views/HomeView";
import { MyCoursesView } from "./components/views/MyCoursesView";
import { ProgressView } from "./components/views/ProgressView";
import { ResourcesView } from "./components/views/ResourcesView";
import { SettingsView } from "./components/views/SettingsView";
import { TasksView } from "./components/views/TasksView";

const CourseWorkspaceView = lazy(() =>
  import("./components/views/CourseWorkspaceView").then((m) => ({ default: m.CourseWorkspaceView }))
);
const CodeLabView = lazy(() =>
  import("./components/views/CodeLabView").then((m) => ({ default: m.CodeLabView }))
);
const StudyStudioView = lazy(() =>
  import("./components/views/StudyStudioView").then((m) => ({ default: m.StudyStudioView }))
);
const SpeechView = lazy(() =>
  import("./components/views/SpeechView").then((m) => ({ default: m.SpeechView }))
);
const KnowledgeGraphView = lazy(() =>
  import("./components/views/KnowledgeGraphView").then((m) => ({ default: m.KnowledgeGraphView }))
);
const ModelsView = lazy(() =>
  import("./components/views/ModelsView").then((m) => ({ default: m.ModelsView }))
);

const Shell: React.FC = () => {
  const {
    view,
    setCommandOpen,
    setMobileNavOpen,
    activeCourse,
    toast,
    dismissToast,
    focusChatInput,
    triggerVoiceCapture,
  } = useApp();

  // Hide global RightPanel inside 3-pane CourseWorkspace / CodeLab so full horizontal space is used
  const showGlobalRightPanel = view === "home" || view === "chat" || view === "tasks";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Compact Mobile + Global Quick Bar */}
        <div className="h-11 px-3 md:px-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] cursor-pointer"
              aria-label="Open menu"
            >
              <i className="bx bx-menu text-xl" />
            </button>
            <span className="text-xs font-medium text-[var(--text-muted)] capitalize truncate">
              {view === "workspace" && activeCourse
                ? `${activeCourse.code} · ${activeCourse.title}`
                : view}
            </span>
            <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-semibold text-emerald-400">
              <i className="bx bx-shield-quarter text-xs" />
              LOCAL MODE — ALL PROCESSING ON THIS DEVICE
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={focusChatInput}
              title="Jump to AI Chat & start typing (/ or ⌘/)"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent-blue)] transition cursor-pointer"
            >
              <i className="bx bx-message-square-edit text-xs text-[var(--accent-blue)]" />
              <span>Chat</span>
              <kbd className="px-1 py-0.5 rounded bg-[var(--bg-surface)] text-[10px] font-mono">/</kbd>
            </button>
            <button
              type="button"
              onClick={triggerVoiceCapture}
              title="Capture voice into chat (⌘⇧V or Ctrl+M)"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-xs text-[var(--text-muted)] hover:text-amber-400 hover:border-amber-400 transition cursor-pointer"
            >
              <i className="bx bx-microphone text-xs text-amber-400" />
              <span className="hidden sm:inline">Voice</span>
              <kbd className="hidden sm:inline px-1 py-0.5 rounded bg-[var(--bg-surface)] text-[10px] font-mono">⌘⇧V</kbd>
            </button>
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent-blue)] transition cursor-pointer"
            >
              <i className="bx bx-search text-xs" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="px-1 py-0.5 rounded bg-[var(--bg-surface)] text-[10px] font-mono">
                ⌘K
              </kbd>
            </button>
          </div>
        </div>

        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <Suspense fallback={<LoadingState />}>
            {view === "home" && <HomeView />}
            {view === "courses" && <MyCoursesView />}
            {view === "workspace" && <CourseWorkspaceView />}
            {view === "chat" && <ChatView />}
            {view === "documents" && <DocumentsView />}
            {view === "codelab" && <CodeLabView />}
            {view === "study" && <StudyStudioView />}
            {view === "speech" && <SpeechView />}
            {view === "graph" && <KnowledgeGraphView />}
            {view === "models" && <ModelsView />}
            {view === "tasks" && <TasksView />}
            {view === "progress" && <ProgressView />}
            {view === "resources" && <ResourcesView />}
            {view === "settings" && <SettingsView />}
          </Suspense>
        </main>
      </div>

      {showGlobalRightPanel && <RightPanel />}
      <CommandPalette />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5 shadow-xl flex items-center gap-2.5 text-xs"
        >
          <i className="bx bx-info-circle text-base text-[var(--accent-blue)] shrink-0" />
          <span className="text-[var(--text-primary)] flex-1">{toast.text}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={dismissToast}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <i className="bx bx-x text-base" />
          </button>
        </div>
      )}
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

export default App;
