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

function switchScreen(screenName) {
  state.screen = screenName;

  // Progress screen uses Flowstate-inspired Light Theme (#FF5C16); others Dark Theme
  document.documentElement.setAttribute(
    'data-theme',
    screenName === 'progress' ? 'light' : 'dark'
  );

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
        <div class="snippet-index">${s.index}</div>
        <div class="snippet-title ${s.isBangla ? 'bangla' : ''}">${s.title}</div>
        <div class="snippet-body ${s.isBangla ? 'bangla' : ''}">${s.body}</div>
        <div class="snippet-source">${s.source}</div>
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

function sendChatMessage(customText) {
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
  input.value = '';
  welcomeInput.value = '';
  renderChat();

  setTimeout(() => {
    if (state.chatMode === 'guide') {
      state.messages.push({
        id: `a-${Date.now()}`,
        role: 'assistant',
        mode: 'guide',
        bangla: hasBangla
          ? 'ভালো প্রশ্ন! সূত্রটি সরাসরি না দেখে বলো তো—এখানে কোন দুটি রাশি পরিবর্তন হচ্ছে?'
          : '',
        english:
          'Good step! Before jumping to the formula, which two quantities are changing in this problem based on your class notes?',
        hintChip: 'Hint: identify variables first',
        meta: 'Grounded in 2 local sources · 6.2s',
        sourceId: 's2',
      });
    } else {
      state.messages.push({
        id: `a-${Date.now()}`,
        role: 'assistant',
        mode: 'answer',
        bangla: hasBangla ? 'নিউটনের দ্বিতীয় সূত্র অনুযায়ী: F = ma (বল = ভর × ত্বরণ)।' : '',
        english:
          "According to Newton's second law, net force equals mass times acceleration (F = ma), as noted on p. 26 of class-notes.pdf.",
        hintChip: 'Direct Answer',
        meta: 'Grounded in class-notes.pdf · 5.4s',
        sourceId: 's2',
      });
    }
    renderChat();
  }, 350);
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

function addSimulatedDocument(filename) {
  state.documents.unshift({
    id: `d-${Date.now()}`,
    topic: 'Uploaded note',
    formula: filename.replace(/\.[^/.]+$/, ''),
    title: filename,
    pages: 8,
    size: '1.9 MB',
    subject: 'Physics',
    mode: 'VLM',
    status: 'processing',
    progress: 40,
    eta: '1 min left',
    isBangla: false,
  });
  renderDocuments();
  showToast(`Indexing "${filename}" locally with Qwen2.5-VL...`);

  setTimeout(() => {
    state.documents[0].status = 'indexed';
    state.documents[0].progress = 100;
    renderDocuments();
    showToast(`"${filename}" indexed on-device`);
  }, 1800);
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
}

function renderBenchmark() {
  const tbody = document.getElementById('benchmarkTbody');
  tbody.innerHTML = BENCHMARK_METRICS.map(
    (m) => `
      <tr>
        <td style="color: var(--text-secondary);">${m.metric}</td>
        <td class="mono">${m.vlm}</td>
        <td class="mono">${m.ocr}</td>
        <td style="color: ${m.preferredType === 'vlm' ? 'var(--teal-400)' : 'var(--success)'};">
          <i class="bx bx-check"></i> &nbsp;${m.preferred}
        </td>
      </tr>
    `
  ).join('');
}

/* ==========================================================================
   Event Wiring
   ========================================================================== */
function init() {
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
  document.getElementById('welcomeInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });
  document.getElementById('btnWelcomeScan').addEventListener('click', () => switchScreen('documents'));
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

  document.getElementById('btnChatAttach').addEventListener('click', () => switchScreen('documents'));
  document.getElementById('btnChatVoice').addEventListener('click', () => {
    showToast('Whisper offline voice input is planned in Phase 2');
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
    if (e.target.files[0]) addSimulatedDocument(e.target.files[0].name);
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
    if (e.dataTransfer.files[0]) addSimulatedDocument(e.dataTransfer.files[0].name);
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
  renderChat();
  renderSnippets();
  renderDocuments();
  renderTasks();
  renderProgress();
  renderBenchmark();
}

init();
