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

test("today's habit completion can be undone without touching earlier or unrelated progress", () => {
  const yesterday = new Date(2026, 8, 9, 10);
  const today = new Date(2026, 8, 10, 10);
  const yesterdayResult = tasks.complete(baseState, "habit", yesterday);
  const questResult = tasks.complete(yesterdayResult.state, "quest", yesterday);
  const todayResult = tasks.complete(questResult.state, "habit", today);

  const undone = tasks.undoHabit(todayResult.state, "habit", today);
  assert.equal(undone.ok, true);
  assert.equal(undone.state.xp, 30);
  assert.equal(undone.state.history.length, 2);
  assert.equal(undone.state.history.filter(item => item.id === "habit").length, 1);
  assert.equal(undone.state.history.some(item => item.id === "quest"), true);
  assert.equal(undone.state.tasks.find(task => task.id === "habit").lastCompletedOn, undefined);

  const repeatedUndo = tasks.undoHabit(undone.state, "habit", today);
  assert.equal(repeatedUndo.ok, false);
  assert.equal(repeatedUndo.reason, "not-completed-today");
  const completedAgain = tasks.complete(undone.state, "habit", today);
  assert.equal(completedAgain.ok, true);
  assert.equal(completedAgain.state.xp, 40);
});

test("habit completion cannot be undone on a later day", () => {
  const completed = tasks.complete(baseState, "habit", new Date(2026, 8, 9, 23, 59));
  const result = tasks.undoHabit(completed.state, "habit", new Date(2026, 8, 10, 0, 1));
  assert.equal(result.ok, false);
  assert.strictEqual(result.state, completed.state);
});
