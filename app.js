const STORAGE_KEY = "karina-level-up-v1";
const LOCAL_BACKUPS_KEY = `${STORAGE_KEY}-backups`;
const MAX_LOCAL_BACKUPS = 5;
const backupTools = globalThis.KarinaBackup;
const taskTools = globalThis.KarinaTasks;
const dailyQuestTools = globalThis.KarinaDailyQuests;
const rewardTools = globalThis.KarinaRewards;
// Legacy key containing the safety copy made before the retired reset of 9 September 2026.
const PRE_RESET_EMERGENCY_BACKUP_KEY = `${STORAGE_KEY}-reset-real-use-start-2026-09-09-emergency-backup`;

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
  totalXp: document.querySelector("#total-xp"), nextLevel: document.querySelector("#next-level"),
  currentLevelXp: document.querySelector("#current-level-xp"), progressBar: document.querySelector("#progress-bar"), habitsList: document.querySelector("#habits-list"),
  questsList: document.querySelector("#quests-list"), tasksPanel: document.querySelector("#tasks-panel"),
  emptyHabits: document.querySelector("#empty-habits"),
  filters: document.querySelector("#category-filters"), dialog: document.querySelector("#task-dialog"), form: document.querySelector("#task-form"),
  title: document.querySelector("#task-title"), category: document.querySelector("#task-category"), type: document.querySelector("#task-type"), toast: document.querySelector("#toast"),
  exportBackup: document.querySelector("#export-backup"), backupFile: document.querySelector("#backup-file"),
  restoreEmergencyBackup: document.querySelector("#restore-emergency-backup"),
  plantComposition: document.querySelector(".plant-composition"), eucalyptus: document.querySelector("#eucalyptus"),
  nextRewardTitle: document.querySelector("#next-reward-title"), nextRewardDescription: document.querySelector("#next-reward-description"), nextRewardXp: document.querySelector("#next-reward-xp"),
  wishlistList: document.querySelector("#wishlist-list"), wishlistEmpty: document.querySelector("#wishlist-empty"), wishlistDialog: document.querySelector("#wishlist-dialog"), wishlistForm: document.querySelector("#wishlist-form"),
  toastTitle: document.querySelector("#toast-title"), toastMessage: document.querySelector("#toast-message"),
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
  return { dataVersion: backupTools.DATA_VERSION, tasks: backupTools.DEFAULT_TASKS.map(task => ({ ...task })), history: [], xp: 0, dailyQuest: { recentlyUsedIds: [] }, unlockedRewardLevels: [], rewardWishlist: [] };
}

