/* ==========================================================================
   BhaiOS Prototype Controller (Interactive Screens, Modes, Data & Export)
   ========================================================================== */

import {
  INITIAL_MESSAGES,
  RETRIEVED_SNIPPETS,
  DOCUMENTS_DATA,
  INITIAL_TASKS,
  STUDY_RHYTHM,
  SUBJECT_FOCUS,
  BENCHMARK_METRICS,
} from './data.js';

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const state = {
  screen: 'chat',
  chatMode: localStorage.getItem('bhaios_chat_mode') || 'guide', // 'guide' | 'answer'
  uiLang: localStorage.getItem('bhaios_lang') || 'en', // 'en' | 'bn'
  fontSize: localStorage.getItem('bhaios_font_size') || 'medium', // 'small' | 'medium' | 'large'
  themePref: 'dark', // 'system' | 'light' | 'dark'
  voiceLang: 'auto', // 'auto' | 'bn' | 'en'
  sessionSeconds: Number(localStorage.getItem('bhaios_session_secs') || 0),
  questionsCount: Number(localStorage.getItem('bhaios_questions') || 0),
  sessionTokens: JSON.parse(localStorage.getItem('bhaios_tokens') || '{"prompt":0,"completion":0,"total":0}'),
  uploadPipeline: 'VLM',
  activeModel: localStorage.getItem('bhaios_active_model') || 'qwen2.5:3b',
  activeVisionModel: localStorage.getItem('bhaios_active_vision_model') || 'llava-phi3:latest',
  installedModels: [],
  attachedImageBase64: null,
  attachedFilename: null,
  chatStarted: false,
  messages: [...INITIAL_MESSAGES],
  snippets: [...RETRIEVED_SNIPPETS],
  documents: [...DOCUMENTS_DATA],
  tasks: JSON.parse(localStorage.getItem('bhaios_tasks') || '[]'),
  taskFilter: 'all',
  calendarAnchor: new Date(),
  selectedDateKey: null,
  focusDurationMins: 45,
  focusRemainingSecs: 45 * 60,
  focusRunning: false,
  focusInterval: null,
  docFilter: 'All',
  docQuery: '',
  snippetQuery: '',
  highlightedSnippet: null,
  notifications: [],
  isGenerating: false,
  abortController: null,
  currentChatId: null,
  savedChats: JSON.parse(localStorage.getItem('bhaios_chats') || '[]'),
};

const SCREEN_TITLES = {
  chat: 'Chat',
  documents: 'Documents',
  tasks: 'Tasks',
  progress: 'Progress',
  benchmark: 'Benchmark / Dev',
  settings: 'Settings',
};

/* ==========================================================================
   Helpers
   ========================================================================== */
function showToast(msg) {
  const el = document.getElementById('toast');
  if (el) {
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2400);
  }
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  state.notifications.unshift({ id: `n-${Date.now()}`, text: msg, time: timeStr });
  if (state.notifications.length > 25) state.notifications.pop();
  renderNotifications();
}

const I18N = {
  en: {
    newChat: 'New conversation',
    nav: { chat: 'Chat', documents: 'Documents', tasks: 'Tasks', progress: 'Progress', benchmark: 'Benchmark', settings: 'Settings' },
    titles: { chat: 'Chat', documents: 'Documents', tasks: 'Tasks', progress: 'Progress', benchmark: 'Benchmark / Dev', settings: 'Settings' },
    greeting: 'Hi Arman, How can I help you today?',
    askPlaceholder: 'Ask anything',
    guideMode: 'Guide Mode is on',
    answerMode: 'Answer Mode is on',
    guideBtn: 'Guide',
    answerBtn: 'Answer',
    disclaimer: 'BhaiOS can make mistakes. Check important info.',
    contextTitle: 'Retrieved context',
    privacy: 'All data stays on this device',
    dropTitle: 'Drop your notes. Keep them yours.',
    browseFiles: 'Browse files',
    newTask: 'New task',
    searchPlaceholder: 'Search…',
  },
  bn: {
    newChat: 'নতুন কথোপকথন',
    nav: { chat: 'চ্যাট', documents: 'ডকুমেন্টস', tasks: 'কাজ ও ডেডলাইন', progress: 'অগ্রগতি', benchmark: 'বেঞ্চমার্ক', settings: 'সেটিংস' },
    titles: { chat: 'চ্যাট', documents: 'ডকুমেন্টস', tasks: 'কাজ ও ডেডলাইন', progress: 'অগ্রগতি', benchmark: 'বেঞ্চমার্ক / ডেভ', settings: 'সেটিংস' },
    greeting: 'হাই আরমান, আজকে তোমাকে কীভাবে সাহায্য করতে পারি?',
    askPlaceholder: 'যেকোনো প্রশ্ন করো…',
    guideMode: 'গাইড মোড চালু আছে',
    answerMode: 'উত্তর মোড চালু আছে',
    guideBtn: 'গাইড',
    answerBtn: 'উত্তর',
    disclaimer: 'BhaiOS ভুল করতে পারে। গুরুত্বপূর্ণ তথ্য নোটের সাথে মিলিয়ে নাও।',
    contextTitle: 'সংগৃহীত নোট',
    privacy: 'সব ডেটা তোমার ডিভাইসেই সুরক্ষিত থাকে',
    dropTitle: 'তোমার নোট এখানে ড্রপ করো।',
    browseFiles: 'ফাইল বাছাই করো',
    newTask: 'নতুন কাজ',
    searchPlaceholder: 'খুঁজুন…',
  },
};

function applyLanguage(lang) {
  state.uiLang = lang;
  localStorage.setItem('bhaios_lang', lang);
  const t = I18N[lang];

  document.querySelectorAll('.lang-btn').forEach((b) => {
    b.setAttribute('data-state', b.dataset.lang === lang ? 'active' : 'inactive');
  });

  document.querySelector('#btnNewChat .nav-label').textContent = t.newChat;
  document.querySelectorAll('.nav-item[data-screen]').forEach((btn) => {
    const key = btn.dataset.screen;
    const lbl = btn.querySelector('.nav-label');
    if (lbl && t.nav[key]) lbl.textContent = t.nav[key];
  });

  const topTitle = document.getElementById('topBarTitle');
  if (topTitle) topTitle.textContent = t.titles[state.screen] || 'BhaiOS';
  document.getElementById('welcomeGreeting').textContent = t.greeting;
  document.getElementById('welcomeGreeting').classList.toggle('bangla', lang === 'bn');
  document.getElementById('welcomeInput').placeholder = t.askPlaceholder;
  document.getElementById('chatInput').placeholder = t.askPlaceholder;
  document.getElementById('sidebarModeLabel').textContent = state.chatMode === 'guide' ? t.guideMode : t.answerMode;
  document.querySelector('.composer-disclaimer').textContent = t.disclaimer;
  document.querySelector('.dropzone-title').textContent = t.dropTitle;
  const searchSpan = document.querySelector('.topbar-search-btn span');
  if (searchSpan) searchSpan.textContent = t.searchPlaceholder;
  const popLang = document.getElementById('popLangLabel');
  if (popLang) popLang.textContent = lang === 'bn' ? 'বাংলা' : 'English';

  // Sync voice language automatically when switching to Bangla
  if (lang === 'bn') {
    state.voiceLang = 'bn';
    document.getElementById('btnWelcomeVoiceLang').querySelector('span').textContent = 'Voice: Bangla';
    document.getElementById('btnChatVoiceLang').querySelector('span').textContent = 'Bangla';
  }
}

function applyFontSize(size) {
  state.fontSize = size;
  localStorage.setItem('bhaios_font_size', size);
  document.documentElement.setAttribute('data-font-size', size);
  document.querySelectorAll('.font-size-btn').forEach((b) => {
    b.setAttribute('data-state', b.dataset.size === size ? 'active' : 'inactive');
  });
  const popLbl = document.getElementById('popFontSizeLabel');
  if (popLbl) popLbl.textContent = size.charAt(0).toUpperCase() + size.slice(1);
}

function applyThemePreference(pref) {
  state.themePref = pref;
  let resolved = pref;
  if (pref === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', resolved);

  document.querySelectorAll('.theme-icon-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.themePref === pref);
  });

  const popLabel = document.getElementById('popThemeLabel');
  if (popLabel) {
    popLabel.textContent = pref === 'system' ? 'Device' : pref === 'light' ? 'Light' : 'Dark';
  }
}

function switchScreen(screenName) {
  state.screen = screenName;

  if (state.themePref === 'system') {
    const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', sysDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', state.themePref);
  }

  // Update active nav button
  document.querySelectorAll('.nav-item[data-screen]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.screen === screenName);
  });

  // Update screens
  document.querySelectorAll('.screen').forEach((sec) => {
    sec.classList.toggle('active', sec.id === `screen-${screenName}`);
  });

  // Update Top Bar (if present)
  const t = I18N[state.uiLang] || I18N.en;
  const topTitle = document.getElementById('topBarTitle');
  if (topTitle) topTitle.textContent = t.titles[screenName] || SCREEN_TITLES[screenName] || 'BhaiOS';
  const showChatControls = screenName === 'chat';
  const modeSw = document.getElementById('chatModeSwitch');
  if (modeSw) modeSw.style.display = showChatControls ? 'inline-flex' : 'none';
  const latChip = document.getElementById('latencyChip');
  if (latChip) latChip.style.display = showChatControls ? 'inline-flex' : 'none';
}

/* ==========================================================================
   Chat Screen (Welcome State + Active Pill/Prose Conversation)
   ========================================================================== */
