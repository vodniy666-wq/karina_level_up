(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.KarinaTasks = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  function isCompletedToday(task, date = new Date()) { return task.type === "habit" && task.lastCompletedOn === localDateKey(date); }
  function complete(state, id, date = new Date()) {
    const index = state.tasks.findIndex(task => task.id === id);
    if (index < 0) return { ok: false, reason: "missing", state };
    const task = state.tasks[index];
    if (isCompletedToday(task, date)) return { ok: false, reason: "already-completed", state };
    const completedAt = date.toISOString();
    const completed = { ...task, completedAt };
    let tasks;
    if (task.type === "habit") {
      completed.lastCompletedOn = localDateKey(date);
      tasks = state.tasks.map(item => item.id === id ? { ...item, lastCompletedOn: completed.lastCompletedOn } : item);
    } else tasks = state.tasks.filter(item => item.id !== id);
    return { ok: true, task, state: { ...state, tasks, xp: state.xp + task.xp, history: [completed, ...state.history] } };
  }
  function undoHabit(state, id, date = new Date()) {
    const today = localDateKey(date);
    const taskIndex = state.tasks.findIndex(task => task.id === id);
    if (taskIndex < 0) return { ok: false, reason: "missing", state };
    const task = state.tasks[taskIndex];
    if (task.type !== "habit" || task.lastCompletedOn !== today) return { ok: false, reason: "not-completed-today", state };
    const historyIndex = state.history.findIndex(item => item.id === id && item.type === "habit" && item.lastCompletedOn === today);
    if (historyIndex < 0) return { ok: false, reason: "completion-missing", state };
    const completion = state.history[historyIndex];
    const tasks = state.tasks.map(item => item.id === id ? { ...item, lastCompletedOn: undefined } : item);
    const history = state.history.filter((item, index) => index !== historyIndex);
    return { ok: true, task, state: { ...state, tasks, xp: state.xp - completion.xp, history } };
  }
  return { localDateKey, isCompletedToday, complete, undoHabit };
});
