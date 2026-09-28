const test = require("node:test");
const assert = require("node:assert/strict");
const dailyQuests = require("../daily-quest-core.js");

const baseState = { xp: 40, history: [], tasks: [], dailyQuest: { recentlyUsedIds: [] } };

test("keeps the selected quest for the whole local calendar day", () => {
  const morning = dailyQuests.selectForToday(baseState, new Date(2026, 8, 28, 8), () => 0.5);
  const evening = dailyQuests.selectForToday(morning.state, new Date(2026, 8, 28, 22), () => 0.9);
  assert.equal(morning.changed, true);
  assert.equal(evening.changed, false);
  assert.equal(evening.quest.id, morning.quest.id);
  assert.strictEqual(evening.state, morning.state);
});

test("does not repeat quests until the entire pool has been shown", () => {
  let state = baseState;
  const shown = [];
  for (let day = 1; day <= dailyQuests.QUESTS.length; day += 1) {
    const result = dailyQuests.selectForToday(state, new Date(2026, 0, day, 12), () => 0);
    state = result.state;
    shown.push(result.quest.id);
  }
  assert.equal(new Set(shown).size, dailyQuests.QUESTS.length);
  const restarted = dailyQuests.selectForToday(state, new Date(2026, 1, 1, 12), () => 0);
  assert.equal(restarted.state.dailyQuest.recentlyUsedIds.length, 1);
});

test("daily quest awards XP once, enters history, and remains completed that day", () => {
  const selected = dailyQuests.selectForToday(baseState, new Date(2026, 8, 28, 9), () => 0);
  const completed = dailyQuests.complete(selected.state, new Date(2026, 8, 28, 10));
  assert.equal(completed.ok, true);
  assert.equal(completed.state.xp, 40 + selected.quest.xp);
  assert.equal(completed.state.history[0].title, selected.quest.title);
  assert.equal(completed.state.dailyQuest.completedOn, "2026-09-28");
  const duplicate = dailyQuests.complete(completed.state, new Date(2026, 8, 28, 20));
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.state.xp, completed.state.xp);
});