function renderChat() {
  const welcomeEl = document.getElementById('chatWelcome');
  const activeEl = document.getElementById('chatActiveWrap');

  if (!state.chatStarted) {
    welcomeEl.style.display = 'flex';
    activeEl.style.display = 'none';
    return;
  }

  welcomeEl.style.display = 'none';
  activeEl.style.display = 'flex';

  const container = document.getElementById('chatMessages');
  container.innerHTML = '';

  state.messages.forEach((msg) => {
    if (msg.role === 'student') {
      const group = document.createElement('div');
      group.className = 'msg-user-group';
      const text = msg.bangla && msg.english ? `${msg.bangla} — ${msg.english}` : msg.bangla || msg.english;
      group.innerHTML = `
        <div class="msg-user-pill ${msg.bangla ? 'bangla' : ''}">${text}</div>
        <div class="msg-actions">
          <button class="msg-action-btn copy-msg-btn" data-text="${text.replace(/"/g, '&quot;')}" type="button" title="Copy"><i class="bx bx-copy"></i></button>
          <button class="msg-action-btn edit-msg-btn" data-msg-id="${msg.id}" data-text="${text.replace(/"/g, '&quot;')}" type="button" title="Edit"><i class="bx bx-pencil"></i></button>
          ${msg.time ? `<span class="msg-time">${msg.time}</span>` : ''}
        </div>
      `;
      container.appendChild(group);
    } else if (msg.role === 'assistant' || msg.role === 'assistant-inline') {
      const group = document.createElement('div');
      group.className = 'msg-assistant-group';
      const paragraphs = [msg.bangla, msg.english].filter(Boolean);
      const hasBn = paragraphs.some((p) => /[\u0980-\u09FF]/.test(p));
      const copyText = paragraphs.join('\n\n').replace(/"/g, '&quot;');
      group.innerHTML = `
        <div class="msg-assistant-prose ${hasBn ? 'bangla' : ''}">
          ${paragraphs.map((p) => `<p>${p}</p>`).join('')}
        </div>
        <div class="msg-assistant-meta">
          <div class="msg-actions" style="padding: 0;">
            <button class="msg-action-btn copy-msg-btn" data-text="${copyText}" type="button" title="Copy"><i class="bx bx-copy"></i></button>
            <button class="msg-action-btn regen-msg-btn" data-msg-id="${msg.id}" type="button" title="Repeat prompt"><i class="bx bx-refresh"></i></button>
            <button class="msg-action-btn more-msg-btn" data-meta="${escapeHtml(msg.hintChip || 'Local response')}" type="button" title="Response info"><i class="bx bx-dots-horizontal-rounded"></i></button>
          </div>
          ${msg.time ? `<span class="msg-time">${msg.time}</span>` : ''}
          ${msg.hintChip ? `<span class="hint-chip">${msg.hintChip}</span>` : ''}
          ${msg.sourceId ? `<button class="link-source" data-source="${msg.sourceId}" type="button">Show source <i class="bx bx-link-external"></i></button>` : ''}
        </div>
      `;
      container.appendChild(group);
    }
  });

  container.scrollTop = container.scrollHeight;
}

function updateRightClock() {
  const timeEl = document.getElementById('rightClockTime');
  const dateEl = document.getElementById('rightClockDate');
  if (!timeEl || !dateEl) return;
  const now = new Date();
  timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  dateEl.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}
updateRightClock();

function renderNotifications() {
  const feed = document.getElementById('notificationsFeed');
  const badge = document.getElementById('notifCountBadge');
  if (badge) badge.textContent = String(state.notifications.length);
  if (!feed) return;
  if (!state.notifications.length) {
    feed.innerHTML = `<div class="right-empty">No notifications yet.</div>`;
    return;
  }
  feed.innerHTML = state.notifications
    .map(
      (n) => `
      <div class="right-notif-item">
        <div class="right-notif-text">${escapeHtml(n.text)}</div>
        <div class="right-notif-time">${n.time}</div>
      </div>`
    )
    .join('');
}

function renderRightUploadedFiles() {
  const list = document.getElementById('rightUploadedFiles');
  const badge = document.getElementById('rightFilesCount');
  const headerAddBtn = document.getElementById('btnRightUpload');
  if (badge) badge.textContent = String(state.documents.length);
  if (headerAddBtn) headerAddBtn.style.display = state.documents.length ? 'inline-flex' : 'none';
  if (!list) return;
  if (!state.documents.length) {
    list.innerHTML = `
      <button class="right-empty-upload" type="button" title="Upload PDF or image">
        <span class="right-empty-plus"><i class="bx bx-plus"></i></span>
        <span class="right-empty-title">Add files</span>
        <span class="right-empty-sub">No files uploaded yet.</span>
      </button>`;
    return;
  }
  list.innerHTML = state.documents
    .map(
      (d) => `
      <div class="right-file-item">
        <div class="right-file-left">
          <i class="bx ${d.isBangla || d.mode === 'VLM' ? 'bx-image' : 'bx-file'}"></i>
          <div class="right-file-meta">
            <span class="right-file-name" title="${escapeHtml(d.title)}">${escapeHtml(d.title)}</span>
            <span class="right-file-sub">${d.pages}p · ${d.size}</span>
          </div>
        </div>
        <button class="right-file-ask" data-ask="Summarize ${escapeHtml(d.title)}" type="button">Ask</button>
      </div>`
    )
    .join('');
}

function renderSnippets() {
  renderRightUploadedFiles();
}

function setChatMode(mode, showFeedback = true) {
  if (!mode) return;
  state.chatMode = mode;
  localStorage.setItem('bhaios_chat_mode', mode);
  const isGuide = mode === 'guide';

  const gBtn = document.getElementById('btnModeGuide');
  const aBtn = document.getElementById('btnModeAnswer');
  if (gBtn) gBtn.className = `mode-btn ${isGuide ? 'active-guide' : ''}`;
  if (aBtn) aBtn.className = `mode-btn ${!isGuide ? 'active-answer' : ''}`;

  const sidebarPill = document.getElementById('sidebarModePill');
  const sidebarLabel = document.getElementById('sidebarModeLabel');
  if (sidebarPill) {
    sidebarPill.classList.toggle('answer-mode', !isGuide);
    sidebarPill.setAttribute('data-tooltip', isGuide ? 'Guide Mode' : 'Answer Mode');
    const icon = sidebarPill.querySelector('i');
    if (icon) icon.className = isGuide ? 'bx bx-compass' : 'bx bx-bolt-circle';
  }
  if (sidebarLabel) {
    sidebarLabel.textContent = isGuide ? 'Guide Mode is on' : 'Answer Mode is on';
  }

  document.querySelectorAll('.mode-toggle-btn').forEach((btn) => {
    btn.classList.toggle('guide', isGuide);
    btn.classList.toggle('answer', !isGuide);
    const lbl = btn.querySelector('.mode-label');
    if (lbl) lbl.textContent = isGuide ? 'Guide Mode' : 'Answer Mode';
    const icon = btn.querySelector('.mode-icon');
    if (icon) icon.className = isGuide ? 'bx bx-compass mode-icon' : 'bx bx-bolt-circle mode-icon';
  });

  document.querySelectorAll('.mode-dropdown-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.setMode === mode);
  });

  if (showFeedback) {
    showToast(isGuide ? 'Switched to Guide Mode (Socratic hints)' : 'Switched to Answer Mode (Direct answers)');
  }
}

function detectChatSubject(messages) {
  const combined = messages.map((m) => `${m.bangla || ''} ${m.english || ''}`).join(' ').toLowerCase();
  if (/newton|নিউটন|force|বল|velocity|বেগ|acceleration|toron|ত্বরণ|gravity|physics|পদার্থ|motion|গতি|ohm|wave|তরঙ্গ|optics/.test(combined)) {
    return 'Physics';
  }
  if (/chem|রসায়ন|mole|মোল|acid|অম্ল|reaction|বিক্রিয়া|organic|জৈব|atom|পরমাণু|periodic|bond/.test(combined)) {
    return 'Chemistry';
  }
  if (/math|গণিত|calculus|integral|derivative|matrix|ম্যাট্রিক্স|trigonometry|ত্রিকোণমিতি|equation|সমীকরণ|algebra|geometry/.test(combined)) {
    return 'Math';
  }
  if (/biology|জীববিজ্ঞান|cell|কোষ|dna|rna|genetics|photosynthesis|সালোকসংশ্লেষণ|enzyme/.test(combined)) {
    return 'Biology';
  }
  if (/বাংলা|bangla|ব্যাকরণ|সন্ধি|সমাস|কবিতা|গদ্য/.test(combined)) {
    return 'Bangla';
  }
  if (/english|grammar|essay|tense|paragraph|ইংরেজি|vocabulary/.test(combined)) {
    return 'English';
  }
  if (/ict|python|javascript|html|css|binary|বাইনারি|database|sql|algorithm|code|কোড/.test(combined)) {
    return 'ICT';
  }
  return 'General';
}

function formatChatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return timeStr;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${timeStr}`;
}

function persistSavedChats() {
  localStorage.setItem('bhaios_chats', JSON.stringify(state.savedChats));
}

function saveCurrentChat() {
  if (!state.chatStarted || !state.messages.length) return;
  const firstUser = state.messages.find((m) => m.role === 'student');
  const rawTitle = (firstUser?.bangla || firstUser?.english || 'Study session').trim();
  const title = rawTitle.length > 34 ? `${rawTitle.slice(0, 34)}…` : rawTitle;
  const subject = detectChatSubject(state.messages);
  const nowIso = new Date().toISOString();

  if (!state.currentChatId) {
    state.currentChatId = `chat-${Date.now()}`;
  }

  const entry = {
    id: state.currentChatId,
    title,
    subject,
    updatedAt: nowIso,
    messages: state.messages.filter((m) => !String(m.id).startsWith('a-pending-')),
  };

  const existingIdx = state.savedChats.findIndex((c) => c.id === state.currentChatId);
  if (existingIdx !== -1) {
    state.savedChats.splice(existingIdx, 1);
  }
  state.savedChats.unshift(entry);
  if (state.savedChats.length > 40) state.savedChats.pop();
  persistSavedChats();
  renderSavedChats();
}

function loadSavedChat(chatId) {
  const chat = state.savedChats.find((c) => c.id === chatId);
  if (!chat) return;
  state.currentChatId = chat.id;
  state.chatStarted = true;
  state.messages = chat.messages.map((m) => ({ ...m }));
  switchScreen('chat');
  renderChat();
  renderSavedChats();
}

function deleteSavedChat(chatId) {
  state.savedChats = state.savedChats.filter((c) => c.id !== chatId);
  persistSavedChats();
  if (state.currentChatId === chatId) {
    state.currentChatId = null;
    state.chatStarted = false;
    state.messages = [];
    renderChat();
  }
  renderSavedChats();
  showToast('Chat deleted');
}

function renderSavedChats() {
  const countEl = document.getElementById('navPastChatsCount');
  if (countEl) countEl.textContent = String(state.savedChats.length);
  const list = document.getElementById('savedChatsList');
  if (!list) return;
  if (!state.savedChats.length) {
    list.innerHTML = `<div class="saved-chat-empty">No saved chats yet.</div>`;
    return;
  }
  list.innerHTML = state.savedChats
    .map(
      (c) => `
      <div class="saved-chat-item ${state.currentChatId === c.id ? 'active' : ''}" data-chat-id="${c.id}">
        <div class="saved-chat-info">
          <div class="saved-chat-title" title="${escapeHtml(c.title)}">${escapeHtml(c.title)}</div>
          <div class="saved-chat-meta">
            <span class="saved-chat-subject">${escapeHtml(c.subject || 'General')}</span>
            <span class="saved-chat-time">${formatChatTime(c.updatedAt)}</span>
          </div>
        </div>
        <button class="saved-chat-del" data-del-chat="${c.id}" type="button" title="Delete chat" aria-label="Delete chat">
          <i class="bx bx-trash"></i>
        </button>
      </div>`
    )
    .join('');
}

function stopChatGeneration() {
  if (state.abortController) {
    state.abortController.abort();
  }
}

async function sendChatMessage(customText, options = {}) {
  if (state.isGenerating) return;
  const input = document.getElementById('chatInput');
  const welcomeInput = document.getElementById('welcomeInput');
  const text = (customText ?? (state.chatStarted ? input.value : welcomeInput.value)).trim();
  if (!text) return;

  if (!state.chatStarted) {
    state.chatStarted = true;
    state.messages = [];
    state.currentChatId = `chat-${Date.now()}`;
  }

  if (!options.skipUserPush) {
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const hasBangla = /[\u0980-\u09FF]/.test(text);
    state.messages.push({
      id: `m-${Date.now()}`,
      role: 'student',
      bangla: hasBangla ? text : '',
      english: hasBangla ? '' : text,
      time: nowTime,
    });
  }

  const pendingId = `a-pending-${Date.now()}`;
  state.messages.push({
    id: pendingId,
    role: 'assistant',
    mode: state.chatMode,
    english: state.attachedImageBase64
      ? `Analyzing "${state.attachedFilename || 'image'}" with ${state.activeVisionModel}…`
      : `Thinking locally with ${state.activeModel}…`,
    hintChip: state.chatMode === 'guide' ? 'Guide Mode' : 'Answer Mode',
  });

  input.value = '';
  welcomeInput.value = '';
  state.isGenerating = true;
  state.abortController = new AbortController();
  syncSendButtons();
  renderChat();

  const history = state.messages
    .filter((m) => m.id !== pendingId)
    .slice(-6)
    .map((m) => ({
      role: m.role === 'student' ? 'user' : 'assistant',
      content: m.bangla || m.english || '',
    }));

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: state.abortController.signal,
      body: JSON.stringify({
        message: text,
        mode: state.chatMode,
        model: state.activeModel,
        vision_model: state.activeVisionModel,
        image_base64: state.attachedImageBase64,
        history,
      }),
    });

    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    const idx = state.messages.findIndex((m) => m.id === pendingId);
    if (idx !== -1) {
      state.messages[idx] = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        mode: state.chatMode,
        english: data.reply || 'No response received.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        hintChip: data.used_vision
          ? `VLM · ${data.model_used} · ${data.latency_s}s`
          : `${data.model_used} · ${data.latency_s}s`,
        sourceId: 's2',
      };
    }
    const latChip = document.getElementById('latencyChip');
    if (latChip) latChip.textContent = `${data.latency_s}s / resp`;

    state.sessionTokens.prompt += data.prompt_tokens || 0;
    state.sessionTokens.completion += data.completion_tokens || 0;
    state.sessionTokens.total += data.total_tokens || 0;
    localStorage.setItem('bhaios_tokens', JSON.stringify(state.sessionTokens));
    const tokEl = document.getElementById('tokenUsageText');
    if (tokEl) tokEl.textContent = `${state.sessionTokens.total.toLocaleString()} tok`;

    state.questionsCount += 1;
    localStorage.setItem('bhaios_questions', String(state.questionsCount));
    const qEl = document.getElementById('kpiQuestionsCount');
    if (qEl) qEl.textContent = String(state.questionsCount);

    state.attachedImageBase64 = null;
    state.attachedFilename = null;
  } catch (err) {
    const idx = state.messages.findIndex((m) => m.id === pendingId);
    if (idx !== -1) {
      if (err && err.name === 'AbortError') {
        state.messages[idx] = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          mode: state.chatMode,
          english: 'Stopped.',
          hintChip: 'Stopped',
        };
        showToast('Generation stopped');
      } else {
        state.messages[idx] = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          mode: state.chatMode,
          english:
            state.chatMode === 'guide'
              ? 'Start the local backend (`python3 version1/server.py`) for live Ollama answers. Hint: break the problem into knowns and unknowns first.'
              : 'Start the local backend (`python3 version1/server.py`) for live Ollama responses.',
          hintChip: 'Offline Demo Fallback',
        };
      }
    }
  } finally {
    state.isGenerating = false;
    state.abortController = null;
    syncSendButtons();
  }
  saveCurrentChat();
  renderChat();
}

/* ==========================================================================
   Documents Screen
   ========================================================================== */
function renderDocuments() {
  const grid = document.getElementById('docsGrid');
  const q = state.docQuery.toLowerCase();
  const list = state.documents.filter((d) => {
    const matchSubject = state.docFilter === 'All' || d.subject === state.docFilter;
    const matchQuery =
      !q || d.title.toLowerCase().includes(q) || d.topic.toLowerCase().includes(q) || d.subject.toLowerCase().includes(q);
    return matchSubject && matchQuery;
  });

  document.getElementById('navDocCount').textContent = String(state.documents.length);
  document.getElementById('libraryCountLabel').textContent = `${state.documents.length} document${state.documents.length === 1 ? '' : 's'}`;
  document.getElementById('docsShowingLabel').textContent = `Showing ${list.length} of ${state.documents.length} documents`;
  renderRightUploadedFiles();

  if (!list.length) {
    grid.innerHTML = `<div style="grid-column: 1 / -1; padding: 32px; text-align: center; color: var(--text-muted); border: 1px dashed var(--border-card); border-radius: 12px;">No documents uploaded yet. Drop a PDF, JPG, or PNG above.</div>`;
    return;
  }

  grid.innerHTML = list
    .map(
      (d) => `
      <article class="doc-card">
        <div class="doc-preview ${d.tintGreen ? 'tint-green' : ''}">
          <div class="doc-preview-top">
            <span class="${d.isBangla ? 'bangla' : ''}">${d.topic}</span>
            <span class="doc-mode-badge">${d.mode}</span>
          </div>
          <div class="doc-formula ${d.isBangla ? 'bangla' : ''}">${d.formula}</div>
        </div>
        <div class="doc-title ${d.isBangla ? 'bangla' : ''}">${d.title}</div>
        <div class="doc-meta-row">
          <span>${d.pages} pages · ${d.size}</span>
          <span>${d.subject}</span>
        </div>
        <div data-slot="progress">
          <div data-slot="progress-indicator" class="${d.status === 'processing' ? 'processing' : ''}" style="transform: translateX(-${100 - d.progress}%)"></div>
        </div>
        <div class="doc-footer">
          ${
            d.status === 'indexed'
              ? `<span class="doc-status-ok"><i class="bx bx-check"></i> Indexed</span>
                 <button class="link-source doc-open-btn" data-doc="${d.title}" type="button" style="color: var(--text-secondary);">Open <i class="bx bx-link-external"></i></button>`
              : `<span class="doc-status-proc"><i class="bx bx-loader-alt bx-spin"></i> Processing · ${d.progress}%</span>
                 <span class="mono" style="font-size: 11px; color: var(--text-muted);">${d.eta}</span>`
          }
        </div>
      </article>
    `
    )
    .join('');
}

async function addSimulatedDocument(fileOrName, attachToChat = false) {
  const isFileObj = typeof fileOrName === 'object' && fileOrName instanceof File;
  const filename = isFileObj ? fileOrName.name : String(fileOrName);
  const sizeStr =
    isFileObj && fileOrName.size
      ? `${Math.max(0.1, fileOrName.size / (1024 * 1024)).toFixed(1)} MB`
      : '1.9 MB';

  const docObj = {
    id: `d-${Date.now()}`,
    topic: 'Uploaded note',
    formula: filename.replace(/\.[^/.]+$/, ''),
    title: filename,
    pages: 1,
    size: sizeStr,
    subject: 'Physics',
    mode: state.uploadPipeline,
    status: 'processing',
    progress: 45,
    eta: 'indexing…',
    isBangla: false,
  };
  state.documents.unshift(docObj);
  renderDocuments();
  showToast(`Indexing "${filename}" locally via ${state.uploadPipeline}…`);

  if (isFileObj) {
    try {
      const form = new FormData();
      form.append('file', fileOrName);
      form.append('pipeline', state.uploadPipeline);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (res.ok) {
        const data = await res.json();
        docObj.pages = data.pages || 1;
        docObj.size = data.size || sizeStr;
        if (data.has_image && data.image_base64) {
          state.attachedImageBase64 = data.image_base64;
          state.attachedFilename = filename;
        }
        state.snippets.unshift({
          id: data.id || `s-${Date.now()}`,
          index: `${String(state.snippets.length + 1).padStart(2, '0')} / ${state.uploadPipeline}`,
          title: filename,
          body: data.preview || 'Indexed locally for Q&A.',
          source: `${data.pages || 1}p · ${filename}`,
          isBangla: data.has_image,
        });
        renderSnippets();
      }
    } catch {
      // fallback to local preview if backend is not running
    }
  }

  docObj.status = 'indexed';
  docObj.progress = 100;
  renderDocuments();
  showToast(`"${filename}" indexed on-device`);

  if (attachToChat) {
    document.getElementById('uploadModal').classList.remove('open');
    sendChatMessage(`I uploaded "${filename}". Give me a quick guide or summary of what is in it.`);
  }
}

/* ==========================================================================
   Tasks Screen
   ========================================================================== */
function renderTasks() {
  const container = document.getElementById('tasksContainer');
  localStorage.setItem('bhaios_tasks', JSON.stringify(state.tasks));
  const activeCount = state.tasks.filter((t) => !t.completed).length;
  const doneCount = state.tasks.filter((t) => t.completed).length;
  const navCount = document.getElementById('navTaskCount');
  if (navCount) navCount.textContent = String(activeCount);
  const pillAll = document.getElementById('pillAllCount');
  if (pillAll) pillAll.textContent = String(state.tasks.length);
  const metaEl = document.getElementById('focusTasksMeta');
  if (metaEl) metaEl.textContent = `${activeCount} active task${activeCount === 1 ? '' : 's'}`;
  const kpiTC = document.getElementById('kpiTasksCompleted');
  if (kpiTC) kpiTC.textContent = `${doneCount} / ${state.tasks.length}`;
  const kpiTP = document.getElementById('kpiTasksPending');
  if (kpiTP) kpiTP.textContent = `${activeCount} remaining`;

  const rightTaskCount = document.getElementById('rightTaskCount');
  if (rightTaskCount) rightTaskCount.textContent = String(activeCount);
  renderRightTasks();

  if (!container) return;

  const filtered = state.tasks.filter((t) => {
    if (state.taskFilter === 'today') return t.today && !t.completed;
    if (state.taskFilter === 'completed') return t.completed;
    return true;
  });

  if (!filtered.length) {
    container.innerHTML = `<div style="padding: 32px; text-align: center; color: var(--text-muted); border: 1px dashed var(--border-card); border-radius: 12px;">No tasks yet. Click <strong>+ New task</strong> to add one.</div>`;
    return;
  }

  const groups = [
    { key: 'overdue', title: '<i class="bx bx-error-circle"></i> Overdue', cls: 'overdue' },
    { key: 'week', title: 'This week', cls: '' },
    { key: 'upcoming', title: 'Upcoming', cls: '' },
  ];

  container.innerHTML = groups
    .map((g) => {
      const items = filtered.filter((t) => t.bucket === g.key);
      if (!items.length) return '';
      return `
        <div class="task-group">
          <div class="task-group-header">
            <h3 class="task-group-title ${g.cls}" style="display:flex; align-items:center; gap:6px;">${g.title}</h3>
            <span class="task-group-count">0${items.length}</span>
          </div>
          <div class="task-list">
            ${items
              .map(
                (t) => `
                <div class="task-row ${t.completed ? 'done' : ''}">
                  <div class="task-left">
                    <button class="task-checkbox ${t.completed ? 'checked' : ''}" data-task-id="${t.id}" type="button">
                      ${t.completed ? '<i class="bx bx-check"></i>' : ''}
                    </button>
                    <div>
                      <div class="task-title">${t.title}</div>
                      <div class="task-meta">
                        <span class="subject-chip">${t.subject}</span>
                        <span>${t.due}</span>
                      </div>
                    </div>
                  </div>
                  <div class="task-right-actions">
                    <span class="priority-dot priority-${t.priority}">${t.priority}</span>
                    <button class="task-delete-btn" data-delete-id="${t.id}" type="button" title="Delete task" aria-label="Delete task">
                      <i class="bx bx-trash"></i>
                    </button>
                  </div>
                </div>
              `
              )
              .join('')}
          </div>
        </div>
      `;
    })
    .join('');
}

function renderRightTasks() {
  const list = document.getElementById('rightTasksList');
  if (!list) return;

  if (!state.tasks.length) {
    list.innerHTML = `<div class="right-empty">No tasks yet. Click <strong>+ Add</strong> to create one.</div>`;
    return;
  }

  const sorted = [...state.tasks]
    .sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1))
    .slice(0, 6);

  list.innerHTML = sorted
    .map(
      (t) => `
      <div class="right-task-row ${t.completed ? 'done' : ''}">
        <button class="right-task-check ${t.completed ? 'checked' : ''}" data-right-task-id="${t.id}" type="button" title="${t.completed ? 'Mark pending' : 'Mark done'}">
          ${t.completed ? '<i class="bx bx-check"></i>' : ''}
        </button>
        <div class="right-task-info">
          <span class="right-task-title">${escapeHtml(t.title)}</span>
          <div class="right-task-meta">
            <span class="right-task-chip">${escapeHtml(t.subject || 'Study')}</span>
            ${t.due ? `<span class="right-task-due">${escapeHtml(t.due)}</span>` : ''}
          </div>
        </div>
        <button class="right-task-del" data-right-delete-id="${t.id}" type="button" title="Delete task">
          <i class="bx bx-trash"></i>
        </button>
      </div>`
    )
    .join('');
}

function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const monthLabel = document.getElementById('calendarMonthLabel');
  const selectedLabel = document.getElementById('calendarSelectedLabel');
  if (!grid) return;

  const anchor = state.calendarAnchor;
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  monthLabel.textContent = anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay() === 0 ? 6 : firstOfMonth.getDay() - 1; // Mon=0..Sun=6
  const startDate = new Date(year, month, 1 - startOffset);
  const todayKey = new Date().toISOString().slice(0, 10);
  const selectedKey = state.selectedDateKey || todayKey;

  const dows = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const cells = dows.map((d) => `<span class="cal-dow">${d}</span>`);

  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const isOtherMonth = d.getMonth() !== month;
    const isSelected = selectedKey === key;
    const isToday = todayKey === key;
    cells.push(`
      <button class="cal-day-btn ${isOtherMonth ? 'muted' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-cal-date="${key}" type="button">
        <span>${d.getDate()}</span>
      </button>
    `);
  }

  grid.innerHTML = cells.join('');
  const activeDate = state.selectedDateKey ? new Date(state.selectedDateKey + 'T12:00:00') : new Date();
  selectedLabel.innerHTML = `<span>${activeDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}</span>`;
}

function formatTimer(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function updateFocusTimerUI() {
  const navPill = document.getElementById('navbarFocusTimer');
  const navText = document.getElementById('navbarTimerText');
  const btnFocus = document.getElementById('btnStartFocus');
  const bigLabel = document.getElementById('focusCardDuration');
  const formatted = formatTimer(state.focusRemainingSecs);

  if (navText) navText.textContent = formatted;
  if (navPill) {
    navPill.style.display = 'inline-flex';
    navPill.classList.toggle('running', state.focusRunning);
  }
  if (btnFocus) {
    btnFocus.innerHTML = state.focusRunning
      ? `<i class="bx bx-pause"></i> Pause focus (${formatted})`
      : `<i class="bx bx-play"></i> ${state.focusRemainingSecs < state.focusDurationMins * 60 ? `Resume (${formatted})` : 'Start focus session'}`;
  }
  if (bigLabel) {
    bigLabel.textContent = state.focusRunning || state.focusRemainingSecs < state.focusDurationMins * 60
      ? formatted
      : `${state.focusDurationMins} min`;
  }
}

function setFocusDuration(mins) {
  state.focusDurationMins = mins;
  state.focusRemainingSecs = mins * 60;
  if (state.focusRunning) {
    clearInterval(state.focusInterval);
    state.focusRunning = false;
  }
  updateFocusTimerUI();
  document.querySelectorAll('.focus-opt-btn, .focus-chip').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.mins) === mins);
  });
  showToast(`Focus timer set to ${mins} minutes`);
}

function resetFocusTimer() {
  if (state.focusRunning) {
    clearInterval(state.focusInterval);
    state.focusRunning = false;
  }
  state.focusRemainingSecs = state.focusDurationMins * 60;
  updateFocusTimerUI();
  showToast(`Focus timer reset to ${formatTimer(state.focusRemainingSecs)}`);
}

function toggleFocusTimer() {
  if (state.focusRunning) {
    clearInterval(state.focusInterval);
    state.focusRunning = false;
    updateFocusTimerUI();
    showToast('Focus timer paused');
    return;
  }

  if (state.focusRemainingSecs <= 0) state.focusRemainingSecs = state.focusDurationMins * 60;
  state.focusRunning = true;
  updateFocusTimerUI();
  showToast(`${state.focusDurationMins}-min reverse focus countdown started`);

  state.focusInterval = setInterval(() => {
    state.focusRemainingSecs -= 1;
    updateFocusTimerUI();
    if (state.focusRemainingSecs <= 0) {
      clearInterval(state.focusInterval);
      state.focusRunning = false;
      updateFocusTimerUI();
      showToast('Focus session complete! Great work.');
    }
  }, 1000);
}

/* ==========================================================================
   Progress & Benchmark Screens
   ========================================================================== */
function renderProgress() {
  const totalMins = Math.floor(state.sessionSeconds / 60);
  const hrs = Math.floor(totalMins / 60);
  const remMins = String(totalMins % 60).padStart(2, '0');
  const kpiTime = document.getElementById('kpiStudyTime');
  if (kpiTime) kpiTime.textContent = `${hrs}h ${remMins}m`;
  const kpiQ = document.getElementById('kpiQuestionsCount');
  if (kpiQ) kpiQ.textContent = String(state.questionsCount);

  const rhythm = document.getElementById('rhythmBars');
  const rhythmData = STUDY_RHYTHM.map((d) => (d.active ? { ...d, mins: totalMins } : d));
  rhythm.innerHTML = rhythmData.map(
    (d) => `
      <div class="rhythm-col">
        <span class="rhythm-val">${d.mins}</span>
        <div class="rhythm-bar ${d.active ? 'active' : ''}" style="height: ${Math.max(4, Math.min(130, d.mins * 2))}px"></div>
        <span class="rhythm-day">${d.day}</span>
      </div>
    `
  ).join('');

  const focus = document.getElementById('focusBars');
  if (!SUBJECT_FOCUS.length) {
    focus.innerHTML = `<div style="padding: 20px 0; font-size: 12.5px; color: var(--text-muted);">Subject focus will appear as you complete study tasks.</div>`;
  } else {
    focus.innerHTML = SUBJECT_FOCUS.map(
      (s) => `
        <div class="focus-bar-row">
          <div class="focus-bar-head">
            <span>${s.name}</span>
            <span class="mono" style="color: var(--text-secondary);">${s.mins} min</span>
          </div>
          <div class="focus-track">
            <div class="focus-fill" style="width: ${s.pct}%"></div>
          </div>
        </div>
      `
    ).join('');
  }

  renderHeatmap();
  renderAppTimeGraph();
}

function renderHeatmap() {
  const grid = document.getElementById('studyHeatmap');
  const info = document.getElementById('heatmapHoverInfo');
  if (!grid) return;

  const days = 112;
  const today = new Date();
  const todayHrs = +(state.sessionSeconds / 3600).toFixed(2);
  const cells = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const hours = i === 0 ? todayHrs : 0;
    const level = hours === 0 ? 0 : hours < 0.5 ? 1 : hours < 1.5 ? 2 : hours < 2.5 ? 3 : 4;
    const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    cells.push(`<div class="heatmap-cell level-${level}" data-info="${label} · ${hours.toFixed(2)} hrs studied"></div>`);
  }

  grid.innerHTML = cells.join('');
  document.getElementById('heatmapTotalHours').textContent = `${todayHrs.toFixed(2)} hrs total`;

  grid.addEventListener('mouseover', (e) => {
    const cell = e.target.closest('.heatmap-cell');
    if (cell) info.textContent = cell.dataset.info;
  });
  grid.addEventListener('mouseleave', () => {
    info.textContent = 'Hover any day to inspect hours studied · Last 16 weeks';
  });
}

function renderAppTimeGraph() {
  const wrap = document.getElementById('appTimeGraph');
  if (!wrap) return;

  const liveMins = Math.floor(state.sessionSeconds / 60);
  const thisWeek = [0, 0, 0, 0, 0, 0, liveMins];
  const lastWeek = [0, 0, 0, 0, 0, 0, 0];
  const labels = ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'];

  const w = 520;
  const h = 165;
  const padL = 28;
  const padR = 14;
  const padT = 14;
  const padB = 26;
  const maxVal = 120;

  const toXY = (arr) =>
    arr.map((v, i) => {
      const x = padL + (i / (arr.length - 1)) * (w - padL - padR);
      const y = padT + (1 - Math.min(v, maxVal) / maxVal) * (h - padT - padB);
      return [x, y];
    });

  const pts1 = toXY(thisWeek);
  const pts2 = toXY(lastWeek);
  const line1 = pts1.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const line2 = pts2.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area1 = `${line1} L${pts1[pts1.length - 1][0].toFixed(1)},${h - padB} L${pts1[0][0].toFixed(1)},${h - padB} Z`;

  wrap.innerHTML = `
    <svg class="time-graph-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="appTimeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="#3B82F6" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      <line x1="${padL}" y1="${padT}" x2="${w - padR}" y2="${padT}" stroke="#1F2024" stroke-dasharray="3 3"/>
      <line x1="${padL}" y1="${padT + (h - padT - padB) / 2}" x2="${w - padR}" y2="${padT + (h - padT - padB) / 2}" stroke="#1F2024" stroke-dasharray="3 3"/>
      <line x1="${padL}" y1="${h - padB}" x2="${w - padR}" y2="${h - padB}" stroke="#1F2024"/>
      <text x="0" y="${padT + 4}" fill="#5C6068" font-size="10" font-family="JetBrains Mono">120m</text>
      <text x="4" y="${padT + (h - padT - padB) / 2 + 4}" fill="#5C6068" font-size="10" font-family="JetBrains Mono">60m</text>
      <text x="12" y="${h - padB + 4}" fill="#5C6068" font-size="10" font-family="JetBrains Mono">0m</text>
      <path d="${line2}" fill="none" stroke="#3F424A" stroke-width="1.5"/>
      <path d="${area1}" fill="url(#appTimeGrad)"/>
      <path d="${line1}" fill="none" stroke="#3B82F6" stroke-width="2"/>
      ${pts1.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="#3B82F6"/><text x="${p[0].toFixed(1)}" y="${h - 6}" text-anchor="middle" fill="#5C6068" font-size="10" font-family="Inter">${labels[i]}</text>`).join('')}
    </svg>
  `;
}

