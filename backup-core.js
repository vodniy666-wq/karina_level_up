(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.KarinaBackup = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const DATA_VERSION = 2, BACKUP_FORMAT_VERSION = 1, APP_ID = "karina-level-up";
  const VALID_CATEGORIES = new Set(["selfCare", "style", "impressions", "growth", "energy"]);
  const VALID_TYPES = new Set(["habit", "quest"]);
  const DEFAULT_TASKS = [
    { id: "daily-morning-work", title: "Утро-ворк", category: "selfCare", xp: 5, type: "habit" },
    { id: "daily-main-workout", title: "Основная тренировка", category: "energy", xp: 10, type: "habit" },
    { id: "daily-reading", title: "Чтение книги 30 минут", category: "growth", xp: 10, type: "habit" },
    { id: "daily-self-care", title: "Уход за собой", category: "style", xp: 5, type: "habit" },
    { id: "starter-new-place", title: "Зайти после работы в место, где я раньше не была, и провести там хотя бы 10 минут", category: "impressions", xp: 20, type: "quest" },
  ];
  const isPlainObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const isDateKey = value => value === undefined || /^\d{4}-\d{2}-\d{2}$/.test(value);
  const isValidTask = task => isPlainObject(task)
    && typeof task.id === "string" && task.id.length > 0 && task.id.length <= 200
    && typeof task.title === "string" && task.title.trim().length > 0 && task.title.length <= 160
    && VALID_CATEGORIES.has(task.category) && VALID_TYPES.has(task.type)
    && isDateKey(task.lastCompletedOn)
    && Number.isInteger(task.xp) && task.xp >= 1 && task.xp <= 100;

  function validateState(value) {
    if (!isPlainObject(value)) return { ok: false, error: "Состояние должно быть объектом." };
    if (value.dataVersion !== DATA_VERSION) return { ok: false, error: "Версия данных не поддерживается." };
    if (!Array.isArray(value.tasks) || !value.tasks.every(isValidTask)) return { ok: false, error: "Некорректный список заданий." };
    if (!Array.isArray(value.history) || !value.history.every(item => isValidTask(item) && typeof item.completedAt === "string" && Number.isFinite(Date.parse(item.completedAt)))) return { ok: false, error: "Некорректная история выполнений." };
    if (!Number.isInteger(value.xp) || value.xp < 0 || value.xp > Number.MAX_SAFE_INTEGER) return { ok: false, error: "Некорректное значение XP." };
    const ids = value.tasks.map(task => task.id);
    if (new Set(ids).size !== ids.length) return { ok: false, error: "Идентификаторы заданий повторяются." };
    return { ok: true };
  }

  function migrateState(value) {
    if (!isPlainObject(value)) return { ok: false, error: "Состояние должно быть объектом." };
    if (value.dataVersion !== undefined && value.dataVersion !== 1 && value.dataVersion !== DATA_VERSION) return { ok: false, error: "Версия данных не поддерживается." };
    if (!Array.isArray(value.tasks) || !Array.isArray(value.history)) return { ok: false, error: "Некорректный список заданий." };
    const wasLegacy = value.dataVersion !== DATA_VERSION;
    const normalize = item => ({ ...item, type: VALID_TYPES.has(item.type) ? item.type : "quest" });
    let tasks = value.tasks.map(normalize);
    const history = value.history.map(normalize);
    if (wasLegacy) {
      const knownIds = new Set([...tasks, ...history].map(item => item.id));
      tasks = [...DEFAULT_TASKS.filter(task => !knownIds.has(task.id)), ...tasks];
    }
    const state = { ...value, tasks, history, dataVersion: DATA_VERSION };
    const validation = validateState(state);
    return validation.ok ? { ok: true, state } : validation;
  }
  function createBackup(state, createdAt = new Date().toISOString()) {
    const migrated = migrateState(state);
    if (!migrated.ok) throw new Error(migrated.error);
    return { app: APP_ID, formatVersion: BACKUP_FORMAT_VERSION, createdAt, state: migrated.state };
  }
  function parseBackup(value) {
    if (!isPlainObject(value) || value.app !== APP_ID || value.formatVersion !== BACKUP_FORMAT_VERSION || typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt))) return { ok: false, error: "Это не резервная копия приложения «Карина прокачивается»." };
    return migrateState(value.state);
  }
  function addLocalSnapshot(snapshots, value, maximum = 5) {
    const migrated = migrateState(value);
    if (!migrated.ok) return Array.isArray(snapshots) ? snapshots : [];
    const existing = Array.isArray(snapshots) ? snapshots : [];
    const serialized = JSON.stringify(migrated.state);
    if (existing.some(item => JSON.stringify(item) === serialized)) return existing;
    return [migrated.state, ...existing].slice(0, maximum);
  }
  function findLatestValidSnapshot(snapshots) {
    if (!Array.isArray(snapshots)) return null;
    for (const snapshot of snapshots) { const migrated = migrateState(snapshot); if (migrated.ok) return migrated.state; }
    return null;
  }
  return { DATA_VERSION, BACKUP_FORMAT_VERSION, APP_ID, DEFAULT_TASKS, validateState, migrateState, createBackup, parseBackup, addLocalSnapshot, findLatestValidSnapshot };
});
