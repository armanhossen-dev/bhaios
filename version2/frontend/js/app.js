import { api } from "./api.js";
import { I18N } from "./i18n.js";

const state = {
  screen: "today",
  lang: localStorage.getItem("v2_lang") || "en",
  theme: localStorage.getItem("v2_theme") || "light",
  activeCourseId: localStorage.getItem("v2_course") || "",
  courses: [],
  files: [],
  tasks: [],
  flashcards: [],
  cardIndex: 0,
  cardFlipped: false,
  messages: [],
  chatId: null,
  health: null,
  focusSecs: 25 * 60,
  focusTimer: null,
};

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setTheme(theme) {
  state.theme = theme;
  localStorage.setItem("v2_theme", theme);
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelectorAll("[data-theme-set]").forEach((b) => {
    b.classList.toggle("active", b.dataset.themeSet === theme);
  });
}

function setLang(lang) {
  state.lang = lang;
  localStorage.setItem("v2_lang", lang);
  const t = I18N[lang];
  document.querySelectorAll("[data-lang-set]").forEach((b) => {
    b.classList.toggle("active", b.dataset.langSet === lang);
  });
  document.querySelectorAll(".rail-btn[data-screen]").forEach((btn) => {
    const key = btn.dataset.screen;
    const span = btn.querySelector(".rail-btn-left span");
    if (span && t.nav[key]) span.textContent = t.nav[key];
  });
  if ($("localStatusLabel")) $("localStatusLabel").textContent = t.localReady;
  if ($("askInput")) $("askInput").placeholder = t.askPlaceholder;
  if ($("networkPolicyText")) $("networkPolicyText").textContent = t.networkNone;
  const activeBtn = document.querySelector(`.rail-btn[data-screen="${state.screen}"]`);
  if (activeBtn && $("topbarTitle")) $("topbarTitle").textContent = t.nav[state.screen] || state.screen;
}

function switchScreen(name) {
  state.screen = name;
  document.querySelectorAll(".rail-btn[data-screen]").forEach((b) => {
    b.classList.toggle("active", b.dataset.screen === name);
  });
  document.querySelectorAll(".screen").forEach((s) => {
    s.classList.toggle("active", s.id === `screen-${name}`);
  });
  const t = I18N[state.lang];
  if ($("topbarTitle")) $("topbarTitle").textContent = t.nav[name] || name;
  if (name === "grades") refreshGradesAndNotes();
  if (name === "study") refreshFlashcards();
}

async function openSourceViewer(fileId, pageOrSlide, highlightPassage = "") {
  $("appShell").classList.add("source-open");
  $("sourcePaneTitle").textContent = "Loading…";
  $("sourcePaneBody").innerHTML = "";
  try {
    const data = await api.fileChunks(fileId, pageOrSlide);
    $("sourcePaneTitle").textContent = data.file.filename;
    $("sourcePaneMeta").textContent = `Page/Slide ${pageOrSlide} · ${data.file.page_count} total`;
    $("sourcePaneBody").innerHTML = data.chunks
      .map((c) => {
        const isHit = highlightPassage && c.content.includes(highlightPassage.slice(0, 40));
        return `
          <div class="passage-card ${isHit ? "highlighted" : ""}">
            <div class="muted-sm" style="margin-bottom:6px;">${esc(c.section_title || `Page ${c.page_or_slide}`)}</div>
            <div>${esc(c.content)}</div>
          </div>`;
      })
      .join("");
  } catch (err) {
    $("sourcePaneBody").innerHTML = `<div class="muted">${esc(err.message)}</div>`;
  }
}