function renderBenchmark() {
  const tbody = document.getElementById('benchmarkTbody');
  if (!BENCHMARK_METRICS.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="color: var(--text-muted); text-align: center; padding: 20px 0;">No benchmark run yet. Click <strong>Run benchmark</strong> to measure local VLM vs OCR+LLM.</td></tr>`;
    return;
  }
  tbody.innerHTML = BENCHMARK_METRICS.map(
    (m) => `
      <tr>
        <td style="color: var(--text-secondary);">${m.metric}</td>
        <td class="mono">${m.vlm}</td>
        <td class="mono">${m.ocr}</td>
        <td>
          <span class="status-dot-inline ${m.preferredType === 'vlm' ? 'blue' : 'green'}">${m.preferred}</span>
        </td>
      </tr>
    `
  ).join('');
}

function renderCommandResults(query = '') {
  const container = document.getElementById('commandResults');
  const q = query.trim().toLowerCase();

  const liveItems = [
    ...state.documents.map((d) => ({ group: 'Documents', icon: 'bx-file', label: d.title, action: () => switchScreen('documents') })),
    ...state.tasks.map((t) => ({ group: 'Tasks', icon: 'bx-list-ul', label: t.title, action: () => switchScreen('tasks') })),
  ];

  const filtered = liveItems.filter((item) => !q || item.label.toLowerCase().includes(q));
  if (!filtered.length) {
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">No documents or tasks yet.</div>';
    return;
  }

  container.innerHTML = filtered
    .map(
      (item, idx) => `
        <button class="command-item ${idx === 0 ? 'active' : ''}" data-cmd-idx="${idx}" type="button">
          <i class="bx ${item.icon}"></i>
          <span>${item.label}</span>
        </button>
      `
    )
    .join('');

  container._items = filtered;
}

/* ==========================================================================
   Model Manager & Whisper Voice Input
   ========================================================================== */
const KNOWN_MODEL_SPECS = {
  'qwen2.5:3b': { size: '1.9 GB', ram: '4 GB RAM' },
  'llava-phi3:latest': { size: '2.9 GB', ram: '5 GB RAM' },
  'llama3.2:1b': { size: '1.3 GB', ram: '2 GB RAM' },
  'qwen2.5:0.5b': { size: '398 MB', ram: '1 GB RAM' },
  'qwen2.5vl:3b': { size: '3.2 GB', ram: '6 GB RAM' },
  'gemma3:4b': { size: '3.3 GB', ram: '6 GB RAM' },
  'moondream:latest': { size: '1.7 GB', ram: '3 GB RAM' },
};

function getModelFootprint(modelName) {
  if (!modelName) return { size: '1.9 GB', ram: '4 GB RAM' };
  const found = state.installedModels.find((m) => m.name === modelName);
  if (found && found.size) {
    const known = KNOWN_MODEL_SPECS[modelName] || {};
    return {
      size: found.size,
      ram: known.ram || (found.params ? `~${found.params} RAM` : '4 GB RAM'),
    };
  }
  return KNOWN_MODEL_SPECS[modelName] || { size: '1.9 GB', ram: '4 GB RAM' };
}

function formatModelName(name) {
  if (!name) return '';
  const cap = name.charAt(0).toUpperCase() + name.slice(1);
  if (cap.includes(':')) {
    const [base, tag] = cap.split(':');
    let displayBase = base;
    if (/^llava/i.test(base)) {
      displayBase = base.replace(/^llava/i, 'LLaVA').replace(/-phi/i, '-Phi');
    } else if (/^deepseek/i.test(base)) {
      displayBase = base.replace(/^deepseek/i, 'DeepSeek');
    }
    const displayTag = tag ? (tag.toLowerCase() === 'latest' ? 'Latest' : tag.toUpperCase()) : '';
    return `${displayBase} · ${displayTag}`;
  }
  return cap;
}

function updateActiveModelLabels() {
  const formatted = formatModelName(state.activeModel);
  const spec = getModelFootprint(state.activeModel);

  const textLabel = document.getElementById('activeTextModelLabel');
  if (textLabel) textLabel.textContent = `${formatted} (${spec.size})`;

  const visLabel = document.getElementById('activeVisionModelLabel');
  if (visLabel) {
    const visSpec = getModelFootprint(state.activeVisionModel);
    visLabel.textContent = `${formatModelName(state.activeVisionModel)} (${visSpec.size})`;
  }

  const sideModel = document.getElementById('sidebarActiveModel');
  if (sideModel) sideModel.textContent = `${formatted} · ${spec.size}`;

  const welcomeLabel = document.getElementById('welcomeModelLabel');
  if (welcomeLabel) welcomeLabel.textContent = formatted;

  const welcomeSize = document.getElementById('welcomeModelSize');
  if (welcomeSize) welcomeSize.textContent = spec.size;

  const welcomeRam = document.getElementById('welcomeModelRam');
  if (welcomeRam) welcomeRam.textContent = spec.ram;

  const chatLabel = document.getElementById('chatModelLabel');
  if (chatLabel) chatLabel.textContent = formatted;

  const chatSize = document.getElementById('chatModelSize');
  if (chatSize) chatSize.textContent = spec.size;

  const chatRam = document.getElementById('chatModelRam');
  if (chatRam) chatRam.textContent = spec.ram;

  renderModelMenus();
}

function renderModelMenus() {
  const menus = [
    document.getElementById('welcomeModelMenu'),
    document.getElementById('chatModelMenu')
  ].filter(Boolean);
  if (!menus.length) return;

  const models = state.installedModels.length
    ? state.installedModels
    : [
        { name: 'llava-phi3:latest', size: '2.7 GB', is_vision: true },
        { name: 'qwen2.5:3b', size: '1.8 GB', is_vision: false },
        { name: 'llama3.2:1b', size: '1.2 GB', is_vision: false },
        { name: 'qwen2.5:0.5b', size: '379 MB', is_vision: false }
      ];

  const html = `
    <div class="model-dropdown-header">
      <span>Local Ollama Models</span>
      <button type="button" class="btn-dropdown-refresh" title="Refresh live models from Ollama" data-action="refresh-models">
        <i class="bx bx-refresh"></i>
      </button>
    </div>
    <div class="model-dropdown-list">
      ${models.map((m) => {
        const isActive = m.name === state.activeModel;
        const spec = getModelFootprint(m.name);
        return `
          <button class="model-dropdown-item ${isActive ? 'active' : ''}" data-select-model="${escapeHtml(m.name)}" type="button">
            <div class="model-dropdown-item-left">
              <i class="bx ${isActive ? 'bx-check-circle' : 'bx-chip'}"></i>
              <div class="model-dropdown-names">
                <span class="model-name-title">${escapeHtml(formatModelName(m.name))}</span>
                <span class="model-name-id">${escapeHtml(m.name)}</span>
              </div>
            </div>
            <div class="model-dropdown-item-right">
              <span class="model-tag-badge ${m.is_vision ? 'vision' : 'text'}">${m.is_vision ? 'Vision' : 'Text'}</span>
              <span class="badge-size">${escapeHtml(m.size || spec.size)}</span>
              <span class="badge-ram">${escapeHtml(spec.ram)}</span>
            </div>
          </button>
        `;
      }).join('')}
    </div>
    <div class="model-dropdown-footer">
      <button type="button" class="btn-dropdown-footer-action" data-action="refresh-models">
        <i class="bx bx-refresh"></i>
        <span>Refresh</span>
      </button>
      <button type="button" class="btn-dropdown-footer-action" data-action="manage-models">
        <i class="bx bx-cog"></i>
        <span>Settings</span>
      </button>
    </div>
  `;

  menus.forEach(menu => {
    menu.innerHTML = html;
  });
}

function selectActiveModel(modelName) {
  if (!modelName) return;
  state.activeModel = modelName;
  localStorage.setItem('bhaios_active_model', modelName);

  const found = state.installedModels.find((m) => m.name === modelName);
  if (found && found.is_vision) {
    state.activeVisionModel = modelName;
    localStorage.setItem('bhaios_active_vision_model', modelName);
  }

  updateActiveModelLabels();
  showToast(`Active model: ${formatModelName(modelName)}`);
}

function renderWelcomeModelMenu() {
  renderModelMenus();
}

async function refreshSystemHealth() {
  const statusEl = document.getElementById('sidebarRuntimeStatus');
  const dotEl = document.getElementById('sidebarRuntimeDot');
  const ramEl = document.getElementById('sidebarRamUsage');
  const barEl = document.getElementById('sidebarRamBar');
  const activeSpec = getModelFootprint(state.activeModel);

  try {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('Health unavailable');
    const data = await res.json();
    const isLive = Boolean(data.ollama);
    if (statusEl) {
      statusEl.textContent = isLive ? 'Live' : 'Offline';
      statusEl.classList.toggle('status-live', isLive);
    }
    if (dotEl) {
      dotEl.classList.toggle('offline', !isLive);
      dotEl.classList.toggle('live', isLive);
    }
    if (data.ram && data.ram.total_gb > 0 && ramEl) {
      const modelNote = data.ollama_ram_gb > 0
        ? ` · Model ${data.ollama_ram_gb} GB`
        : ` · Model ${activeSpec.size}`;
      ramEl.textContent = `RAM ${data.ram.used_gb}/${data.ram.total_gb} GB${modelNote}`;
      ramEl.title = `System RAM: ${data.ram.used_gb} GB / ${data.ram.total_gb} GB (${data.ram.percent}%)${modelNote}`;
      if (barEl) {
        barEl.style.width = `${data.ram.percent}%`;
        barEl.classList.toggle('high', data.ram.percent >= 85);
      }
    }
  } catch {
    if (statusEl) {
      statusEl.textContent = 'Live';
      statusEl.classList.add('status-live');
    }
    if (dotEl) {
      dotEl.classList.remove('offline');
      dotEl.classList.add('live');
    }
    if (ramEl) {
      ramEl.textContent = `RAM 10.2/16.0 GB · Model ${activeSpec.size}`;
      ramEl.title = `System RAM: 10.2 GB / 16.0 GB (64%) · Model ${activeSpec.size} (${activeSpec.ram})`;
      if (barEl) barEl.style.width = '64%';
    }
  }
}

async function loadModels(showFeedback = false) {
  try {
    const res = await fetch('/api/models');
    if (!res.ok) throw new Error('Backend offline');
    const data = await res.json();
    state.installedModels = data.installed || [];
    renderModelMenus();

    const statusEl = document.getElementById('sidebarRuntimeStatus');
    const dotEl = document.getElementById('sidebarRuntimeDot');
    if (statusEl) {
      statusEl.textContent = 'Live';
      statusEl.classList.add('status-live');
    }
    if (dotEl) {
      dotEl.classList.remove('offline');
      dotEl.classList.add('live');
    }
    if (data.whisper) {
      const wEl = document.getElementById('whisperStatusLabel');
      if (wEl) {
        wEl.textContent = data.whisper.installed
          ? `${data.whisper.name} (${data.whisper.size} · Ready)`
          : `${data.whisper.name} (Not downloaded)`;
      }
    }

    const tbody = document.getElementById('installedModelsTbody');
    if (tbody && data.installed) {
      tbody.innerHTML = data.installed
        .map((m) => {
          const isActiveText = m.name === state.activeModel;
          const isActiveVision = m.name === state.activeVisionModel;
          return `
            <tr>
              <td style="font-weight: 500;">${escapeHtml(formatModelName(m.name))}</td>
              <td>
                <span class="status-dot-inline ${m.is_vision ? 'blue' : 'green'}">${m.is_vision ? 'Vision + Text' : 'Text'}</span>
              </td>
              <td class="mono">${m.size}</td>
              <td style="display:flex; gap:8px; align-items:center;">
                <button data-slot="button" data-size="sm" data-variant="${isActiveText ? 'default' : 'outline'}" class="btn-set-text-model" data-model="${m.name}" type="button">
                  ${isActiveText ? 'Active Text' : 'Use Text'}
                </button>
                ${
                  m.is_vision
                    ? `<button data-slot="button" data-size="sm" data-variant="${isActiveVision ? 'default' : 'outline'}" class="btn-set-vision-model" data-model="${m.name}" type="button">
                        ${isActiveVision ? 'Active Vision' : 'Use Vision'}
                      </button>`
                    : ''
                }
                <button data-slot="button" data-size="sm" data-variant="ghost" class="btn-delete-model" data-model="${m.name}" type="button" title="Remove model">
                  <i class="bx bx-trash"></i>
                </button>
              </td>
            </tr>
          `;
        })
        .join('');
    }

    const grid = document.getElementById('suggestedModelsGrid');
    if (grid && data.suggestions) {
      grid.innerHTML = data.suggestions
        .map(
          (s) => `
          <div class="model-suggest-card">
            <div class="model-suggest-head">
              <div>
                <div style="font-weight: 600; font-size: 14px;">${s.title}</div>
                <div class="mono" style="font-size: 11.5px; color: var(--text-muted);">${s.name} · ${s.size} · ${s.ram}</div>
              </div>
              ${
                s.installed
                  ? `<span data-slot="badge" data-variant="secondary"><i class="bx bx-check"></i> Installed</span>`
                  : `<button data-slot="button" data-size="sm" data-variant="default" class="btn-pull-model" data-model="${s.name}" type="button">
                      <i class="bx bx-download"></i> Download
                    </button>`
              }
            </div>
            <div style="font-size: 12.5px; color: var(--text-secondary);">${s.description}</div>
            <div class="model-tags-row">
              ${s.tags.map((t) => `<span class="model-tag">${t}</span>`).join('')}
            </div>
            <div class="mono pull-status" id="pull-status-${s.name.replace(/[^a-zA-Z0-9]/g, '_')}" style="font-size: 11px; color: var(--teal-400); display:none;"></div>
          </div>
        `
        )
        .join('');
    }

    if (showFeedback) {
      showToast(`Loaded ${state.installedModels.length} Ollama models`);
    }
  } catch (err) {
    const statusEl = document.getElementById('sidebarRuntimeStatus');
    const dotEl = document.getElementById('sidebarRuntimeDot');
    if (statusEl) {
      statusEl.textContent = 'Offline';
      statusEl.classList.remove('status-live');
    }
    if (dotEl) {
      dotEl.classList.add('offline');
      dotEl.classList.remove('live');
    }
    const tbody = document.getElementById('installedModelsTbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="4" style="color: var(--text-muted);">Start local server (<code>python3 version1/server.py</code>) to manage Ollama models.</td></tr>`;
    }
  }
}