function readEmergencyBackup() {
  try {
    const raw = localStorage.getItem(PRE_RESET_EMERGENCY_BACKUP_KEY);
    if (raw === null) return null;
    const parsed = backupTools.parseBackup(JSON.parse(raw));
    return parsed.ok ? parsed.state : null;
  } catch (error) { console.warn("Не удалось прочитать аварийную копию", error); return null; }
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

function renderFilters() {
  elements.filters.innerHTML = [{ id: "all", name: "Все", icon: "" }, ...Object.entries(categories).map(([id, value]) => ({ id, ...value }))]
    .map(item => `<button class="filter-button ${activeFilter === item.id ? "active" : ""}" data-filter="${item.id}" type="button">${item.icon} ${item.name}</button>`).join("");
}

function renderTasks() {
  const tasks = activeFilter === "all" ? state.tasks : state.tasks.filter(task => task.category === activeFilter);
  const card = task => { const category = categories[task.category], completed = taskTools.isCompletedToday(task); return `
    <article class="task-card ${completed ? "completed-today" : ""}">
      <button class="complete-button" data-complete="${task.id}" type="button" ${completed ? "disabled" : ""} aria-label="${completed ? "Уже выполнено сегодня" : `Выполнить «${escapeHtml(task.title)}»`}">✓</button>
      <div class="task-main"><h3>${escapeHtml(task.title)}</h3>${task.subtitle ? `<p class="task-subtitle">${escapeHtml(task.subtitle)}</p>` : ""}<div class="task-meta"><span class="type-badge type-${task.type}">${task.type === "habit" ? "Привычка" : "Квест"}</span><span class="category-badge" style="color:${category.color}">${category.icon} ${category.name}</span>${completed ? `<span class="done-label">Сегодня выполнено</span><button class="undo-button" data-undo="${task.id}" type="button">Отменить</button>` : ""}</div></div>
      <span class="xp-badge">+${task.xp} XP</span>
      <button class="delete-button" data-delete="${task.id}" type="button" aria-label="Удалить задание «${escapeHtml(task.title)}»">×</button>
    </article>`; };
  const habits = tasks.filter(task => task.type === "habit");
  elements.habitsList.innerHTML = habits.map(card).join("");
  elements.emptyHabits.hidden = habits.length > 0;
  renderDailyQuest();
}

function renderDailyQuest() {
  const selection = dailyQuestTools.selectForToday(state);
  if (selection.changed) { state = selection.state; saveState(); }
  const quest = selection.quest;
  const completed = state.dailyQuest.completedOn === dailyQuestTools.localDateKey();
  elements.questsList.innerHTML = `
    <article class="task-card daily-quest-card ${completed ? "completed-today" : ""}">
      <button class="complete-button" data-complete-daily type="button" ${completed ? "disabled" : ""} aria-label="${completed ? "Квест дня выполнен" : `Выполнить «${escapeHtml(quest.title)}»`}">✓</button>
      <div class="task-main"><h3>${escapeHtml(quest.title)}</h3><p class="task-subtitle">${escapeHtml(quest.subtitle)}</p><div class="task-meta"><span class="type-badge type-quest">Квест дня</span>${completed ? `<span class="done-label">Сегодня выполнено</span>` : ""}</div></div>
      <span class="xp-badge">+${quest.xp} XP</span>
    </article>`;
}

function renderStats() {
  const level = Math.floor(state.xp / 100) + 1, progress = state.xp % 100;
  elements.totalXp.textContent = state.xp; elements.nextLevel.textContent = level + 1;
  elements.currentLevelXp.textContent = progress; elements.progressBar.style.width = `${progress}%`;
  const reward = rewardTools.nextReward(level);
  const xpRemaining = (reward.level - 1) * 100 - state.xp;
  elements.nextRewardTitle.textContent = `Уровень ${reward.level}`;
  elements.nextRewardDescription.textContent = reward.description;
  elements.nextRewardXp.textContent = `Осталось ${xpRemaining} XP`;
  renderEucalyptus(level, progress);
}

const rewardCategoryNames = { small: "Маленькая приятность", gift: "Подарок", experience: "Впечатление", big: "Большая хотелка" };
function renderWishlist() {
  elements.wishlistList.innerHTML = state.rewardWishlist.map(item => `<article class="wish-item"><strong>${escapeHtml(item.title)}</strong><span class="wish-meta">${rewardCategoryNames[item.category]} · уровень ${item.level}</span><button class="wish-delete" data-delete-wish="${escapeHtml(item.id)}" type="button" aria-label="Удалить хотелку «${escapeHtml(item.title)}»">×</button></article>`).join("");
  elements.wishlistEmpty.hidden = state.rewardWishlist.length > 0;
}

function renderEucalyptus(level, progress) {
  const emergingOpacity = progress < 25 ? .06 : progress < 50 ? .3 : progress < 75 ? .58 : .84;
  elements.eucalyptus.querySelectorAll("[data-growth-stage]").forEach(part => {
    const stage = Number(part.dataset.growthStage);
    part.style.setProperty("--growth-opacity", stage <= level ? 1 : stage === level + 1 ? emergingOpacity : 0);
  });
  const renewal = elements.eucalyptus.querySelector("[data-growth-renewal]");
  renewal.style.setProperty("--growth-opacity", level > 10 ? Math.min(.35 + ((level - 11) % 5) * .12 + progress / 500, 1) : 0);
  elements.plantComposition.dataset.maturity = String(Math.min(Math.floor((level - 1) / 10), 3));
  elements.plantComposition.setAttribute("aria-label", `Текущий уровень ${level}. Эвкалипт вырос до ${level < 10 ? `${level} стадии из 10` : "зрелой стадии"}, прогресс внутри уровня ${progress} процентов.`);
}

function celebrateEucalyptus() {
  elements.plantComposition.classList.remove("eucalyptus-celebrate");
  void elements.plantComposition.offsetWidth;
  elements.plantComposition.classList.add("eucalyptus-celebrate");
  setTimeout(() => elements.plantComposition.classList.remove("eucalyptus-celebrate"), 900);
}

function render() { renderFilters(); renderTasks(); renderStats(); renderWishlist(); }
function showToast(message, title = "") { clearTimeout(toastTimer); elements.toastTitle.textContent = title; elements.toastTitle.hidden = !title; elements.toastMessage.textContent = message; elements.toast.classList.add("show"); toastTimer = setTimeout(() => elements.toast.classList.remove("show"), title ? 4200 : 2600); }

function unlockReachedReward(previousLevel, newLevel) {
  const unlocked = new Set(state.unlockedRewardLevels);
  const newlyUnlocked = [];
  for (let level = previousLevel + 1; level <= newLevel; level += 1) {
    const reward = rewardTools.rewardForLevel(level);
    if (reward && !unlocked.has(level)) { unlocked.add(level); newlyUnlocked.push(reward); }
  }
  state.unlockedRewardLevels = [...unlocked].sort((a, b) => a - b);
  return newlyUnlocked[newlyUnlocked.length - 1] || null;
}

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

function restoreEmergencyProgress() {
  const emergencyState = readEmergencyBackup();
  if (!emergencyState) {
    elements.restoreEmergencyBackup.hidden = true;
    showToast("Аварийная копия не найдена или повреждена");
    return;
  }
  if (!confirm("Восстановить XP, историю и отмеченные сегодня привычки из аварийной копии? Текущие привычки и квесты останутся на месте.")) return;
  const restored = backupTools.restoreProgress(state, emergencyState, taskTools.localDateKey());
  if (!restored.ok) { showToast(`Прогресс не восстановлен: ${restored.error}`); return; }
  try {
    snapshotCurrentState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(restored.state));
    state = restored.state;
    render();
    showToast("Прогресс из аварийной копии восстановлен ✓");
  } catch (error) {
    console.warn("Не удалось восстановить аварийную копию", error);
    showToast("Не удалось сохранить восстановленный прогресс");
  }
}

