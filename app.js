const STORAGE_KEY = "karina-level-up-v1";

const categories = {
  selfCare: { name: "Забота о себе", icon: "♡", color: "#e78cc7" },
  style: { name: "Стиль и внешность", icon: "✦", color: "#b28cff" },
  impressions: { name: "Впечатления", icon: "◉", color: "#ff9c6a" },
  growth: { name: "Развитие", icon: "◇", color: "#68b9f1" },
  energy: { name: "Энергия", icon: "ϟ", color: "#64d3aa" },
};

const starterTasks = [
  ["Прочитать 20 страниц книги", "growth", 15],
  ["Собрать красивый образ", "style", 10],
  ["30 минут без телефона", "selfCare", 15],
  ["Попробовать что-нибудь новое", "impressions", 20],
  ["Прогулка 30 минут", "energy", 15],
].map(([title, category, xp], index) => ({ id: `starter-${index}`, title, category, xp }));

let state = loadState();
let activeFilter = "all";
let toastTimer;

const elements = {
  level: document.querySelector("#level"), totalXp: document.querySelector("#total-xp"), nextLevel: document.querySelector("#next-level"),
  currentLevelXp: document.querySelector("#current-level-xp"), progressBar: document.querySelector("#progress-bar"), streak: document.querySelector("#streak"),
  streakLabel: document.querySelector("#streak-label"), completedCount: document.querySelector("#completed-count"), taskList: document.querySelector("#task-list"),
  historyList: document.querySelector("#history-list"), emptyTasks: document.querySelector("#empty-tasks"), emptyHistory: document.querySelector("#empty-history"),
  filters: document.querySelector("#category-filters"), dialog: document.querySelector("#task-dialog"), form: document.querySelector("#task-form"),
  title: document.querySelector("#task-title"), category: document.querySelector("#task-category"), toast: document.querySelector("#toast"),
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.tasks) && Array.isArray(saved.history)) return saved;
  } catch (error) { console.warn("Не удалось прочитать сохранение", error); }
  return { tasks: starterTasks, history: [], xp: 0 };
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
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
  elements.taskList.innerHTML = tasks.map(task => { const category = categories[task.category]; return `
    <article class="task-card">
      <button class="complete-button" data-complete="${task.id}" type="button" aria-label="Выполнить задание «${escapeHtml(task.title)}»">✓</button>
      <div class="task-main"><h3>${escapeHtml(task.title)}</h3><span class="category-badge" style="color:${category.color}">${category.icon} ${category.name}</span></div>
      <span class="xp-badge">+${task.xp} XP</span>
      <button class="delete-button" data-delete="${task.id}" type="button" aria-label="Удалить задание «${escapeHtml(task.title)}»">×</button>
    </article>`; }).join("");
  elements.emptyTasks.hidden = tasks.length > 0;
}

function renderHistory() {
  elements.historyList.innerHTML = state.history.slice(0, 8).map(item => `
    <article class="history-item"><span class="history-check">✓</span><div class="history-copy"><h3>${escapeHtml(item.title)}</h3><time datetime="${item.completedAt}">${new Intl.DateTimeFormat("ru-RU", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" }).format(new Date(item.completedAt))}</time></div><span class="history-xp">+${item.xp} XP</span></article>`).join("");
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

function completeTask(id) {
  const index = state.tasks.findIndex(task => task.id === id); if (index < 0) return;
  const [task] = state.tasks.splice(index, 1); const previousLevel = Math.floor(state.xp / 100) + 1;
  state.xp += task.xp; state.history.unshift({ ...task, completedAt: new Date().toISOString() }); saveState(); render();
  const newLevel = Math.floor(state.xp / 100) + 1;
  showToast(newLevel > previousLevel ? `Новый уровень — ${newLevel}! 🎉` : `Задание выполнено: +${task.xp} XP ✦`);
}

elements.filters.addEventListener("click", event => { const button = event.target.closest("[data-filter]"); if (button) { activeFilter = button.dataset.filter; renderFilters(); renderTasks(); } });
elements.taskList.addEventListener("click", event => {
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
  state.tasks.unshift({ id: makeId(), title, category: data.get("category"), xp }); saveState(); activeFilter = "all"; render();
  elements.form.reset(); elements.dialog.close(); showToast("Новое задание добавлено ✦");
});

render();