async function refreshAll() {
  const [health, semData, filesData, tasksData, cardsData] = await Promise.all([
    api.health(),
    api.semesters(),
    api.files(state.activeCourseId),
    api.tasks(state.activeCourseId),
    api.flashcards(state.activeCourseId, true),
  ]);

  state.health = health;
  state.courses = semData.courses || [];
  state.files = filesData.files || [];
  state.tasks = tasksData.tasks || [];
  state.flashcards = cardsData.flashcards || [];

  if (!health.user.onboarding_completed) {
    $("onboardingModal").classList.add("open");
    $("obHwInfo").textContent = `Detected ${health.hardware.total_ram_gb} GB RAM · Recommended: ${health.hardware.recommended_models.join(", ")}`;
  }

  renderCourseSelect();
  renderCourses();
  renderLibrary();
  renderTasks();
  renderFlashcards();
  renderSettings();

  $("badgeCourses").textContent = state.courses.length;
  $("badgeFiles").textContent = state.files.length;
  $("badgeDueTasks").textContent = state.tasks.filter((t) => t.status !== "done").length;
  $("badgeFlashcards").textContent = state.flashcards.length;
  $("kpiDueTasks").textContent = state.tasks.filter((t) => t.status !== "done").length;
  $("kpiDueCards").textContent = state.flashcards.length;
  $("kpiFilesReady").textContent = state.files.filter((f) => f.status === "ready").length;
  $("jobsCounterLabel").textContent = `${health.active_jobs} jobs`;
}

function renderCourseSelect() {
  const sel = $("globalCourseSelect");
  const cur = state.activeCourseId;
  sel.innerHTML = `<option value="">All courses</option>` +
    state.courses.map((c) => `<option value="${c.id}" ${c.id === cur ? "selected" : ""}>${esc(c.code)} · ${esc(c.title)}</option>`).join("");
}

function renderCourses() {
  const grid = $("coursesGrid");
  if (!state.courses.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div>No courses yet for this semester.</div><button class="btn btn-primary btn-sm" onclick="document.getElementById('courseModal').classList.add('open')">+ Add First Course</button></div>`;
    return;
  }
  grid.innerHTML = state.courses
    .map((c) => {
      const fCount = state.files.filter((f) => f.course_id === c.id).length;
      return `
        <div class="course-card" style="border-left-color: var(--crs-${esc(c.color || "teal")});">
          <div class="row-between">
            <span class="course-code">${esc(c.code)} · ${c.credits} cr</span>
            <span class="tag-pill">${fCount} files</span>
          </div>
          <h3 class="course-title">${esc(c.title)}</h3>
          <div class="row-between" style="margin-top:4px;">
            <button class="btn btn-sm" data-select-course="${c.id}" type="button">Open Workspace</button>
            <button class="btn btn-sm" data-del-course="${c.id}" type="button">Delete</button>
          </div>
        </div>`;
    })
    .join("");
}

function renderLibrary() {
  const tbody = $("libraryTableBody");
  if (!state.files.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px;" class="muted">${I18N[state.lang].noMaterials}</td></tr>`;
    return;
  }
  tbody.innerHTML = state.files
    .map((f) => `
      <tr>
        <td><strong>${esc(f.filename)}</strong></td>
        <td class="mono">${esc(f.ext)}</td>
        <td class="tabular">${f.page_count || "—"}</td>
        <td><span class="tag-pill ${f.status === "ready" ? "ready" : f.status === "error" ? "warn" : ""}">${esc(f.status)}</span></td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-sm" data-view-file="${f.id}" type="button">View</button>
            ${f.status === "error" ? `<button class="btn btn-sm" data-retry-file="${f.id}" type="button">Retry</button>` : ""}
            <button class="btn btn-sm" data-del-file="${f.id}" type="button">Remove</button>
          </div>
        </td>
      </tr>`)
    .join("");
}

function renderTasks() {
  const openTasks = state.tasks.filter((t) => t.status !== "done");
  const renderList = (el, list) => {
    if (!list.length) {
      el.innerHTML = `<div class="muted">No pending tasks.</div>`;
      return;
    }
    el.innerHTML = list
      .map((t) => `
        <div class="row-between" style="padding:8px 10px; border:1px solid var(--border); border-radius:var(--radius-sm);">
          <div>
            <div style="font-weight:500;">${esc(t.title)}</div>
            <div class="muted-sm">${esc(t.task_type)} ${t.due_date ? "· Due " + esc(t.due_date) : ""}</div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-sm" data-done-task="${t.id}" type="button">${t.status === "done" ? "Reopen" : "Done"}</button>
            <button class="btn btn-sm" data-del-task="${t.id}" type="button">×</button>
          </div>
        </div>`)
      .join("");
  };
  renderList($("todayTasksList"), openTasks.slice(0, 5));
  renderList($("plannerTasksList"), state.tasks);
}

