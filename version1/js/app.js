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

const state = {
  screen: 'chat',
  chatMode: 'guide', // 'guide' | 'answer'
  themePref: 'dark', // 'system' | 'light' | 'dark'
  voiceLang: 'auto', // 'auto' | 'bn' | 'en'
  sessionSeconds: Number(localStorage.getItem('bhaios_session_secs') || 0),
  uploadPipeline: 'VLM',
  activeModel: 'qwen2.5:3b',
  activeVisionModel: 'llava-phi3:latest',
  attachedImageBase64: null,
  attachedFilename: null,
  chatStarted: false,
  messages: [...INITIAL_MESSAGES],
  documents: [...DOCUMENTS_DATA],
  tasks: [...INITIAL_TASKS],
  taskFilter: 'all',
  docFilter: 'All',
  docQuery: '',
  snippetQuery: "Newton's second law",
  highlightedSnippet: null,
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
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2400);
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

  // Update Top Bar
  document.getElementById('topBarTitle').textContent = SCREEN_TITLES[screenName] || 'BhaiOS';
  const showChatControls = screenName === 'chat';
  document.getElementById('chatModeSwitch').style.display = showChatControls ? 'inline-flex' : 'none';
  document.getElementById('latencyChip').style.display = showChatControls ? 'inline-flex' : 'none';
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
          <button class="msg-action-btn edit-msg-btn" type="button" title="Edit"><i class="bx bx-pencil"></i></button>
        </div>
      `;
      container.appendChild(group);
    } else if (msg.role === 'assistant' || msg.role === 'assistant-inline') {
      const group = document.createElement('div');
      group.className = 'msg-assistant-group';
      const paragraphs = [msg.bangla, msg.english].filter(Boolean);
      const copyText = paragraphs.join('\n\n').replace(/"/g, '&quot;');
      group.innerHTML = `
        <div class="msg-assistant-prose ${msg.bangla ? 'bangla' : ''}">
          ${paragraphs.map((p) => `<p>${p}</p>`).join('')}
        </div>
        <div class="msg-assistant-meta">
          <div class="msg-actions" style="padding: 0;">
            <button class="msg-action-btn copy-msg-btn" data-text="${copyText}" type="button" title="Copy"><i class="bx bx-copy"></i></button>
            <button class="msg-action-btn regen-msg-btn" type="button" title="Regenerate"><i class="bx bx-refresh"></i></button>
            <button class="msg-action-btn" type="button" title="More"><i class="bx bx-dots-horizontal-rounded"></i></button>
          </div>
          ${msg.hintChip ? `<span class="hint-chip">${msg.hintChip}</span>` : ''}
          ${msg.sourceId ? `<button class="link-source" data-source="${msg.sourceId}" type="button">Show source <i class="bx bx-link-external"></i></button>` : ''}
        </div>
      `;
      container.appendChild(group);
    }
  });

  container.scrollTop = container.scrollHeight;
}

function renderSnippets() {
  const list = document.getElementById('snippetsList');
  const q = state.snippetQuery.trim().toLowerCase();
  const filtered = RETRIEVED_SNIPPETS.filter(
    (s) =>
      !q ||
      s.title.toLowerCase().includes(q) ||
      s.body.toLowerCase().includes(q) ||
      s.index.toLowerCase().includes(q) ||
      q.includes('newton')
  );

  document.getElementById('snippetCountLabel').textContent = `${filtered.length} snippets from your documents`;
  list.innerHTML = filtered
    .map(
      (s) => `
      <div class="snippet-card ${state.highlightedSnippet === s.id ? 'highlighted' : ''}" id="snippet-${s.id}">
        <div class="snippet-top">
          <span class="snippet-index">${s.index}</span>
          <span class="snippet-badge ${s.isBangla ? 'note' : 'pdf'}">${s.isBangla ? 'VLM Note' : 'PDF'}</span>
        </div>
        <div class="snippet-title ${s.isBangla ? 'bangla' : ''}">${s.title}</div>
        <div class="snippet-body ${s.isBangla ? 'bangla' : ''}">${s.body}</div>
        <div class="snippet-footer">
          <span class="snippet-source"><i class="bx ${s.isBangla ? 'bx-image' : 'bx-file'}"></i> ${s.source}</span>
          <button class="snippet-ask-btn" data-ask="Explain ${s.title} from ${s.source}" type="button">Ask <i class="bx bx-right-arrow-alt"></i></button>
        </div>
      </div>
    `
    )
    .join('');
}

function setChatMode(mode) {
  state.chatMode = mode;
  const gBtn = document.getElementById('btnModeGuide');
  const aBtn = document.getElementById('btnModeAnswer');
  gBtn.className = `mode-btn ${mode === 'guide' ? 'active-guide' : ''}`;
  aBtn.className = `mode-btn ${mode === 'answer' ? 'active-answer' : ''}`;
  document.getElementById('sidebarModeLabel').textContent =
    mode === 'guide' ? 'Guide Mode is on' : 'Answer Mode is on';
  const effortLabel = document.getElementById('effortLabel');
  if (effortLabel) effortLabel.textContent = mode === 'guide' ? 'Guide Mode' : 'Answer Mode';
}

async function sendChatMessage(customText) {
  const input = document.getElementById('chatInput');
  const welcomeInput = document.getElementById('welcomeInput');
  const text = (customText ?? (state.chatStarted ? input.value : welcomeInput.value)).trim();
  if (!text) return;

  if (!state.chatStarted) {
    state.chatStarted = true;
    state.messages = [];
  }

  const hasBangla = /[\u0980-\u09FF]/.test(text);
  state.messages.push({
    id: `m-${Date.now()}`,
    role: 'student',
    bangla: hasBangla ? text : '',
    english: hasBangla ? '' : text,
  });

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
        hintChip: data.used_vision
          ? `VLM · ${data.model_used} · ${data.latency_s}s`
          : `${data.model_used} · ${data.latency_s}s`,
        sourceId: 's2',
      };
    }
    document.getElementById('latencyChip').textContent = `${data.latency_s}s / resp`;
    state.attachedImageBase64 = null;
    state.attachedFilename = null;
  } catch (err) {
    const idx = state.messages.findIndex((m) => m.id === pendingId);
    if (idx !== -1) {
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

  document.getElementById('navDocCount').textContent = String(state.documents.length + 6);
  document.getElementById('docsShowingLabel').textContent = `Showing ${list.length} of ${state.documents.length + 6} documents`;

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
  const activeCount = state.tasks.filter((t) => !t.completed).length;
  document.getElementById('navTaskCount').textContent = String(activeCount);
  document.getElementById('pillAllCount').textContent = String(state.tasks.length);

  const filtered = state.tasks.filter((t) => {
    if (state.taskFilter === 'today') return t.today && !t.completed;
    if (state.taskFilter === 'completed') return t.completed;
    return true;
  });

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
                  <span class="priority-dot priority-${t.priority}">${t.priority}</span>
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

/* ==========================================================================
   Progress & Benchmark Screens
   ========================================================================== */
function renderProgress() {
  const rhythm = document.getElementById('rhythmBars');
  rhythm.innerHTML = STUDY_RHYTHM.map(
    (d) => `
      <div class="rhythm-col">
        <span class="rhythm-val">${d.mins}</span>
        <div class="rhythm-bar ${d.active ? 'active' : ''}" style="height: ${Math.max(4, d.mins * 1.1)}px"></div>
        <span class="rhythm-day">${d.day}</span>
      </div>
    `
  ).join('');

  const focus = document.getElementById('focusBars');
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

  renderHeatmap();
  renderAppTimeGraph();
}

function renderHeatmap() {
  const grid = document.getElementById('studyHeatmap');
  const info = document.getElementById('heatmapHoverInfo');
  if (!grid) return;

  const days = 112; // 16 weeks * 7 days
  const today = new Date();
  let totalHours = 0;
  const cells = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    // Deterministic realistic study hours
    const seed = (d.getDate() * 13 + d.getMonth() * 7 + i * 3) % 11;
    const hours = i === 0 ? 1.5 : seed < 3 ? 0 : seed < 6 ? 0.8 : seed < 8 ? 1.6 : seed < 10 ? 2.5 : 3.6;
    totalHours += hours;
    const level = hours === 0 ? 0 : hours < 1 ? 1 : hours < 2 ? 2 : hours < 3 ? 3 : 4;
    const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    cells.push(`<div class="heatmap-cell level-${level}" data-info="${label} · ${hours.toFixed(1)} hrs studied"></div>`);
  }

  grid.innerHTML = cells.join('');
  document.getElementById('heatmapTotalHours').textContent = `${totalHours.toFixed(1)} hrs total`;

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

  const extraMins = Math.floor(state.sessionSeconds / 60);
  const thisWeek = [42, 68, 35, 92, 54, 78, 65 + extraMins];
  const lastWeek = [38, 52, 48, 64, 40, 62, 55];
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

const COMMAND_ITEMS = [
  { group: 'Last opened', icon: 'bx-message-square-detail', label: "Newton's second law · Physics", action: () => sendChatMessage('নিউটনের দ্বিতীয় সূত্রটা সহজ করে বুঝিয়ে দাও।') },
  { group: 'Last opened', icon: 'bx-file', label: 'Physics · Chapter 03 notes', action: () => switchScreen('documents') },
  { group: 'Recent chats', icon: 'bx-message-square-detail', label: 'Explain differentiation chain rule', action: () => sendChatMessage('Explain differentiation chain rule step by step') },
  { group: 'Recent chats', icon: 'bx-message-square-detail', label: 'Summarize Organic chemistry flashcards', action: () => sendChatMessage('Summarize Organic chemistry flashcards') },
  { group: 'Recent chats', icon: 'bx-list-ul', label: "Revise Newton's laws (Overdue task)", action: () => switchScreen('tasks') },
  { group: 'Recent chats', icon: 'bx-test-tube', label: 'VLM vs OCR+LLM Benchmark results', action: () => switchScreen('benchmark') },
];

function renderCommandResults(query = '') {
  const container = document.getElementById('commandResults');
  const q = query.trim().toLowerCase();
  const filtered = COMMAND_ITEMS.filter((item) => !q || item.label.toLowerCase().includes(q));
  const groups = ['Last opened', 'Recent chats'];

  container.innerHTML = groups
    .map((g) => {
      const items = filtered.filter((i) => i.group === g);
      if (!items.length) return '';
      return `
        <div class="command-group-label">${g}</div>
        ${items
          .map(
            (item, idx) => `
          <button class="command-item ${g === 'Last opened' && idx === 0 ? 'active' : ''}" data-cmd-label="${item.label.replace(/"/g, '&quot;')}" type="button">
            <i class="bx ${item.icon}"></i>
            <span>${item.label}</span>
          </button>
        `
          )
          .join('')}
      `;
    })
    .join('');

  if (!filtered.length) {
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">No matching chats or notes</div>';
  }
}

/* ==========================================================================
   Model Manager & Whisper Voice Input
   ========================================================================== */
function updateActiveModelLabels() {
  document.getElementById('activeTextModelLabel').textContent = state.activeModel;
  document.getElementById('activeVisionModelLabel').textContent = state.activeVisionModel;
  document.getElementById('sidebarActiveModel').textContent = state.activeModel;
  const welcomeModelBtn = document.getElementById('btnWelcomeModel');
  if (welcomeModelBtn) {
    welcomeModelBtn.querySelector('span').textContent = state.activeModel;
  }
}

async function loadModels() {
  const tbody = document.getElementById('installedModelsTbody');
  const grid = document.getElementById('suggestedModelsGrid');
  if (!tbody || !grid) return;

  try {
    const res = await fetch('/api/models');
    if (!res.ok) throw new Error('Backend offline');
    const data = await res.json();

    document.getElementById('sidebarRuntimeStatus').textContent = 'Ollama Live';
    if (data.whisper) {
      document.getElementById('whisperStatusLabel').textContent = data.whisper.installed
        ? `${data.whisper.name} (${data.whisper.size} · Ready)`
        : `${data.whisper.name} (Not downloaded)`;
    }

    tbody.innerHTML = data.installed
      .map((m) => {
        const isActiveText = m.name === state.activeModel;
        const isActiveVision = m.name === state.activeVisionModel;
        return `
          <tr>
            <td style="font-weight: 500;">${m.name}</td>
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
  } catch {
    document.getElementById('sidebarRuntimeStatus').textContent = 'Demo Mode';
    tbody.innerHTML = `<tr><td colspan="4" style="color: var(--text-muted);">Start local server (<code>python3 version1/server.py</code>) to manage Ollama models.</td></tr>`;
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
  document.getElementById('btnWelcomeSend')?.classList.toggle('is-hidden', wVal.length === 0);
  document.getElementById('btnSend')?.classList.toggle('is-hidden', cVal.length === 0);
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
  document.getElementById('btnWorkspaceSwitcher').addEventListener('click', () => {
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
  document.getElementById('btnOpenCommandSearch').addEventListener('click', openCommandModal);
  document.getElementById('btnSidebarHelp').addEventListener('click', openCommandModal);
  document.getElementById('btnCloseCommand').addEventListener('click', () => cmdModal.classList.remove('open'));
  cmdInput.addEventListener('input', (e) => renderCommandResults(e.target.value));
  document.getElementById('commandResults').addEventListener('click', (e) => {
    const btn = e.target.closest('.command-item');
    if (!btn) return;
    const found = COMMAND_ITEMS.find((i) => i.label === btn.dataset.cmdLabel);
    cmdModal.classList.remove('open');
    if (found) found.action();
  });
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (cmdModal.classList.contains('open')) cmdModal.classList.remove('open');
      else openCommandModal();
    } else if (e.key === 'Escape') {
      cmdModal.classList.remove('open');
      settingsPopover.classList.remove('open');
    }
  });

  // Navigation
  document.querySelectorAll('.nav-item[data-screen]').forEach((btn) => {
    btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
  });

  document.getElementById('btnNewChat').addEventListener('click', () => {
    state.chatStarted = false;
    switchScreen('chat');
    renderChat();
    document.getElementById('welcomeInput').focus();
    showToast('Started a fresh study session');
  });

  // Welcome screen interactions
  document.getElementById('btnWelcomeSend').addEventListener('click', () => sendChatMessage());
  document.getElementById('welcomeInput').addEventListener('input', syncSendButtons);
  document.getElementById('welcomeInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });
  document.getElementById('chatInput').addEventListener('input', syncSendButtons);
  document.getElementById('btnWelcomeVoice').addEventListener('click', toggleVoiceRecording);
  document.getElementById('btnWelcomeVoiceLang').addEventListener('click', cycleVoiceLang);
  document.getElementById('btnChatVoiceLang').addEventListener('click', cycleVoiceLang);
  const uploadModal = document.getElementById('uploadModal');
  document.getElementById('btnWelcomeScan').addEventListener('click', () => uploadModal.classList.add('open'));
  document.getElementById('btnChatAttach').addEventListener('click', () => uploadModal.classList.add('open'));
  document.getElementById('btnCloseUploadX').addEventListener('click', () => uploadModal.classList.remove('open'));
  document.getElementById('btnChatVoice').addEventListener('click', toggleVoiceRecording);
  document.getElementById('btnWelcomeModel').addEventListener('click', () => {
    switchScreen('settings');
    loadModels();
  });
  document.getElementById('btnRefreshModels').addEventListener('click', loadModels);

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

  // Chat Mode Switch
  document.getElementById('btnModeGuide').addEventListener('click', () => setChatMode('guide'));
  document.getElementById('btnModeAnswer').addEventListener('click', () => setChatMode('answer'));
  document.getElementById('btnEffortMode').addEventListener('click', () => {
    setChatMode(state.chatMode === 'guide' ? 'answer' : 'guide');
  });
  document.getElementById('sidebarModePill').addEventListener('click', () => {
    setChatMode(state.chatMode === 'guide' ? 'answer' : 'guide');
  });

  // Chat Send
  document.getElementById('btnSend').addEventListener('click', () => sendChatMessage());
  document.getElementById('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });

  // Context Panel Collapse & Search
  document.getElementById('btnToggleContext').addEventListener('click', () => {
    const panel = document.getElementById('contextPanel');
    panel.classList.toggle('collapsed');
    document.getElementById('btnToggleContext').innerHTML = panel.classList.contains('collapsed')
      ? '<i class="bx bx-chevron-left"></i>'
      : '<i class="bx bx-chevron-right"></i>';
  });

  document.getElementById('snippetSearch').addEventListener('input', (e) => {
    state.snippetQuery = e.target.value;
    renderSnippets();
  });

  document.getElementById('snippetsList').addEventListener('click', (e) => {
    const askBtn = e.target.closest('.snippet-ask-btn');
    if (askBtn) sendChatMessage(askBtn.dataset.ask);
  });

  document.getElementById('chatMessages').addEventListener('click', (e) => {
    const srcBtn = e.target.closest('.link-source');
    if (srcBtn) {
      state.highlightedSnippet = srcBtn.dataset.source;
      renderSnippets();
      showToast('Highlighted local source in context panel');
      return;
    }
    const copyBtn = e.target.closest('.copy-msg-btn');
    if (copyBtn && navigator.clipboard) {
      navigator.clipboard.writeText(copyBtn.dataset.text || '');
      showToast('Copied to clipboard');
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

  // Tasks Toggle, Filters & Modal
  document.getElementById('tasksContainer').addEventListener('click', (e) => {
    const box = e.target.closest('.task-checkbox');
    if (!box) return;
    const task = state.tasks.find((t) => t.id === box.dataset.taskId);
    if (task) {
      task.completed = !task.completed;
      renderTasks();
    }
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

  document.getElementById('btnStartFocus').addEventListener('click', () => {
    showToast('45-min offline focus timer started');
  });
  document.getElementById('btnManageReminders').addEventListener('click', () => switchScreen('settings'));

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
  updateActiveModelLabels();
  loadModels();
  renderChat();
  renderSnippets();
  renderDocuments();
  renderTasks();
  renderProgress();
  renderBenchmark();

  // Live in-app time tracker (updates every second)
  setInterval(() => {
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