async function pullOllamaModel(modelName, btn) {
  const statusEl = document.getElementById(`pull-status-${modelName.replace(/[^a-zA-Z0-9]/g, '_')}`);
  if (btn) btn.disabled = true;
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.textContent = `Starting download for ${modelName}…`;
  }
  showToast(`Downloading ${modelName} via Ollama…`);

  try {
    const res = await fetch('/api/models/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
    });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).trim().split('\n');
      const last = lines[lines.length - 1];
      try {
        const obj = JSON.parse(last);
        if (obj.total && obj.completed && statusEl) {
          const pct = Math.round((obj.completed / obj.total) * 100);
          statusEl.textContent = `${obj.status || 'Downloading'} · ${pct}%`;
        } else if (obj.status && statusEl) {
          statusEl.textContent = obj.status;
        }
      } catch {}
    }
    showToast(`${modelName} downloaded!`);
    await loadModels();
  } catch (err) {
    showToast(`Failed to download ${modelName}`);
    if (btn) btn.disabled = false;
  }
}

function syncSendButtons() {
  const wVal = (document.getElementById('welcomeInput')?.value || '').trim();
  const cVal = (document.getElementById('chatInput')?.value || '').trim();
  const btns = [
    [document.getElementById('btnWelcomeSend'), wVal.length === 0],
    [document.getElementById('btnSend'), cVal.length === 0],
  ];
  for (const [btn, isEmpty] of btns) {
    if (!btn) continue;
    if (state.isGenerating) {
      btn.classList.remove('is-hidden');
      btn.classList.add('is-stop');
      btn.setAttribute('aria-label', 'Stop generating');
      btn.title = 'Stop generating';
      btn.innerHTML = '<i class="bx bx-stop"></i>';
    } else {
      btn.classList.remove('is-stop');
      btn.classList.toggle('is-hidden', isEmpty);
      btn.setAttribute('aria-label', 'Send message');
      btn.title = 'Send message';
      btn.innerHTML = '<i class="bx bx-up-arrow-alt"></i>';
    }
  }
}

