const STORAGE_KEY = "karina-level-up-v1";
const LOCAL_BACKUPS_KEY = `${STORAGE_KEY}-backups`;
const MAX_LOCAL_BACKUPS = 5;
const backupTools = globalThis.KarinaBackup;
const taskTools = globalThis.KarinaTasks;

const categories = {
  selfCare: { name: "Забота о себе", icon: "♡", color: "#9a806f" },
  style: { name: "Стиль и внешность", icon: "✦", color: "#7d9274" },
  impressions: { name: "Впечатления", icon: "◉", color: "#b18c65" },
  growth: { name: "Развитие", icon: "◇", color: "#849b8b" },
  energy: { name: "Энергия", icon: "ϟ", color: "#91a26f" },
};

let state = loadState();
let activeFilter = "all";
let toastTimer;

const elements = {
  level: document.querySelector("#level"), totalXp: document.querySelector("#total-xp"), nextLevel: document.querySelector("#next-level"),
  currentLevelXp: document.querySelector("#current-level-xp"), progressBar: document.querySelector("#progress-bar"), streak: document.querySelector("#streak"),
  streakLabel: document.querySelector("#streak-label"), completedCount: document.querySelector("#completed-count"), habitsList: document.querySelector("#habits-list"),
  questsList: document.querySelector("#quests-list"), tasksPanel: document.querySelector("#tasks-panel"), historyList: document.querySelector("#history-list"),
  emptyHabits: document.querySelector("#empty-habits"), emptyQuests: document.querySelector("#empty-quests"), emptyHistory: document.querySelector("#empty-history"),
  filters: document.querySelector("#category-filters"), dialog: document.querySelector("#task-dialog"), form: document.querySelector("#task-form"),
  title: document.querySelector("#task-title"), category: document.querySelector("#task-category"), type: document.querySelector("#task-type"), toast: document.querySelector("#toast"),
  exportBackup: document.querySelector("#export-backup"), backupFile: document.querySelector("#backup-file"),
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  try {
    if (raw !== null) {
      const migrated = backupTools.migrateState(JSON.parse(raw));
      if (migrated.ok) return migrated.state;
    }
  } catch (error) { console.warn("Не удалось прочитать сохранение", error); }
  const recovered = backupTools.findLatestValidSnapshot(readLocalBackups());
  if (recovered) {
    const restored = recovered;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(restored)); } catch (error) { console.warn("Не удалось восстановить сохранение", error); }
    return restored;
  }
  return { dataVersion: backupTools.DATA_VERSION, tasks: backupTools.DEFAULT_TASKS.map(task => ({ ...task })), history: [], xp: 0 };
}

