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
  assert.equal(result.state.dataVersion, 1);
  assert.equal(result.state.xp, 115);
  assert.equal(result.state.history[0].title, "Готово");
  assert.equal(result.state.tasks[0].title, "Моё задание");
  assert.equal(result.state.userPreference, "сохраняется");
});

test("exports and imports a complete versioned backup", () => {
  const exported = backup.createBackup(legacyState, "2026-09-09T10:00:00.000Z");
  assert.deepEqual(backup.parseBackup(JSON.parse(JSON.stringify(exported))).state, exported.state);
  assert.equal(exported.formatVersion, 1);
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