function completeTask(id) {
  const previousLevel = Math.floor(state.xp / 100) + 1;
  const result = taskTools.complete(state, id);
  if (!result.ok) { if (result.reason === "already-completed") showToast("Эта привычка уже выполнена сегодня ✓"); return; }
  state = result.state; const task = result.task;
  const newLevel = Math.floor(state.xp / 100) + 1;
  const reward = unlockReachedReward(previousLevel, newLevel); saveState(); render();
  celebrateEucalyptus();
  showToast(reward ? reward.description : newLevel > previousLevel ? `Новый уровень — ${newLevel}!` : `Задание выполнено: +${task.xp} XP`, reward ? "Награда разблокирована" : "");
}

function completeDailyQuest() {
  const previousLevel = Math.floor(state.xp / 100) + 1;
  const result = dailyQuestTools.complete(state);
  if (!result.ok) { showToast("Сегодняшний квест уже выполнен ✓"); return; }
  state = result.state;
  const newLevel = Math.floor(state.xp / 100) + 1;
  const reward = unlockReachedReward(previousLevel, newLevel); saveState(); render(); celebrateEucalyptus();
  showToast(reward ? reward.description : newLevel > previousLevel ? `Новый уровень — ${newLevel}!` : `Квест дня выполнен: +${result.quest.xp} XP`, reward ? "Награда разблокирована" : "");
}

function undoHabit(id) {
  if (!confirm("Отменить выполнение этой привычки за сегодня?")) return;
  const result = taskTools.undoHabit(state, id);
  if (!result.ok) { showToast("Это выполнение уже нельзя отменить"); render(); return; }
  state = result.state; saveState(); render();
  showToast(`Выполнение отменено: −${result.task.xp} XP`);
}

elements.filters.addEventListener("click", event => { const button = event.target.closest("[data-filter]"); if (button) { activeFilter = button.dataset.filter; renderFilters(); renderTasks(); } });
elements.tasksPanel.addEventListener("click", event => {
  const dailyComplete = event.target.closest("[data-complete-daily]");
  const complete = event.target.closest("[data-complete]"), undo = event.target.closest("[data-undo]"), remove = event.target.closest("[data-delete]");
  if (dailyComplete) completeDailyQuest();
  if (complete) completeTask(complete.dataset.complete);
  if (undo) undoHabit(undo.dataset.undo);
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
elements.restoreEmergencyBackup.addEventListener("click", restoreEmergencyProgress);
elements.restoreEmergencyBackup.hidden = readEmergencyBackup() === null;

document.querySelector("#add-wish").addEventListener("click", () => elements.wishlistDialog.showModal());
document.querySelector("#close-wishlist-dialog").addEventListener("click", () => elements.wishlistDialog.close());
document.querySelector("#cancel-wishlist-dialog").addEventListener("click", () => elements.wishlistDialog.close());
elements.wishlistDialog.addEventListener("click", event => { if (event.target === elements.wishlistDialog) elements.wishlistDialog.close(); });
elements.wishlistForm.addEventListener("submit", event => {
  event.preventDefault(); const data = new FormData(elements.wishlistForm); const title = data.get("title").trim(); const level = Number(data.get("level"));
  if (!title || !Number.isInteger(level) || level < 2 || level > 10000) return;
  state.rewardWishlist.unshift({ id: makeId(), title, category: data.get("category"), level }); saveState(); renderWishlist(); elements.wishlistForm.reset(); elements.wishlistDialog.close(); showToast("Хотелка добавлена в список");
});
elements.wishlistList.addEventListener("click", event => {
  const button = event.target.closest("[data-delete-wish]"); if (!button) return;
  state.rewardWishlist = state.rewardWishlist.filter(item => item.id !== button.dataset.deleteWish); saveState(); renderWishlist(); showToast("Хотелка удалена");
});

render();
