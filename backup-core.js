(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.KarinaBackup = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const DATA_VERSION = 1, BACKUP_FORMAT_VERSION = 1, APP_ID = "karina-level-up";
  const VALID_CATEGORIES = new Set(["selfCare", "style", "impressions", "growth", "energy"]);
  const isPlainObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const isValidTask = task => isPlainObject(task)
    && typeof task.id === "string" && task.id.length > 0 && task.id.length <= 200
    && typeof task.title === "string" && task.title.trim().length > 0 && task.title.length <= 80
    && VALID_CATEGORIES.has(task.category)
    && Number.isInteger(task.xp) && task.xp >= 1 && task.xp <= 100;

  function validateState(value) {
    if (!isPlainObject(value)) return { ok: false, error: "Состояние должно быть объектом." };
    if (value.dataVersion !== undefined && value.dataVersion !== DATA_VERSION) return { ok: false, error: "Версия данных не поддерживается." };
    if (!Array.isArray(value.tasks) || !value.tasks.every(isValidTask)) return { ok: false, error: "Некорректный список заданий." };
    if (!Array.isArray(value.history) || !value.history.every(item => isValidTask(item) && typeof item.completedAt === "string" && Number.isFinite(Date.parse(item.completedAt)))) return { ok: false, error: "Некорректная история выполнений." };
    if (!Number.isInteger(value.xp) || value.xp < 0 || value.xp > Number.MAX_SAFE_INTEGER) return { ok: false, error: "Некорректное значение XP." };
    const ids = value.tasks.map(task => task.id);
    if (new Set(ids).size !== ids.length) return { ok: false, error: "Идентификаторы заданий повторяются." };
    return { ok: true };
  }
  function migrateState(value) {
    const validation = validateState(value);
    return validation.ok ? { ok: true, state: { ...value, dataVersion: DATA_VERSION } } : validation;
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
    for (const snapshot of snapshots) {
      const migrated = migrateState(snapshot);
      if (migrated.ok) return migrated.state;
    }
    return null;
  }
  return { DATA_VERSION, BACKUP_FORMAT_VERSION, APP_ID, validateState, migrateState, createBackup, parseBackup, addLocalSnapshot, findLatestValidSnapshot };
});
