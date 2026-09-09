const test = require("node:test");
const assert = require("node:assert/strict");
const backup = require("../backup-core.js");

const legacyState = {
  tasks: [{ id: "custom-1", title: "Моё задание", category: "growth", xp: 25 }],
  history: [{ id: "done-1", title: "Готово", category: "energy", xp: 15, completedAt: "2026-09-08T12:00:00.000Z" }],
  xp: 115,
  userPreference: "сохраняется",
};

test("loads and versions existing unversioned state without losing fields", () => {
  const result = backup.migrateState(JSON.parse(JSON.stringify(legacyState)));
  assert.equal(result.ok, true);
  assert.equal(result.state.dataVersion, 3);
  assert.equal(result.state.xp, 115);
  assert.equal(result.state.history[0].title, "Готово");
  assert.equal(result.state.tasks.find(task => task.id === "custom-1").title, "Моё задание");
  assert.equal(result.state.tasks.find(task => task.id === "custom-1").type, "quest");
  assert.equal(result.state.tasks.filter(task => task.type === "habit").length, 5);
  assert.equal(result.state.userPreference, "сохраняется");
});

test("adds Clean Day to existing saves and preserves it in backups", () => {
  const state = backup.migrateState({ ...legacyState, dataVersion: 2 }).state;
  const cleanDay = state.tasks.find(task => task.id === "daily-clean-day");
  assert.deepEqual(cleanDay, { id: "daily-clean-day", title: "Чистый день", subtitle: "Сегодня без алкоголя", category: "selfCare", xp: 10, type: "habit" });
  assert.deepEqual(backup.parseBackup(backup.createBackup(state)).state.tasks.find(task => task.id === cleanDay.id), cleanDay);
});

test("does not restore other default tasks that were removed before version 3", () => {
  const state = backup.migrateState({ ...legacyState, dataVersion: 2 }).state;
  assert.deepEqual(state.tasks.map(task => task.id), ["daily-clean-day", "custom-1"]);
});

test("one-time reset clears progress but keeps active tasks and settings", () => {
  const before = backup.migrateState({ ...legacyState, dataVersion: 2, tasks: [{ ...legacyState.tasks[0], type: "habit", lastCompletedOn: "2026-09-09" }] }).state;
  const result = backup.applyOneTimeProgressReset(before);
  assert.equal(result.ok, true);
  assert.equal(result.state.xp, 0);
  assert.deepEqual(result.state.history, []);
  assert.equal(result.state.userPreference, "сохраняется");
  assert.equal(result.state.tasks.some(task => task.id === "custom-1"), true);
  assert.equal(result.state.tasks.some(task => task.lastCompletedOn), false);
  assert.equal(result.state.completedMigrations[backup.PROGRESS_RESET_ID], true);
  assert.deepEqual(backup.applyOneTimeProgressReset(result.state).state, result.state);
});

test("exports and imports a complete versioned backup", () => {
  const exported = backup.createBackup(legacyState, "2026-09-09T10:00:00.000Z");
  assert.deepEqual(backup.parseBackup(JSON.parse(JSON.stringify(exported))).state, exported.state);
  assert.equal(exported.formatVersion, 1);
});

test("backup keeps habit type and its last completion day", () => {
  const state = backup.migrateState(legacyState).state;
  const habit = state.tasks.find(task => task.type === "habit");
  habit.lastCompletedOn = "2026-09-09";
  const restored = backup.parseBackup(backup.createBackup(state)).state;
  assert.equal(restored.tasks.find(task => task.id === habit.id).lastCompletedOn, "2026-09-09");
});

test("rejects damaged and foreign backups without producing state", () => {
  assert.equal(backup.parseBackup({ app: "another-app", formatVersion: 1 }).ok, false);
  const damaged = backup.createBackup(legacyState);
  damaged.state.xp = -10;
  assert.equal(backup.parseBackup(damaged).ok, false);
});

test("rejects malformed tasks and history", () => {
  assert.equal(backup.migrateState({ ...legacyState, tasks: [{ title: "Нет id" }] }).ok, false);
  assert.equal(backup.migrateState({ ...legacyState, history: [{ ...legacyState.history[0], completedAt: "not-a-date" }] }).ok, false);
});

test("keeps five unique local snapshots and recovers the newest valid one", () => {
  let snapshots = [];
  for (let xp = 0; xp < 7; xp += 1) snapshots = backup.addLocalSnapshot(snapshots, { ...legacyState, xp });
  assert.equal(snapshots.length, 5);
  assert.equal(snapshots[0].xp, 6);
  assert.equal(snapshots[4].xp, 2);
  assert.strictEqual(backup.addLocalSnapshot(snapshots, { ...legacyState, xp: 6 }), snapshots);
  assert.equal(backup.findLatestValidSnapshot([{ ...legacyState, xp: -1 }, ...snapshots]).xp, 6);
});