function readLocalBackups() {
  try { const value = JSON.parse(localStorage.getItem(LOCAL_BACKUPS_KEY)); return Array.isArray(value) ? value : []; }
  catch (error) { console.warn("Не удалось прочитать локальные копии", error); return []; }
}
function snapshotCurrentState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return;
    const current = backupTools.migrateState(JSON.parse(raw));
    if (!current.ok) return;
    const snapshots = readLocalBackups();
    const nextSnapshots = backupTools.addLocalSnapshot(snapshots, current.state, MAX_LOCAL_BACKUPS);
    if (nextSnapshots !== snapshots) localStorage.setItem(LOCAL_BACKUPS_KEY, JSON.stringify(nextSnapshots));
  } catch (error) { console.warn("Не удалось создать локальную копию", error); }
}
function saveState() {
  const migrated = backupTools.migrateState(state);
  if (!migrated.ok) throw new Error(migrated.error);
  snapshotCurrentState();
  state = migrated.state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function makeId() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`; }
function escapeHtml(value) { const node = document.createElement("span"); node.textContent = value; return node.innerHTML; }

function getStreak() {
  const days = [...new Set(state.history.map(item => new Date(item.completedAt).toLocaleDateString("sv-SE")))].sort().reverse();
  if (!days.length) return 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const latest = new Date(`${days[0]}T00:00:00`);
  const gap = Math.round((today - latest) / 86400000);
  if (gap > 1) return 0;
  let streak = 1;
  for (let index = 1; index < days.length; index += 1) {
    if ((new Date(`${days[index - 1]}T00:00:00`) - new Date(`${days[index]}T00:00:00`)) / 86400000 === 1) streak += 1;
    else break;
  }
  return streak;
}

function pluralDays(number) {
  const lastTwo = number % 100, last = number % 10;
  return lastTwo >= 11 && lastTwo <= 14 ? "дней" : last === 1 ? "день" : last >= 2 && last <= 4 ? "дня" : "дней";
}

function renderFilters() {
  elements.filters.innerHTML = [{ id: "all", name: "Все", icon: "" }, ...Object.entries(categories).map(([id, value]) => ({ id, ...value }))]
    .map(item => `<button class="filter-button ${activeFilter === item.id ? "active" : ""}" data-filter="${item.id}" type="button">${item.icon} ${item.name}</button>`).join("");
}

function renderTasks() {
  const tasks = activeFilter === "all" ? state.tasks : state.tasks.filter(task => task.category === activeFilter);
  const card = task => { const category = categories[task.category], completed = taskTools.isCompletedToday(task); return `
    <article class="task-card ${completed ? "completed-today" : ""}">
      <button class="complete-button" data-complete="${task.id}" type="button" ${completed ? "disabled" : ""} aria-label="${completed ? "Уже выполнено сегодня" : `Выполнить «${escapeHtml(task.title)}»`}">✓</button>
      <div class="task-main"><h3>${escapeHtml(task.title)}</h3><div class="task-meta"><span class="type-badge type-${task.type}">${task.type === "habit" ? "Привычка" : "Квест"}</span><span class="category-badge" style="color:${category.color}">${category.icon} ${category.name}</span>${completed ? '<span class="done-label">Сегодня выполнено</span>' : ""}</div></div>
      <span class="xp-badge">+${task.xp} XP</span>
      <button class="delete-button" data-delete="${task.id}" type="button" aria-label="Удалить задание «${escapeHtml(task.title)}»">×</button>
    </article>`; };
  const habits = tasks.filter(task => task.type === "habit"), quests = tasks.filter(task => task.type === "quest");
  elements.habitsList.innerHTML = habits.map(card).join("");
  elements.questsList.innerHTML = quests.map(card).join("");
  elements.emptyHabits.hidden = habits.length > 0;
  elements.emptyQuests.hidden = quests.length > 0;
}

function renderHistory() {
  elements.historyList.innerHTML = state.history.slice(0, 8).map(item => `
    <article class="history-item"><span class="history-check">✓</span><div class="history-copy"><h3>${escapeHtml(item.title)}</h3><div><span class="type-badge type-${item.type}">${item.type === "habit" ? "Привычка" : "Квест"}</span> <time datetime="${item.completedAt}">${new Intl.DateTimeFormat("ru-RU", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" }).format(new Date(item.completedAt))}</time></div></div><span class="history-xp">+${item.xp} XP</span></article>`).join("");
  elements.emptyHistory.hidden = state.history.length > 0;
}

function renderStats() {
  const level = Math.floor(state.xp / 100) + 1, progress = state.xp % 100, streak = getStreak();
  elements.level.textContent = level; elements.totalXp.textContent = state.xp; elements.nextLevel.textContent = level + 1;
  elements.currentLevelXp.textContent = progress; elements.progressBar.style.width = `${progress}%`; elements.streak.textContent = streak;
  elements.streakLabel.textContent = pluralDays(streak); elements.completedCount.textContent = state.history.length;
}

function render() { renderFilters(); renderTasks(); renderHistory(); renderStats(); }
function showToast(message) { clearTimeout(toastTimer); elements.toast.textContent = message; elements.toast.classList.add("show"); toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2600); }

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function downloadFile(file) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function exportBackup() {
  try {
    const backup = backupTools.createBackup(state);
    const filename = `karina-level-up-backup-${backup.createdAt.slice(0, 10)}.json`;
    const file = new File([JSON.stringify(backup, null, 2)], filename, { type: "application/json" });
    const shareData = { title: "Резервная копия", files: [file] };
    let canShareFile = false;

    if (isIosDevice() && typeof navigator.share === "function" && typeof navigator.canShare === "function") {
      try { canShareFile = navigator.canShare(shareData); }
      catch (error) { console.warn("Браузер не может поделиться файлом", error); }
    }

    if (canShareFile) {
      try {
        await navigator.share(shareData);
        showToast("Выбери «Сохранить в Файлы» в меню Поделиться ✓");
      } catch (error) {
        if (error?.name === "AbortError") return;
        throw error;
      }
      return;
    }

    downloadFile(file);
    showToast("Резервная копия скачана ✓");
  } catch (error) {
    console.warn("Не удалось экспортировать копию", error);
    showToast("Не удалось создать резервную копию. Попробуй ещё раз.");
  }
}

async function importBackup(file) {
  try {
    if (!file || file.size > 5 * 1024 * 1024) throw new Error("Файл слишком большой или не выбран.");
    const parsed = backupTools.parseBackup(JSON.parse(await file.text()));
    if (!parsed.ok) throw new Error(parsed.error);
    if (!confirm("Восстановить резервную копию? Текущие данные будут заменены, но сначала сохранятся в локальной аварийной копии.")) return;
    snapshotCurrentState();
    state = parsed.state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    activeFilter = "all";
    render();
    showToast("Прогресс успешно восстановлен ✓");
  } catch (error) {
    console.warn("Не удалось импортировать копию", error);
    showToast(`Копия не восстановлена: ${error.message}`);
  } finally { elements.backupFile.value = ""; }
}

function completeTask(id) {
  const previousLevel = Math.floor(state.xp / 100) + 1;
  const result = taskTools.complete(state, id);
  if (!result.ok) { if (result.reason === "already-completed") showToast("Эта привычка уже выполнена сегодня ✓"); return; }
  state = result.state; const task = result.task; saveState(); render();
  const newLevel = Math.floor(state.xp / 100) + 1;
  showToast(newLevel > previousLevel ? `Новый уровень — ${newLevel}!` : `Задание выполнено: +${task.xp} XP`);
}

elements.filters.addEventListener("click", event => { const button = event.target.closest("[data-filter]"); if (button) { activeFilter = button.dataset.filter; renderFilters(); renderTasks(); } });
elements.tasksPanel.addEventListener("click", event => {
  const complete = event.target.closest("[data-complete]"), remove = event.target.closest("[data-delete]");
  if (complete) completeTask(complete.dataset.complete);
  if (remove && confirm("Удалить это задание?")) { state.tasks = state.tasks.filter(task => task.id !== remove.dataset.delete); saveState(); renderTasks(); showToast("Задание удалено"); }
});

Object.entries(categories).forEach(([id, category]) => elements.category.add(new Option(`${category.icon} ${category.name}`, id)));
document.querySelectorAll(".add-task-button").forEach(button => button.addEventListener("click", () => { elements.dialog.showModal(); elements.title.focus(); }));
document.querySelector("#close-dialog").addEventListener("click", () => elements.dialog.close());
document.querySelector("#cancel-dialog").addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", event => { if (event.target === elements.dialog) elements.dialog.close(); });
elements.form.addEventListener("submit", event => {
  event.preventDefault(); const data = new FormData(elements.form); const title = data.get("title").trim(); const xp = Number(data.get("xp"));
  if (!title || xp < 1 || xp > 100) return;
  state.tasks.unshift({ id: makeId(), title, category: data.get("category"), xp, type: data.get("type") }); saveState(); activeFilter = "all"; render();
  elements.form.reset(); elements.dialog.close(); showToast("Новое задание добавлено");
});
elements.exportBackup.addEventListener("click", exportBackup);
elements.backupFile.addEventListener("change", () => importBackup(elements.backupFile.files[0]));

render();