function renderAskStream() {
  const box = $("askStream");
  if (!state.messages.length) return;
  box.innerHTML = state.messages
    .map((m) => {
      if (m.role === "user") {
        return `<div class="msg-user">${esc(m.content)}</div>`;
      }
      const cits = m.citations || [];
      let formatted = esc(m.content).replace(/\n/g, "<br/>");
      cits.forEach((c) => {
        const re = new RegExp(`\\[${c.index}\\]`, "g");
        formatted = formatted.replace(
          re,
          `<button class="cite-tab" data-cite-file="${c.file_id}" data-cite-page="${c.page_or_slide}" data-cite-passage="${esc(c.passage)}" type="button">[${c.index}]</button>`
        );
      });
      const sourcesHtml = cits.length
        ? `<div class="sources-footer">
            <div class="muted-sm">${I18N[state.lang].sourcesUsed} (${cits.length})</div>
            <div class="sources-list">
              ${cits.map((c) => `<button class="source-chip" data-cite-file="${c.file_id}" data-cite-page="${c.page_or_slide}" data-cite-passage="${esc(c.passage)}" type="button">[${c.index}] ${esc(c.filename)} · p.${c.page_or_slide}</button>`).join("")}
            </div>
          </div>`
        : "";
      return `
        <div class="msg-assistant">
          <div class="msg-prose">${formatted}</div>
          ${sourcesHtml}
        </div>`;
    })
    .join("");
  box.scrollTop = box.scrollHeight;
}

async function sendAsk() {
  const input = $("askInput");
  const q = input.value.trim();
  if (!q) return;
  input.value = "";
  state.messages.push({ role: "user", content: q });
  renderAskStream();

  try {
    const res = await api.ask({
      query: q,
      mode: $("askModeSelect").value,
      scope: $("askScopeSelect").value,
      course_id: state.activeCourseId || null,
      language: state.lang,
      chat_id: state.chatId,
    });
    state.chatId = res.chat_id;
    state.messages.push({ role: "assistant", content: res.reply, citations: res.citations });
    renderAskStream();
  } catch (err) {
    state.messages.push({ role: "assistant", content: `Error: ${err.message}`, citations: [] });
    renderAskStream();
  }
}

function renderFlashcards() {
  const wrap = $("flashcardStageWrap");
  if (!state.flashcards.length) {
    wrap.innerHTML = `<div class="empty-state"><div>No flashcards due right now.</div><div class="muted-sm">Select a course and generate cards from your uploaded slides.</div></div>`;
    return;
  }
  const card = state.flashcards[state.cardIndex % state.flashcards.length];
  wrap.innerHTML = `
    <div class="flashcard-stage">
      <div class="row-between">
        <span class="muted-sm">Card ${(state.cardIndex % state.flashcards.length) + 1} of ${state.flashcards.length}</span>
        ${card.file_id ? `<button class="btn btn-sm" data-cite-file="${card.file_id}" data-cite-page="${card.page_or_slide || 1}" type="button">Source p.${card.page_or_slide || 1}</button>` : ""}
      </div>
      <div class="flashcard-text">${esc(state.cardFlipped ? card.back : card.front)}</div>
      <div style="display:flex; justify-content:center; gap:8px; flex-wrap:wrap;">
        ${!state.cardFlipped
          ? `<button class="btn btn-primary" id="btnFlipCard" type="button">Show Answer (Space)</button>`
          : `
            <button class="btn btn-sm" data-rate="1" type="button">1 · Again</button>
            <button class="btn btn-sm" data-rate="2" type="button">2 · Hard</button>
            <button class="btn btn-primary btn-sm" data-rate="3" type="button">3 · Good</button>
            <button class="btn btn-sm" data-rate="4" type="button">4 · Easy</button>
          `}
      </div>
    </div>`;
}

async function rateCurrentCard(rating) {
  const card = state.flashcards[state.cardIndex % state.flashcards.length];
  if (!card) return;
  await api.reviewFlashcard(card.id, rating);
  state.cardFlipped = false;
  state.cardIndex += 1;
  await refreshFlashcards();
}

