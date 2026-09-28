(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.KarinaRewards = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const REWARDS = {
    2: "Любимый кофе, десерт или небольшая приятность",
    3: "Маленькая приятность до 500 ₽",
    4: "Вечер для себя без обязательных дел",
    5: "Маленький подарок себе до 1 500 ₽",
    6: "Сходить в новое приятное место",
    7: "Небольшая вещь для внешности, стиля или дома",
    8: "Полдня провести так, как хочется",
    9: "Положить условную сумму в «фонд хотелки»",
    10: "Полноценный подарок себе или впечатление из wishlist",
  };

  function rewardForLevel(level) {
    if (REWARDS[level]) return { level, description: REWARDS[level], size: level === 10 ? "big" : "regular" };
    if (level > 10 && level % 10 === 0) return { level, description: "Большая milestone-награда: значимая хотелка или впечатление", size: "big" };
    if (level > 10 && level % 5 === 0) return { level, description: "Более заметная награда: вещь или день впечатлений", size: "notable" };
    return null;
  }

  function nextReward(currentLevel) {
    let level = Math.max(2, currentLevel + 1);
    while (!rewardForLevel(level)) level += 1;
    return rewardForLevel(level);
  }

  function rewardsThrough(level) {
    const result = [];
    for (let candidate = 2; candidate <= level; candidate += 1) {
      if (rewardForLevel(candidate)) result.push(candidate);
    }
    return result;
  }

  return { REWARDS, rewardForLevel, nextReward, rewardsThrough };
});
