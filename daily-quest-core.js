(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.KarinaDailyQuests = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const QUESTS = [
    { id: "photo-hunt", title: "Фотоохота", subtitle: "Найди и сфотографируй 3 красивые или необычные детали вокруг себя.", xp: 20 },
    { id: "new-taste", title: "Новый вкус", subtitle: "Попробуй продукт, напиток или блюдо, которое раньше не пробовала.", xp: 20 },
    { id: "different-route", title: "Другой маршрут", subtitle: "Пройди хотя бы часть привычного пути новой дорогой.", xp: 20 },
    { id: "new-home-corner", title: "Новый угол дома", subtitle: "За 10–15 минут сделай приятнее одно маленькое место дома.", xp: 20 },
    { id: "three-new-tracks", title: "Три новых трека", subtitle: "Послушай три песни незнакомого или почти незнакомого исполнителя.", xp: 15 },
    { id: "forgotten-clothes", title: "Вещь из забвения", subtitle: "Составь образ с вещью, которую давно не носила.", xp: 20 },
    { id: "phone-free-walk", title: "Маленькая прогулка без телефона", subtitle: "Погуляй без телефона хотя бы 15 минут.", xp: 20 },
    { id: "new-place", title: "Зайти туда, где не была", subtitle: "Загляни в новый магазин, кофейню, двор, парк или любое другое место.", xp: 25 },
    { id: "beautiful-meal", title: "Красивый завтрак или ужин", subtitle: "Сервируй обычную еду чуть красивее, чем обычно.", xp: 15 },
    { id: "new-drink", title: "Новый напиток", subtitle: "Приготовь или закажи что-нибудь непривычное.", xp: 15 },
    { id: "one-shot", title: "Один кадр дня", subtitle: "Сделай фотографию, которая лучше всего описывает сегодняшний день.", xp: 10 },
    { id: "micro-reshuffle", title: "Микроперестановка", subtitle: "Поменяй местами несколько вещей дома и посмотри, стало ли лучше.", xp: 15 },
    { id: "new-outfit-combination", title: "Новая комбинация", subtitle: "Соедини в одном образе две вещи, которые раньше вместе не носила.", xp: 20 },
    { id: "curiosity-15", title: "15 минут любопытства", subtitle: "Почитай или посмотри что-нибудь на совершенно новую тему.", xp: 15 },
    { id: "explore-neighborhood", title: "Познакомиться с районом", subtitle: "Заметь рядом с домом или работой место, которого раньше не замечала.", xp: 20 },
    { id: "small-aesthetic", title: "Маленькая эстетика", subtitle: "Сделай красивее один повседневный момент: чай, рабочий стол, ванную или кровать.", xp: 15 },
    { id: "random-choice", title: "Случайный выбор", subtitle: "Выбери фильм, музыку или блюдо случайно из нескольких вариантов.", xp: 10 },
    { id: "compliment", title: "Комплимент", subtitle: "Искренне похвали кого-нибудь за конкретную вещь.", xp: 10 },
    { id: "write-first", title: "Написать первой", subtitle: "Напиши человеку, с которым давно не общалась, но которого приятно вспомнить.", xp: 20 },
    { id: "observe-five", title: "Пять минут наблюдения", subtitle: "Посиди у окна или на улице и заметь пять деталей вокруг.", xp: 10 },
    { id: "small-creativity", title: "Маленькое творчество", subtitle: "Что-нибудь нарисуй, оформи, сфотографируй или собери без требования к результату.", xp: 20 },
    { id: "save-idea", title: "Сохранить идею", subtitle: "Найди идею для дома, одежды, поездки или досуга, которую реально хочется попробовать.", xp: 15 },
    { id: "new-flavor-combination", title: "Новое сочетание вкусов", subtitle: "Попробуй необычно скомбинировать два привычных продукта.", xp: 15 },
    { id: "mini-declutter", title: "Мини-разбор", subtitle: "Разбери один ящик, полку, косметичку или сумку.", xp: 20 },
    { id: "intentional-evening", title: "Вечер без автопилота", subtitle: "Хотя бы 20 минут не листай привычные соцсети, а выбери другое занятие.", xp: 20 },
    { id: "small-luxury", title: "Одна маленькая роскошь", subtitle: "Сделай обычную вещь приятнее: хороший чай, маска, свеча, музыка или красивое бельё.", xp: 15 },
    { id: "new-genre", title: "Новый жанр", subtitle: "Посмотри или почитай что-нибудь в жанре, который обычно не выбираешь.", xp: 25 },
    { id: "style-experiment", title: "Мини-эксперимент со стилем", subtitle: "Добавь в обычный образ один непривычный элемент.", xp: 20 },
    { id: "make-by-hand", title: "Что-то руками", subtitle: "Сделай маленькую вещь сама: приготовь, почини, переставь, оформи или собери.", xp: 25 },
    { id: "small-yes", title: "Маленькое «да»", subtitle: "Согласись на небольшую спонтанную идею, если она безопасна и действительно хочется.", xp: 20 },
  ].map(quest => ({ ...quest, category: "impressions", type: "quest" }));

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function selectForToday(state, date = new Date(), random = Math.random) {
    const today = localDateKey(date);
    const saved = state.dailyQuest || {};
    const questById = new Map(QUESTS.map(quest => [quest.id, quest]));
    if (saved.date === today && questById.has(saved.questId)) return { state, quest: questById.get(saved.questId), changed: false };

    let recentlyUsedIds = Array.isArray(saved.recentlyUsedIds)
      ? [...new Set(saved.recentlyUsedIds.filter(id => questById.has(id)))]
      : [];
    let available = QUESTS.filter(quest => !recentlyUsedIds.includes(quest.id));
    if (!available.length) { recentlyUsedIds = []; available = QUESTS; }
    const index = Math.min(Math.floor(random() * available.length), available.length - 1);
    const quest = available[Math.max(0, index)];
    const dailyQuest = { date: today, questId: quest.id, recentlyUsedIds: [...recentlyUsedIds, quest.id] };
    return { state: { ...state, dailyQuest }, quest, changed: true };
  }

  function complete(state, date = new Date()) {
    const selected = selectForToday(state, date);
    const today = localDateKey(date);
    if (selected.state.dailyQuest.completedOn === today) return { ok: false, reason: "already-completed", state: selected.state };
    const completed = { ...selected.quest, id: `daily-${today}-${selected.quest.id}`, completedAt: date.toISOString() };
    return {
      ok: true,
      quest: selected.quest,
      state: {
        ...selected.state,
        xp: selected.state.xp + selected.quest.xp,
        history: [completed, ...selected.state.history],
        dailyQuest: { ...selected.state.dailyQuest, completedOn: today },
      },
    };
  }

  return { QUESTS, localDateKey, selectForToday, complete };
});
