const test = require("node:test");
const assert = require("node:assert/strict");
const tasks = require("../task-core.js");

const baseState = {
  xp: 0,
  history: [],
  tasks: [
    { id: "habit", title: "Привычка", category: "energy", xp: 10, type: "habit" },
    { id: "quest", title: "Квест", category: "impressions", xp: 20, type: "quest" },
  ],
};

test("habit awards XP once per local calendar day and returns the next day", () => {
  const first = tasks.complete(baseState, "habit", new Date(2026, 8, 9, 10));
  assert.equal(first.ok, true);
  assert.equal(first.state.xp, 10);
  assert.equal(first.state.tasks.length, 2);
  assert.equal(first.state.history[0].type, "habit");
  const duplicate = tasks.complete(first.state, "habit", new Date(2026, 8, 9, 22));
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.state.xp, 10);
  const nextDay = tasks.complete(first.state, "habit", new Date(2026, 8, 10, 0, 1));
  assert.equal(nextDay.ok, true);
  assert.equal(nextDay.state.xp, 20);
  assert.equal(nextDay.state.history.length, 2);
});

test("quest moves to history and never returns", () => {
  const result = tasks.complete(baseState, "quest", new Date(2026, 8, 9, 10));
  assert.equal(result.ok, true);
  assert.equal(result.state.xp, 20);
  assert.equal(result.state.tasks.some(task => task.id === "quest"), false);
  assert.equal(result.state.history[0].type, "quest");
  assert.equal(tasks.complete(result.state, "quest").reason, "missing");
});