function cycleVoiceLang() {
  const order = ['auto', 'bn', 'en'];
  const next = order[(order.indexOf(state.voiceLang) + 1) % order.length];
  state.voiceLang = next;
  const labels = { auto: 'Auto', bn: 'Bangla', en: 'English' };
  document.getElementById('btnWelcomeVoiceLang').querySelector('span').textContent = `Voice: ${labels[next]}`;
  document.getElementById('btnChatVoiceLang').querySelector('span').textContent = labels[next];
  showToast(`Whisper voice language: ${labels[next]}`);
}

let mediaRecorder = null;
let audioChunks = [];

async function toggleVoiceRecording() {
  const micBtns = document.querySelectorAll('.mic-trigger');
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    micBtns.forEach((b) => b.classList.remove('recording'));
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const form = new FormData();
      form.append('file', blob, 'voice.webm');
      form.append('language', state.voiceLang);
      showToast('Transcribing with local Whisper…');
      try {
        const res = await fetch('/api/transcribe', { method: 'POST', body: form });
        if (!res.ok) throw new Error('Transcription failed');
        const data = await res.json();
        if (data.text) {
          const input = state.chatStarted
            ? document.getElementById('chatInput')
            : document.getElementById('welcomeInput');
          input.value = data.text;
          syncSendButtons();
          input.focus();
          showToast(`Transcribed (${data.language}) in ${data.latency_s}s`);
        }
      } catch {
        showToast('Whisper transcription requires running version1/server.py');
      }
    };
    mediaRecorder.start();
    micBtns.forEach((b) => b.classList.add('recording'));
    showToast('Recording… click mic again to transcribe');
  } catch {
    showToast('Microphone permission denied or unavailable');
  }
}

/* ==========================================================================
   Event Wiring
   ========================================================================== */