async function refreshFlashcards() {
  const data = await api.flashcards(state.activeCourseId, true);
  state.flashcards = data.flashcards || [];
  renderFlashcards();
}

async function refreshGradesAndNotes() {
  if (!state.activeCourseId) {
    $("gradesSummaryBox").innerHTML = `<div class="muted">Choose a course from the left rail first.</div>`;
    $("attendanceBox").innerHTML = "";
    return;
  }
  const [g, n] = await Promise.all([api.grades(state.activeCourseId), api.notes(state.activeCourseId)]);
  $("gradesSummaryBox").innerHTML = `
    <div class="row-between"><span>Earned so far</span><strong class="tabular">${g.summary.earned_pct}%</strong></div>
    <div class="row-between"><span>Completed weight</span><span class="tabular">${g.summary.completed_weight}%</span></div>
    <div class="row-between"><span>Needed on remaining for 80%</span><strong class="tabular">${g.summary.needed_pct_on_remaining}%</strong></div>
  `;
  $("attendanceBox").innerHTML = `
    <div class="row-between"><span>Attendance</span><strong class="tabular">${g.attendance_stats.percentage}% (${g.attendance_stats.present}/${g.attendance_stats.total})</strong></div>
    <div class="muted-sm">Classes you can still miss: <strong>${g.attendance_stats.can_miss}</strong></div>
  `;
  $("notesListBox").innerHTML = (n.notes || [])
    .map((note) => `<div class="card" style="padding:10px 12px;"><strong>${esc(note.title)}</strong><div class="muted-sm">${esc(note.content)}</div></div>`)
    .join("");
}

function renderSettings() {
  if (!state.health) return;
  const hw = state.health.hardware;
  $("hardwareSummaryBox").textContent = `${hw.os} (${hw.arch}) · ${hw.total_ram_gb} GB RAM · ${hw.cpu_cores} cores · Tier: ${hw.tier.toUpperCase()} · Ollama: ${state.health.ollama.online ? "Online" : "Offline"}`;
  const installedNames = new Set((state.health.ollama.installed || []).map((m) => m.name));
  $("modelCatalogBody").innerHTML = state.health.catalog
    .map((m) => {
      const active = state.health.active_model === m.id;
      const installed = installedNames.has(m.id);
      return `
        <tr>
          <td><strong>${esc(m.name)}</strong><div class="muted-sm mono">${esc(m.id)}</div></td>
          <td class="mono">${m.ram_gb} GB</td>
          <td class="mono">${esc(m.est_tok_s)}</td>
          <td>${esc(m.bangla_rating)}</td>
          <td>
            <button class="btn btn-sm ${active ? "btn-primary" : ""}" data-use-model="${m.id}" type="button">
              ${active ? "Active" : installed ? "Use" : "Select"}
            </button>
          </td>
        </tr>`;
    })
    .join("");
}

