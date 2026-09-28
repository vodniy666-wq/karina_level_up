const test = require("node:test");
const assert = require("node:assert/strict");
const rewards = require("../reward-core.js");

test("defines rewards for levels 2–10", () => {
  for (let level = 2; level <= 10; level += 1) assert.ok(rewards.rewardForLevel(level));
  assert.equal(rewards.rewardForLevel(11), null);
});

test("uses notable rewards every 5 levels and big rewards every 10", () => {
  assert.equal(rewards.rewardForLevel(15).size, "notable");
  assert.equal(rewards.rewardForLevel(20).size, "big");
  assert.equal(rewards.nextReward(10).level, 15);
  assert.equal(rewards.nextReward(15).level, 20);
});