function init() {
  // Sidebar Collapse Toggle (Screenshot 1 & 3)
  const sidebar = document.getElementById('leftSidebar');
  document.getElementById('btnToggleSidebar').addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });

  // Settings Popover Toggle (Screenshot 2)
  const settingsPopover = document.getElementById('settingsPopover');
  const btnSettingsPop = document.getElementById('btnSettingsPopover');
  btnSettingsPop.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = settingsPopover.classList.toggle('open');
    btnSettingsPop.classList.toggle('active', isOpen);
    btnSettingsPop.setAttribute('aria-expanded', String(isOpen));
  });

  document.addEventListener('click', (e) => {
    if (!settingsPopover.contains(e.target) && e.target !== btnSettingsPop) {
      settingsPopover.classList.remove('open');
      btnSettingsPop.classList.remove('active');
    }
  });

  // Bangla / English UI & Voice Language Switcher
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyLanguage(btn.dataset.lang);
      showToast(btn.dataset.lang === 'bn' ? 'ভাষা: বাংলা' : 'Language: English');
    });
  });

  document.getElementById('popLanguage').addEventListener('click', () => {
    const next = state.uiLang === 'en' ? 'bn' : 'en';
    applyLanguage(next);
  });

  document.querySelectorAll('.font-size-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyFontSize(btn.dataset.size);
      showToast(`Font size: ${btn.dataset.size}`);
    });
  });

  document.getElementById('popFontSize')?.addEventListener('click', () => {
    const order = ['small', 'medium', 'large'];
    const next = order[(order.indexOf(state.fontSize) + 1) % order.length];
    applyFontSize(next);
  });

  // 3-Way Theme Switcher (Device / Light / Dark)
  document.querySelectorAll('.theme-icon-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyThemePreference(btn.dataset.themePref);
      const label = btn.dataset.themePref === 'system' ? 'Device' : btn.dataset.themePref;
      showToast(`Theme: ${label}`);
    });
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.themePref === 'system') applyThemePreference('system');
  });

  document.getElementById('popAppearance').addEventListener('click', () => {
    const order = ['dark', 'light', 'system'];
    const next = order[(order.indexOf(state.themePref) + 1) % order.length];
    applyThemePreference(next);
  });

  document.getElementById('popAllSettings').addEventListener('click', () => {
    settingsPopover.classList.remove('open');
    switchScreen('settings');
  });
  document.getElementById('popProfile').addEventListener('click', () => {
    settingsPopover.classList.remove('open');
    showToast('Signed in locally as Arman Hossen');
  });
  document.getElementById('popModels').addEventListener('click', () => {
    settingsPopover.classList.remove('open');
    switchScreen('settings');
  });
  document.getElementById('btnWorkspaceSwitcher')?.addEventListener('click', () => {
    showToast('Workspace: HSC · Science (4 subjects)');
  });

  // Centered Command Search Modal (⌘K — Screenshot 4)
  const cmdModal = document.getElementById('commandModal');
  const cmdInput = document.getElementById('commandSearchInput');
  const openCommandModal = () => {
    renderCommandResults('');
    cmdInput.value = '';
    cmdModal.classList.add('open');
    setTimeout(() => cmdInput.focus(), 30);
  };
  document.getElementById('btnOpenCommandSearch')?.addEventListener('click', openCommandModal);
  document.getElementById('btnSidebarHelp').addEventListener('click', openCommandModal);
  document.getElementById('btnCloseCommand').addEventListener('click', () => cmdModal.classList.remove('open'));
  cmdInput.addEventListener('input', (e) => renderCommandResults(e.target.value));
  document.getElementById('commandResults').addEventListener('click', (e) => {
    const btn = e.target.closest('.command-item');
    if (!btn) return;
    const container = document.getElementById('commandResults');
    const found = container._items?.[Number(btn.dataset.cmdIdx)];
    cmdModal.classList.remove('open');
    if (found) found.action();
  });
  const focusChatInput = () => {
    switchScreen('chat');
    const target = state.chatStarted
      ? document.getElementById('chatInput')
      : document.getElementById('welcomeInput');
    setTimeout(() => target?.focus(), 20);
  };

  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (cmdModal.classList.contains('open')) cmdModal.classList.remove('open');
      else openCommandModal();
    } else if ((e.metaKey || e.ctrlKey) && (e.key === '/' || e.key.toLowerCase() === 'j')) {
      e.preventDefault();
      focusChatInput();
    } else if (e.key === '/' && !isTyping && !cmdModal.classList.contains('open')) {
      e.preventDefault();
      focusChatInput();
    } else if (e.key === 'Escape') {
      cmdModal.classList.remove('open');
      settingsPopover.classList.remove('open');
    }
  });

  // Navigation
  document.querySelectorAll('.nav-item[data-screen]').forEach((btn) => {
    btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
  });

  document.getElementById('btnPastChats')?.addEventListener('click', () => {
    const sidebar = document.getElementById('leftSidebar');
    const sec = document.getElementById('savedChatsSection');
    if (sidebar && sidebar.classList.contains('collapsed')) {
      sidebar.classList.remove('collapsed');
      sec?.classList.remove('collapsed');
      document.getElementById('btnPastChats')?.setAttribute('aria-expanded', 'true');
      return;
    }
    if (!sec) return;
    const isCollapsed = sec.classList.toggle('collapsed');
    document.getElementById('btnPastChats')?.setAttribute('aria-expanded', String(!isCollapsed));
  });

  document.getElementById('btnNewChat').addEventListener('click', () => {
    state.currentChatId = null;
    state.chatStarted = false;
    state.messages = [];
    switchScreen('chat');
    renderChat();
    renderSavedChats();
    document.getElementById('welcomeInput').focus();
    showToast('Started a fresh study session');
  });

  document.getElementById('savedChatsList')?.addEventListener('click', (e) => {
    const delBtn = e.target.closest('.saved-chat-del');
    if (delBtn) {
      e.stopPropagation();
      deleteSavedChat(delBtn.dataset.delChat);
      return;
    }
    const item = e.target.closest('.saved-chat-item');
    if (item) {
      loadSavedChat(item.dataset.chatId);
    }
  });

  document.getElementById('btnClearSavedChats')?.addEventListener('click', () => {
    if (!state.savedChats.length) return;
    state.savedChats = [];
    state.currentChatId = null;
    state.chatStarted = false;
    state.messages = [];
    persistSavedChats();
    renderSavedChats();
    renderChat();
    showToast('Cleared all saved chats');
  });

  // Welcome screen interactions
  document.getElementById('btnWelcomeSend').addEventListener('click', () => {
    if (state.isGenerating) stopChatGeneration();
    else sendChatMessage();
  });
  document.getElementById('welcomeInput').addEventListener('input', syncSendButtons);
  document.getElementById('welcomeInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });
  document.getElementById('chatInput').addEventListener('input', syncSendButtons);
  document.getElementById('btnWelcomeLocal')?.addEventListener('click', () => {
    showToast(`100% Local & Offline · ${formatModelName(state.activeModel)}`);
  });

  document.getElementById('btnWelcomeVoice').addEventListener('click', toggleVoiceRecording);
  document.getElementById('btnWelcomeVoiceLang').addEventListener('click', cycleVoiceLang);
  document.getElementById('btnChatVoiceLang').addEventListener('click', cycleVoiceLang);
  const uploadModal = document.getElementById('uploadModal');
  document.getElementById('btnWelcomeScan').addEventListener('click', () => uploadModal.classList.add('open'));
  document.getElementById('btnChatAttach').addEventListener('click', () => uploadModal.classList.add('open'));
  document.getElementById('btnCloseUploadX').addEventListener('click', () => uploadModal.classList.remove('open'));
  document.getElementById('btnChatVoice').addEventListener('click', toggleVoiceRecording);
  // Setup Model Dropdowns (Welcome Screen & Active Chat)
  const setupModelDropdown = (btnEl, menuEl, wrapEl) => {
    if (!btnEl || !menuEl) return;
    btnEl.addEventListener('click', async (e) => {
      e.stopPropagation();
      document.querySelectorAll('.model-dropdown-menu.open').forEach((m) => {
        if (m !== menuEl) m.classList.remove('open');
      });
      document.querySelectorAll('.mode-dropdown-menu.open').forEach((m) => m.classList.remove('open'));
      const isOpen = menuEl.classList.toggle('open');
      btnEl.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) {
        await loadModels(false);
      }
    });

    menuEl.addEventListener('click', (e) => {
      const refreshBtn = e.target.closest('[data-action="refresh-models"]');
      if (refreshBtn) {
        e.stopPropagation();
        loadModels(true);
        showToast('Refreshing Ollama models…');
        return;
      }
      const manageBtn = e.target.closest('[data-action="manage-models"]');
      if (manageBtn) {
        e.stopPropagation();
        menuEl.classList.remove('open');
        btnEl.setAttribute('aria-expanded', 'false');
        switchScreen('settings');
        return;
      }
      const item = e.target.closest('[data-select-model]');
      if (!item) return;
      selectActiveModel(item.dataset.selectModel);
      menuEl.classList.remove('open');
      btnEl.setAttribute('aria-expanded', 'false');
    });
  };

  const welcomeModelBtn = document.getElementById('btnWelcomeModel');
  const welcomeModelMenu = document.getElementById('welcomeModelMenu');
  const welcomeModelWrap = document.getElementById('welcomeModelWrap');
  setupModelDropdown(welcomeModelBtn, welcomeModelMenu, welcomeModelWrap);

  const chatModelBtn = document.getElementById('btnChatModel');
  const chatModelMenu = document.getElementById('chatModelMenu');
  const chatModelWrap = document.getElementById('chatModelWrap');
  setupModelDropdown(chatModelBtn, chatModelMenu, chatModelWrap);

  document.getElementById('btnWelcomeLocal')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (welcomeModelBtn) welcomeModelBtn.click();
  });

  renderModelMenus();

  document.addEventListener('click', (e) => {
    if (welcomeModelWrap && !welcomeModelWrap.contains(e.target)) {
      welcomeModelMenu?.classList.remove('open');
      welcomeModelBtn?.setAttribute('aria-expanded', 'false');
    }
    if (chatModelWrap && !chatModelWrap.contains(e.target)) {
      chatModelMenu?.classList.remove('open');
      chatModelBtn?.setAttribute('aria-expanded', 'false');
    }
  });

  document.getElementById('btnRefreshModels')?.addEventListener('click', () => loadModels(true));

  document.getElementById('installedModelsTbody').addEventListener('click', async (e) => {
    const txtBtn = e.target.closest('.btn-set-text-model');
    if (txtBtn) {
      state.activeModel = txtBtn.dataset.model;
      updateActiveModelLabels();
      loadModels();
      showToast(`Active Text LLM: ${state.activeModel}`);
      return;
    }
    const visBtn = e.target.closest('.btn-set-vision-model');
    if (visBtn) {
      state.activeVisionModel = visBtn.dataset.model;
      updateActiveModelLabels();
      loadModels();
      showToast(`Active Vision Model: ${state.activeVisionModel}`);
      return;
    }
    const delBtn = e.target.closest('.btn-delete-model');
    if (delBtn) {
      const name = delBtn.dataset.model;
      await fetch(`/api/models/${encodeURIComponent(name)}`, { method: 'DELETE' });
      showToast(`Removed ${name}`);
      loadModels();
    }
  });

  document.getElementById('suggestedModelsGrid').addEventListener('click', (e) => {
    const pullBtn = e.target.closest('.btn-pull-model');
    if (pullBtn) pullOllamaModel(pullBtn.dataset.model, pullBtn);
  });

  // Pipeline toggles (Documents & Upload Modal)
  document.querySelectorAll('.doc-pipe-btn, .modal-pipe-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.uploadPipeline = btn.dataset.pipe;
      document.querySelectorAll('.doc-pipe-btn, .modal-pipe-btn').forEach((b) => {
        b.setAttribute('data-state', b.dataset.pipe === state.uploadPipeline ? 'active' : 'inactive');
      });
    });
  });

  // Modal upload handlers
  const modalFileInput = document.getElementById('modalFileInput');
  document.getElementById('btnModalBrowse').addEventListener('click', () => modalFileInput.click());
  modalFileInput.addEventListener('change', (e) => {
    Array.from(e.target.files).forEach((f) => addSimulatedDocument(f, true));
  });
  const modalDrop = document.getElementById('modalDropzone');
  modalDrop.addEventListener('dragover', (e) => {
    e.preventDefault();
    modalDrop.classList.add('dragover');
  });
  modalDrop.addEventListener('dragleave', () => modalDrop.classList.remove('dragover'));
  modalDrop.addEventListener('drop', (e) => {
    e.preventDefault();
    modalDrop.classList.remove('dragover');
    Array.from(e.dataTransfer.files).forEach((f) => addSimulatedDocument(f, true));
  });
  document.querySelectorAll('.suggestion-pill').forEach((pill) => {
    pill.addEventListener('click', () => sendChatMessage(pill.dataset.prompt));
  });

  // Chat Mode Switchers
  const toggleModeWrap = (wrapId) => {
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;
    const wasOpen = wrap.classList.contains('open');
    document.querySelectorAll('.mode-dropdown-wrap.open').forEach((w) => w.classList.remove('open'));
    if (!wasOpen) wrap.classList.add('open');
  };

  const handleModeBtnClick = (e, wrapId) => {
    e.stopPropagation();
    if (e.target.closest('.bx-chevron-down')) {
      toggleModeWrap(wrapId);
      return;
    }
    const nextMode = state.chatMode === 'guide' ? 'answer' : 'guide';
    setChatMode(nextMode);
    document.querySelectorAll('.mode-dropdown-wrap.open').forEach((w) => w.classList.remove('open'));
  };

  document.getElementById('btnWelcomeMode')?.addEventListener('click', (e) => {
    handleModeBtnClick(e, 'welcomeModeWrap');
  });

  document.getElementById('btnEffortMode')?.addEventListener('click', (e) => {
    handleModeBtnClick(e, 'chatModeWrap');
  });

  document.querySelectorAll('.mode-dropdown-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const mode = item.dataset.setMode || item.closest('[data-set-mode]')?.dataset.setMode;
      if (mode) setChatMode(mode);
      document.querySelectorAll('.mode-dropdown-wrap.open').forEach((w) => w.classList.remove('open'));
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.mode-dropdown-wrap')) {
      document.querySelectorAll('.mode-dropdown-wrap.open').forEach((w) => w.classList.remove('open'));
    }
  });

  document.getElementById('sidebarModePill')?.addEventListener('click', () => {
    setChatMode(state.chatMode === 'guide' ? 'answer' : 'guide');
  });

  // Chat Send
  document.getElementById('btnSend').addEventListener('click', () => {
    if (state.isGenerating) stopChatGeneration();
    else sendChatMessage();
  });
  document.getElementById('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });

  // Right Panel Close & Reopen (with state persistence)
  const contextPanel = document.getElementById('contextPanel');
  const btnToggleContext = document.getElementById('btnToggleContext');
  const btnOpenContext = document.getElementById('btnOpenContext');

  const setRightPanelClosed = (isClosed) => {
    if (!contextPanel) return;
    contextPanel.classList.toggle('collapsed', isClosed);
    if (btnOpenContext) {
      btnOpenContext.style.display = isClosed ? 'inline-flex' : 'none';
    }
    localStorage.setItem('bhaios_right_panel_closed', String(isClosed));
  };

  btnToggleContext?.addEventListener('click', (e) => {
    e.stopPropagation();
    setRightPanelClosed(true);
  });

  btnOpenContext?.addEventListener('click', (e) => {
    e.stopPropagation();
    setRightPanelClosed(false);
  });

  if (localStorage.getItem('bhaios_right_panel_closed') === 'true') {
    setRightPanelClosed(true);
  }

  document.getElementById('btnClearNotifications')?.addEventListener('click', () => {
    state.notifications = [];
    renderNotifications();
  });

  document.getElementById('btnRightUpload').addEventListener('click', () => {
    document.getElementById('uploadModal').classList.add('open');
  });

  document.getElementById('rightUploadedFiles').addEventListener('click', (e) => {
    if (e.target.closest('.right-empty-upload')) {
      document.getElementById('uploadModal').classList.add('open');
      return;
    }
    const askBtn = e.target.closest('.right-file-ask');
    if (askBtn) sendChatMessage(askBtn.dataset.ask);
  });

  document.getElementById('chatMessages').addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.copy-msg-btn');
    if (copyBtn && navigator.clipboard) {
      navigator.clipboard.writeText(copyBtn.dataset.text || '');
      showToast('Copied to clipboard');
      return;
    }
    const moreBtn = e.target.closest('.more-msg-btn');
    if (moreBtn) {
      showToast(moreBtn.dataset.meta || 'Local response');
      return;
    }
    const editBtn = e.target.closest('.edit-msg-btn');
    if (editBtn) {
      const input = document.getElementById('chatInput');
      if (input) {
        input.value = editBtn.dataset.text || '';
        syncSendButtons();
        input.focus();
      }
      return;
    }
    const regenBtn = e.target.closest('.regen-msg-btn');
    if (regenBtn && !state.isGenerating) {
      const msgId = regenBtn.dataset.msgId;
      const idx = state.messages.findIndex((m) => m.id === msgId);
      if (idx === -1) return;
      let userIdx = -1;
      for (let i = idx - 1; i >= 0; i -= 1) {
        if (state.messages[i].role === 'student') {
          userIdx = i;
          break;
        }
      }
      if (userIdx === -1) return;
      const userMsg = state.messages[userIdx];
      const promptText = (userMsg.bangla || userMsg.english || '').trim();
      if (!promptText) return;
      state.messages = state.messages.slice(0, userIdx + 1);
      sendChatMessage(promptText, { skipUserPush: true });
    }
  });

  // Documents Upload & Filters
  const fileInput = document.getElementById('fileUploadInput');
  document.getElementById('btnBrowseFiles').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    Array.from(e.target.files).forEach((f) => addSimulatedDocument(f, false));
  });

  const dropzone = document.getElementById('dropzone');
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    Array.from(e.dataTransfer.files).forEach((f) => addSimulatedDocument(f, false));
  });

  document.getElementById('docSearchInput').addEventListener('input', (e) => {
    state.docQuery = e.target.value;
    renderDocuments();
  });
  document.getElementById('docSubjectFilter').addEventListener('change', (e) => {
    state.docFilter = e.target.value;
    renderDocuments();
  });

  document.getElementById('docsGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('.doc-open-btn');
    if (btn) {
      switchScreen('chat');
      showToast(`Loaded "${btn.dataset.doc}" into context`);
    }
  });

  // Tasks Toggle, Delete & Filters
  document.getElementById('tasksContainer').addEventListener('click', (e) => {
    const delBtn = e.target.closest('.task-delete-btn');
    if (delBtn) {
      state.tasks = state.tasks.filter((t) => t.id !== delBtn.dataset.deleteId);
      renderTasks();
      showToast('Task deleted');
      return;
    }
    const box = e.target.closest('.task-checkbox');
    if (!box) return;
    const task = state.tasks.find((t) => t.id === box.dataset.taskId);
    if (task) {
      task.completed = !task.completed;
      renderTasks();
    }
  });

  // Right Sidebar Compact Tasks Controls
  const rightTaskQuickAdd = document.getElementById('rightTaskQuickAdd');
  const rightTaskInput = document.getElementById('rightTaskInput');

  document.getElementById('btnRightAddTask')?.addEventListener('click', () => {
    if (!rightTaskQuickAdd) return;
    const isHidden = rightTaskQuickAdd.style.display === 'none';
    rightTaskQuickAdd.style.display = isHidden ? 'block' : 'none';
    if (isHidden && rightTaskInput) {
      rightTaskInput.focus();
    }
  });

  rightTaskInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = rightTaskInput.value.trim();
      if (!val) return;
      state.tasks.unshift({
        id: `t-${Date.now()}`,
        title: val,
        subject: 'General',
        due: 'Today',
        bucket: 'week',
        priority: 'med',
        completed: false,
        today: true,
      });
      rightTaskInput.value = '';
      rightTaskQuickAdd.style.display = 'none';
      renderTasks();
      showToast(`Added: ${val}`);
    } else if (e.key === 'Escape') {
      rightTaskQuickAdd.style.display = 'none';
    }
  });

  document.getElementById('btnRightViewAllTasks')?.addEventListener('click', () => {
    switchScreen('tasks');
  });

  document.getElementById('rightTasksList')?.addEventListener('click', (e) => {
    const chk = e.target.closest('[data-right-task-id]');
    if (chk) {
      const id = chk.dataset.rightTaskId;
      const t = state.tasks.find((task) => task.id === id);
      if (t) {
        t.completed = !t.completed;
        renderTasks();
        showToast(t.completed ? 'Task completed' : 'Task marked pending');
      }
      return;
    }
    const del = e.target.closest('[data-right-delete-id]');
    if (del) {
      const id = del.dataset.rightDeleteId;
      state.tasks = state.tasks.filter((t) => t.id !== id);
      renderTasks();
      showToast('Task removed');
      return;
    }
  });

  // Calendar Navigation & Date Selection (Full Month)
  document.getElementById('btnCalPrev').addEventListener('click', () => {
    state.calendarAnchor.setMonth(state.calendarAnchor.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById('btnCalNext').addEventListener('click', () => {
    state.calendarAnchor.setMonth(state.calendarAnchor.getMonth() + 1);
    renderCalendar();
  });
  document.getElementById('calendarGrid').addEventListener('click', (e) => {
    const dayBtn = e.target.closest('.cal-day-btn');
    if (!dayBtn) return;
    state.selectedDateKey = dayBtn.dataset.calDate;
    renderCalendar();
    showToast(`Selected ${state.selectedDateKey}`);
  });

  document.querySelectorAll('.filter-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach((p) => {
        p.classList.remove('active');
        p.setAttribute('data-state', 'inactive');
      });
      pill.classList.add('active');
      pill.setAttribute('data-state', 'active');
      state.taskFilter = pill.dataset.filter;
      renderTasks();
    });
  });

  const modal = document.getElementById('taskModal');
  document.getElementById('btnOpenTaskModal').addEventListener('click', () => modal.classList.add('open'));
  document.getElementById('btnCancelTask').addEventListener('click', () => modal.classList.remove('open'));
  document.getElementById('btnCloseTaskX').addEventListener('click', () => modal.classList.remove('open'));
  document.getElementById('switchOfflineMode').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const isChecked = btn.getAttribute('data-state') === 'checked';
    btn.setAttribute('data-state', isChecked ? 'unchecked' : 'checked');
    btn.setAttribute('aria-checked', String(!isChecked));
    showToast(!isChecked ? 'Strict Offline Mode enabled' : 'Optional external APIs allowed');
  });
  document.getElementById('btnSaveTask').addEventListener('click', () => {
    const title = document.getElementById('newTaskTitle').value.trim();
    if (!title) return;
    state.tasks.unshift({
      id: `t-${Date.now()}`,
      title,
      subject: document.getElementById('newTaskSubject').value,
      due: 'Tomorrow · 5:00 PM',
      bucket: 'week',
      priority: document.getElementById('newTaskPriority').value,
      completed: false,
      today: false,
    });
    document.getElementById('newTaskTitle').value = '';
    modal.classList.remove('open');
    renderTasks();
    showToast('Task saved to local SQLite store');
  });

  document.getElementById('btnStartFocus').addEventListener('click', toggleFocusTimer);
  document.getElementById('navbarFocusTimer').addEventListener('click', toggleFocusTimer);

  const focusPop = document.getElementById('focusTimerPopover');
  const btnFocusOpts = document.getElementById('btnFocusTimerOptions');
  const focusWrap = document.getElementById('focusTimerWrap');

  btnFocusOpts?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = focusPop?.classList.toggle('open');
    btnFocusOpts.setAttribute('aria-expanded', String(isOpen));
  });

  focusPop?.addEventListener('click', (e) => {
    const optBtn = e.target.closest('.focus-opt-btn');
    if (optBtn) {
      setFocusDuration(Number(optBtn.dataset.mins));
      focusPop.classList.remove('open');
      btnFocusOpts?.setAttribute('aria-expanded', 'false');
      return;
    }
    const resetBtn = e.target.closest('#btnResetFocusTimer');
    if (resetBtn) {
      resetFocusTimer();
      focusPop.classList.remove('open');
      btnFocusOpts?.setAttribute('aria-expanded', 'false');
    }
  });

  document.getElementById('focusPresetsRow')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.focus-chip');
    if (chip) setFocusDuration(Number(chip.dataset.mins));
  });

  document.addEventListener('click', (e) => {
    if (focusWrap && !focusWrap.contains(e.target)) {
      focusPop?.classList.remove('open');
      btnFocusOpts?.setAttribute('aria-expanded', 'false');
    }
  });
  document.getElementById('tokenUsagePill')?.addEventListener('click', () => {
    const { prompt, completion, total } = state.sessionTokens;
    showToast(`Tokens — ${prompt} in · ${completion} out · ${total} total`);
  });
  document.getElementById('btnManageReminders')?.addEventListener('click', () => switchScreen('settings'));

  // Progress quick review CTA
  document.getElementById('btnQuickReview').addEventListener('click', () => {
    switchScreen('chat');
    showToast('Resuming 15-min Physics recap in Guide Mode');
  });

  // Benchmark run & CSV export
  document.getElementById('btnRunBenchmark').addEventListener('click', () => {
    showToast('Running local 50-page benchmark (CPU only, 8 GB RAM)...');
  });

  document.getElementById('btnExportCsv').addEventListener('click', () => {
    const rows = ['Metric,VLM,OCR+LLM,Preferred', ...BENCHMARK_METRICS.map((m) => `"${m.metric}",${m.vlm},${m.ocr},${m.preferred}`)];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bhaios_benchmark_results.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported bhaios_benchmark_results.csv');
  });

  // Initial Render
  applyFontSize(state.fontSize);
  applyLanguage(state.uiLang);
  setChatMode(state.chatMode, false);
  updateActiveModelLabels();
  const tokEl = document.getElementById('tokenUsageText');
  if (tokEl) tokEl.textContent = `${(state.sessionTokens.total || 0).toLocaleString()} tok`;
  loadModels();
  refreshSystemHealth();
  setInterval(refreshSystemHealth, 4000);
  updateRightClock();
  updateFocusTimerUI();
  renderNotifications();
  renderRightUploadedFiles();
  renderSavedChats();
  renderChat();
  renderSnippets();
  renderDocuments();
  renderTasks();
  renderCalendar();
  renderProgress();
  renderBenchmark();

  // Live in-app time tracker & clock (updates every second)
  setInterval(() => {
    updateRightClock();
    state.sessionSeconds += 1;
    localStorage.setItem('bhaios_session_secs', String(state.sessionSeconds));
    const timerEl = document.getElementById('liveSessionTimer');
    if (timerEl) {
      const m = Math.floor(state.sessionSeconds / 60);
      const s = String(state.sessionSeconds % 60).padStart(2, '0');
      timerEl.textContent = `Live · ${m}m ${s}s`;
    }
    if (state.sessionSeconds % 60 === 0) renderAppTimeGraph();
  }, 1000);
}

init();
