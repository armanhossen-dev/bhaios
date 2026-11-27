import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { TRANSLATIONS } from "../i18n/translations";
import { api } from "../lib/api";
import type {
  AcademicTree,
  AgentMode,
  AnswerPolicy,
  ChatSession,
  Course,
  FontSize,
  HealthTelemetry,
  InstalledModel,
  IntelligenceMode,
  Language,
  StudyDocument,
  StudyMode,
  StudyTask,
  SuggestedModel,
  ThemeMode,
  ViewId,
} from "../types";

interface NotificationItem {
  id: string;
  text: string;
  time: string;
}

interface AppContextValue {
  view: ViewId;
  setView: (v: ViewId) => void;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  language: Language;
  setLanguage: (l: Language) => void;
  fontSize: FontSize;
  setFontSize: (f: FontSize) => void;
  t: (key: string) => string;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (c: boolean) => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (o: boolean) => void;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  activeDoc: StudyDocument | null;
  setActiveDoc: (doc: StudyDocument | null) => void;
  targetPage: number | null;
  setTargetPage: (p: number | null) => void;
  openCitation: (docId: string, pageNum: number) => void;
  toast: { id: string; text: string } | null;
  dismissToast: () => void;
  activeCourseId: string | null;
  setActiveCourseId: (id: string | null) => void;
  activeCourse: Course | null;
  academicTree: AcademicTree;
  refreshAcademics: () => Promise<void>;
  activeModel: string;
  setActiveModel: (m: string) => void;
  intelligenceMode: IntelligenceMode;
  setIntelligenceMode: (m: IntelligenceMode) => void;
  visionModel: string;
  setVisionModel: (m: string) => void;
  studyMode: StudyMode;
  setStudyMode: (m: StudyMode) => void;
  agentMode: AgentMode;
  setAgentMode: (m: AgentMode) => void;
  answerPolicy: AnswerPolicy;
  setAnswerPolicy: (p: AnswerPolicy) => void;
  health: HealthTelemetry | null;
  installedModels: InstalledModel[];
  suggestedModels: SuggestedModel[];
  chats: ChatSession[];
  documents: StudyDocument[];
  tasks: StudyTask[];
  sessionTokens: number;
  addSessionTokens: (n: number) => void;
  notifications: NotificationItem[];
  pushNotification: (text: string) => void;
  commandOpen: boolean;
  setCommandOpen: (o: boolean) => void;
  focusChatInput: () => void;
  triggerVoiceCapture: () => void;
  consumePendingChatFocus: () => boolean;
  consumePendingVoiceCapture: () => boolean;
  refreshAll: () => Promise<void>;
  refreshChats: () => Promise<void>;
  refreshDocuments: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  refreshModels: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [view, setView] = useState<ViewId>("home");
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("bhaios_theme");
    return saved === "system" || saved === "light" || saved === "dark" ? saved : "dark";
  });
  const [language, setLanguageState] = useState<Language>(
    () => (localStorage.getItem("bhaios_lang") as Language) || "en"
  );
  const [fontSize, setFontSizeState] = useState<FontSize>(
    () => (localStorage.getItem("bhaios_font") as FontSize) || "medium"
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<StudyDocument | null>(null);
  const [targetPage, setTargetPage] = useState<number | null>(null);
  const [toast, setToast] = useState<{ id: string; text: string } | null>(null);
  const [activeCourseId, setActiveCourseIdState] = useState<string | null>(
    () => localStorage.getItem("bhaios_course_id") || null
  );
  const [activeModel, setActiveModel] = useState("qwen3.5:4b");
  const [intelligenceMode, setIntelligenceModeState] = useState<IntelligenceMode>(
    () => (localStorage.getItem("bhaios_intel_mode") as IntelligenceMode) || "auto"
  );
  const [visionModel, setVisionModel] = useState("qwen3.5:4b");
  const [studyMode, setStudyMode] = useState<StudyMode>("guide");
  const [agentMode, setAgentMode] = useState<AgentMode>("tutor");
  const [answerPolicy, setAnswerPolicy] = useState<AnswerPolicy>("balanced");

  const [health, setHealth] = useState<HealthTelemetry | null>(null);
  const [installedModels, setInstalledModels] = useState<InstalledModel[]>([]);
  const [suggestedModels, setSuggestedModels] = useState<SuggestedModel[]>([]);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [documents, setDocuments] = useState<StudyDocument[]>([]);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [academicTree, setAcademicTree] = useState<AcademicTree>({
    universities: [],
    departments: [],
    semesters: [],
    courses: [],
  });
  const [sessionTokens, setSessionTokens] = useState(0);
  const [commandOpen, setCommandOpen] = useState(false);
  const pendingFocusRef = React.useRef(false);
  const pendingVoiceRef = React.useRef(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: "init",
      text: "100% offline local mode ready. Your academic workspace stays on this device.",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const setActiveCourseId = (id: string | null) => {
    setActiveCourseIdState(id);
    if (id) localStorage.setItem("bhaios_course_id", id);
    else localStorage.removeItem("bhaios_course_id");
  };

  const setTheme = (t: ThemeMode) => {
    setThemeState(t);
    localStorage.setItem("bhaios_theme", t);
  };

  const setLanguage = (l: Language) => {
    setLanguageState(l);
    localStorage.setItem("bhaios_lang", l);
  };

  const setFontSize = (f: FontSize) => {
    setFontSizeState(f);
    localStorage.setItem("bhaios_font", f);
  };

  const setIntelligenceMode = (m: IntelligenceMode) => {
    setIntelligenceModeState(m);
    localStorage.setItem("bhaios_intel_mode", m);
    api.saveSettings({ ai_intelligence_mode: m }).catch(() => {});
  };

  const t = useCallback(
    (key: string) => TRANSLATIONS[language][key] || TRANSLATIONS.en[key] || key,
    [language]
  );

  const pushNotification = useCallback((text: string) => {
    const id = Math.random().toString(36).slice(2);
    setNotifications((prev) => [
      {
        id,
        text,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
      ...prev.slice(0, 14),
    ]);
    setToast({ id, text });
    window.setTimeout(() => {
      setToast((cur) => (cur?.id === id ? null : cur));
    }, 4000);
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const addSessionTokens = useCallback((n: number) => {
    setSessionTokens((prev) => prev + n);
  }, []);

  useEffect(() => {
    const resolved =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;
    document.documentElement.setAttribute("data-theme", resolved);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-font-size", fontSize);
  }, [fontSize]);

  const focusChatInput = useCallback(() => {
    if (view !== "chat" && view !== "workspace") {
      pendingFocusRef.current = true;
      setView("chat");
    } else {
      window.dispatchEvent(new CustomEvent("bhaios:focus-chat"));
    }
  }, [view]);

  const triggerVoiceCapture = useCallback(() => {
    if (view !== "chat" && view !== "workspace") {
      pendingVoiceRef.current = true;
      setView("chat");
    } else {
      window.dispatchEvent(new CustomEvent("bhaios:toggle-voice"));
    }
  }, [view]);

  const consumePendingChatFocus = useCallback(() => {
    const v = pendingFocusRef.current;
    pendingFocusRef.current = false;
    return v;
  }, []);

  const consumePendingVoiceCapture = useCallback(() => {
    const v = pendingVoiceRef.current;
    pendingVoiceRef.current = false;
    return v;
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
        return;
      }

      // Focus / navigate to chat to start typing: `/` (when not typing) OR `Cmd/Ctrl + /` OR `Cmd/Ctrl + J`
      if (
        (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping) ||
        ((e.metaKey || e.ctrlKey) && (e.key === "/" || e.key.toLowerCase() === "j"))
      ) {
        e.preventDefault();
        setCommandOpen(false);
        focusChatInput();
        return;
      }

      // Toggle voice capture anywhere: `Cmd/Ctrl + Shift + V` OR `Ctrl + M` OR `Alt + V`
      if (
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "v") ||
        (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "m") ||
        (e.altKey && !e.metaKey && !e.ctrlKey && e.key.toLowerCase() === "v")
      ) {
        e.preventDefault();
        setCommandOpen(false);
        triggerVoiceCapture();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusChatInput, triggerVoiceCapture]);

  const refreshHealth = useCallback(async () => {
    try {
      setHealth(await api.health());
    } catch {
      /* backend offline */
    }
  }, []);

  const refreshModels = useCallback(async () => {
    try {
      const res = await api.models();
      setInstalledModels(res.installed);
      setSuggestedModels(res.suggested);
      if (res.installed.length > 0) {
        const textModel = res.installed.find((m) => !m.is_vision) || res.installed[0];
        const visModel = res.installed.find((m) => m.is_vision);
        setActiveModel((cur) =>
          res.installed.some((m) => m.name === cur) ? cur : textModel.name
        );
        if (visModel) {
          setVisionModel((cur) =>
            res.installed.some((m) => m.name === cur) ? cur : visModel.name
          );
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const refreshAcademics = useCallback(async () => {
    try {
      const tree = await api.academicTree();
      setAcademicTree(tree);
      if (tree.courses.length > 0) {
        setActiveCourseIdState((cur) =>
          cur && tree.courses.some((c) => c.id === cur) ? cur : tree.courses[0].id
        );
      }
    } catch {
      /* ignore */
    }
  }, []);

  const refreshChats = useCallback(async () => {
    try {
      setChats(await api.chats());
    } catch {
      /* ignore */
    }
  }, []);

  const refreshDocuments = useCallback(async () => {
    try {
      setDocuments(await api.documents());
    } catch {
      /* ignore */
    }
  }, []);

  const refreshTasks = useCallback(async () => {
    try {
      setTasks(await api.tasks());
    } catch {
      /* ignore */
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshHealth(),
      refreshModels(),
      refreshAcademics(),
      refreshChats(),
      refreshDocuments(),
      refreshTasks(),
    ]);
  }, [refreshHealth, refreshModels, refreshAcademics, refreshChats, refreshDocuments, refreshTasks]);

  useEffect(() => {
    refreshAll();
    const timer = setInterval(refreshHealth, 10000);
    return () => clearInterval(timer);
  }, [refreshAll, refreshHealth]);

  const openCitation = useCallback(
    (docId: string, pageNum: number) => {
      const found = documents.find((d) => d.id === docId) || null;
      if (found) {
        setActiveDoc(found);
        setTargetPage(pageNum);
        setView("documents");
      } else {
        pushNotification(`Opening ${docId} at page ${pageNum}`);
      }
    },
    [documents, pushNotification]
  );

  const activeCourse = academicTree.courses.find((c) => c.id === activeCourseId) || null;

  return (
    <AppContext.Provider
      value={{
        view,
        setView,
        theme,
        setTheme,
        language,
        setLanguage,
        fontSize,
        setFontSize,
        t,
        sidebarCollapsed,
        setSidebarCollapsed,
        mobileNavOpen,
        setMobileNavOpen,
        activeChatId,
        setActiveChatId,
        activeDoc,
        setActiveDoc,
        targetPage,
        setTargetPage,
        openCitation,
        toast,
        dismissToast,
        activeCourseId,
        setActiveCourseId,
        activeCourse,
        academicTree,
        refreshAcademics,
        activeModel,
        setActiveModel,
        intelligenceMode,
        setIntelligenceMode,
        visionModel,
        setVisionModel,
        studyMode,
        setStudyMode,
        agentMode,
        setAgentMode,
        answerPolicy,
        setAnswerPolicy,
        health,
        installedModels,
        suggestedModels,
        chats,
        documents,
        tasks,
        sessionTokens,
        addSessionTokens,
        notifications,
        pushNotification,
        commandOpen,
        setCommandOpen,
        focusChatInput,
        triggerVoiceCapture,
        consumePendingChatFocus,
        consumePendingVoiceCapture,
        refreshAll,
        refreshChats,
        refreshDocuments,
        refreshTasks,
        refreshModels,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