function connectJobsSocket() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws/jobs`);
  ws.onmessage = () => refreshAll();
}

function bindEvents() {
  document.querySelectorAll(".rail-btn[data-screen]").forEach((b) => {
    b.addEventListener("click", () => switchScreen(b.dataset.screen));
  });
  document.querySelectorAll("[data-theme-set]").forEach((b) => {
    b.addEventListener("click", () => setTheme(b.dataset.themeSet));
  });
  document.querySelectorAll("[data-lang-set]").forEach((b) => {
    b.addEventListener("click", () => setLang(b.dataset.langSet));
  });

  $("globalCourseSelect").addEventListener("change", (e) => {
    state.activeCourseId = e.target.value;
    localStorage.setItem("v2_course", state.activeCourseId);
    refreshAll();
  });

  $("btnUploadTrigger").addEventListener("click", () => $("globalFileInput").click());
  $("btnLibraryUpload").addEventListener("click", () => $("globalFileInput").click());
  $("globalFileInput").addEventListener("change", async (e) => {
    for (const file of e.target.files) {
      await api.uploadFile(file, state.activeCourseId);
    }
    e.target.value = "";
    await refreshAll();
  });

  $("btnAskSend").addEventListener("click", sendAsk);
  $("askInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendAsk();
    }
  });

  $("btnCloseSource").addEventListener("click", () => $("appShell").classList.remove("source-open"));

  document.body.addEventListener("click", async (e) => {
    const cite = e.target.closest("[data-cite-file]");
    if (cite) {
      openSourceViewer(cite.dataset.citeFile, Number(cite.dataset.citePage), cite.dataset.citePassage || "");
      return;
    }
    const goto = e.target.closest("[data-goto]");
    if (goto) {
      switchScreen(goto.dataset.goto);
      return;
    }
    const selCrs = e.target.closest("[data-select-course]");
    if (selCrs) {
      state.activeCourseId = selCrs.dataset.selectCourse;
      localStorage.setItem("v2_course", state.activeCourseId);
      await refreshAll();
      switchScreen("library");
      return;
    }
    const delCrs = e.target.closest("[data-del-course]");
    if (delCrs) {
      await api.deleteCourse(delCrs.dataset.delCourse);
      if (state.activeCourseId === delCrs.dataset.delCourse) state.activeCourseId = "";
      await refreshAll();
      return;
    }
    const viewF = e.target.closest("[data-view-file]");
    if (viewF) {
      openSourceViewer(viewF.dataset.viewFile, 1);
      return;
    }
    const retryF = e.target.closest("[data-retry-file]");
    if (retryF) {
      await api.retryFile(retryF.dataset.retryFile);
      await refreshAll();
      return;
    }
    const delF = e.target.closest("[data-del-file]");
    if (delF) {
      await api.deleteFile(delF.dataset.delFile);
      await refreshAll();
      return;
    }
    const doneT = e.target.closest("[data-done-task]");
    if (doneT) {
      const t = state.tasks.find((x) => x.id === doneT.dataset.doneTask);
      await api.updateTaskStatus(t.id, t.status === "done" ? "todo" : "done");
      await refreshAll();
      return;
    }
    const delT = e.target.closest("[data-del-task]");
    if (delT) {
      await api.deleteTask(delT.dataset.delTask);
      await refreshAll();
      return;
    }
    if (e.target.id === "btnFlipCard") {
      state.cardFlipped = true;
      renderFlashcards();
      return;
    }
    const rateBtn = e.target.closest("[data-rate]");
    if (rateBtn) {
      await rateCurrentCard(Number(rateBtn.dataset.rate));
      return;
    }
    const useModel = e.target.closest("[data-use-model]");
    if (useModel) {
      await api.saveSettings({ active_model: useModel.dataset.useModel });
      await refreshAll();
    }
  });

  // Modals & Shortcuts
  $("btnOpenSearch").addEventListener("click", () => {
    $("searchModal").classList.add("open");
    $("globalSearchInput").focus();
  });
  $("btnCloseSearch").addEventListener("click", () => $("searchModal").classList.remove("open"));
  $("globalSearchInput").addEventListener("input", async (e) => {
    const q = e.target.value.trim();
    if (!q) { $("globalSearchResults").innerHTML = ""; return; }
    const data = await api.search(q);
    $("globalSearchResults").innerHTML = (data.results || [])
      .map((r) => `<button class="source-chip" data-cite-file="${r.file_id}" data-cite-page="${r.page_or_slide}" type="button"><strong>${esc(r.filename)}</strong> · p.${r.page_or_slide} — ${esc(r.section_title)}</button>`)
      .join("");
  });

  $("btnNewCourseModal").addEventListener("click", () => $("courseModal").classList.add("open"));
  $("btnCancelCourse").addEventListener("click", () => $("courseModal").classList.remove("open"));
  $("btnSaveCourse").addEventListener("click", async () => {
    await api.createCourse({
      code: $("newCrsCode").value,
      title: $("newCrsTitle").value,
      credits: Number($("newCrsCredits").value || 3),
      color: $("newCrsColor").value,
    });
    $("courseModal").classList.remove("open");
    await refreshAll();
  });

  $("btnQuickCapture").addEventListener("click", () => $("taskModal").classList.add("open"));
  $("btnPlannerAdd").addEventListener("click", () => $("taskModal").classList.add("open"));
  $("btnCancelTask").addEventListener("click", () => $("taskModal").classList.remove("open"));
  $("btnSaveTask").addEventListener("click", async () => {
    await api.createTask({
      course_id: state.activeCourseId || null,
      title: $("newTskTitle").value,
      task_type: $("newTskType").value,
      due_date: $("newTskDue").value,
    });
    $("taskModal").classList.remove("open");
    await refreshAll();
  });

  $("btnGenCards").addEventListener("click", async () => {
    if (!state.activeCourseId) return alert("Select a course first.");
    await api.generateFlashcards(state.activeCourseId);
    await refreshFlashcards();
  });

  $("btnMarkPresent").addEventListener("click", async () => {
    if (!state.activeCourseId) return;
    await api.markAttendance({ course_id: state.activeCourseId, class_date: new Date().toISOString().slice(0, 10), status: "present" });
    await refreshGradesAndNotes();
  });
  $("btnMarkAbsent").addEventListener("click", async () => {
    if (!state.activeCourseId) return;
    await api.markAttendance({ course_id: state.activeCourseId, class_date: new Date().toISOString().slice(0, 10), status: "absent" });
    await refreshGradesAndNotes();
  });
  $("btnSaveNote").addEventListener("click", async () => {
    if (!state.activeCourseId) return;
    await api.saveNote({ course_id: state.activeCourseId, title: $("noteTitleInput").value || "Untitled", content: $("noteContentInput").value });
    $("noteTitleInput").value = "";
    $("noteContentInput").value = "";
    await refreshGradesAndNotes();
  });

  $("btnExportBackup").addEventListener("click", () => {
    const pass = $("backupPassphrase").value;
    window.location.href = `/api/backup/export?passphrase=${encodeURIComponent(pass)}`;
  });
  $("btnImportBackup").addEventListener("click", () => $("backupFileInput").click());
  $("backupFileInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("passphrase", $("backupPassphrase").value);
    await fetch("/api/backup/import", { method: "POST", body: fd });
    await refreshAll();
  });

  $("btnFinishOnboarding").addEventListener("click", async () => {
    await api.onboarding({
      name: $("obName").value,
      university: $("obUni").value,
      semester_name: $("obSem").value,
      language: state.lang,
      theme: state.theme,
      active_model: state.health?.hardware?.recommended_models?.[0] || "qwen2.5:3b",
    });
    $("onboardingModal").classList.remove("open");
    await refreshAll();
  });

  // Focus timer
  $("btnFocusToggle").addEventListener("click", () => {
    if (state.focusTimer) {
      clearInterval(state.focusTimer);
      state.focusTimer = null;
      $("btnFocusToggle").textContent = "Resume";
      return;
    }
    $("btnFocusToggle").textContent = "Pause";
    state.focusTimer = setInterval(() => {
      state.focusSecs = Math.max(0, state.focusSecs - 1);
      const m = String(Math.floor(state.focusSecs / 60)).padStart(2, "0");
      const s = String(state.focusSecs % 60).padStart(2, "0");
      $("focusTimerDisplay").textContent = `${m}:${s}`;
    }, 1000);
  });
  $("btnFocusReset").addEventListener("click", () => {
    clearInterval(state.focusTimer);
    state.focusTimer = null;
    state.focusSecs = 25 * 60;
    $("focusTimerDisplay").textContent = "25:00";
    $("btnFocusToggle").textContent = "Start 25m";
  });

  // Global keyboard shortcuts
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      $("searchModal").classList.add("open");
      $("globalSearchInput").focus();
    } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "n") {
      e.preventDefault();
      $("taskModal").classList.add("open");
    } else if (e.key === "Escape") {
      document.querySelectorAll(".modal-backdrop.open").forEach((m) => m.classList.remove("open"));
    } else if (state.screen === "study" && state.flashcards.length && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
      if (e.code === "Space" && !state.cardFlipped) {
        e.preventDefault();
        state.cardFlipped = true;
        renderFlashcards();
      } else if (state.cardFlipped && ["1", "2", "3", "4"].includes(e.key)) {
        rateCurrentCard(Number(e.key));
      }
    }
  });
}

setTheme(state.theme);
setLang(state.lang);
bindEvents();
connectJobsSocket();
refreshAll();
