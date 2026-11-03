import { describe, expect, it } from "vitest";
import { advanceDaily, currentStreak, dailyModifier, dailyPlan, dailySeed, emptyDaily, previousDate, utcDate } from "./daily";
import { canBuyPerk, clampPerks, MAX_SHARDS_PER_RUN, MAX_TOTAL_RANKS, META_PERKS, perkCost, shardsForRun, totalRanks } from "./data/metaPerks";
import { MAX_SCORE_MULT, MODIFIERS, rewardMults } from "./data/modifiers";
import { ALL_UNLOCK_IDS, heroAvailable, lockedTools, unlockedIds } from "./data/unlocks";
import { CHARACTERS } from "./data/characters";
import { DIFFICULTY } from "./data/difficulty";
import { defaultSetup, isRanked, runEffects, type RunSetup } from "./game/runSetup";
import { headlessGame, startRun, stepSeconds } from "./test/harness";
import * as save from "./save";
import type { CharacterId } from "./types";

function withStorage<T>(fn: (data: Record<string, string>) => T): T {
  const data: Record<string, string> = {};
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { value: { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => (data[k] = v) }, configurable: true });
  try {
    return fn(data);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
}

function gameWith(setup: Partial<RunSetup>, hero: CharacterId = "keel") {
  const game = headlessGame();
  game.runPlan = { setup: { ...defaultSetup(), ...setup }, hero, difficulty: "normal", seed: 99 };
  startRun(game);
  return game;
}

describe("daily seed", () => {
  it("is stable for a date and differs between dates", () => {
    expect(dailySeed("2026-11-03")).toBe(2038056105);
    expect(dailySeed("2026-11-04")).toBe(304481934);
    expect(dailyPlan("2026-11-03")).toMatchObject({ seed: 2038056105, hero: "nyx", difficulty: "normal", setup: { mods: ["inflation"], perks: {}, mode: "daily", date: "2026-11-03" } });
    expect(dailyPlan("2026-11-03")).toEqual(dailyPlan("2026-11-03"));
    const seeds = new Set(Array.from({ length: 60 }, (_, i) => dailySeed(utcDate(Date.UTC(2026, 0, 1) + i * 86_400_000))));
    expect(seeds.size).toBe(60);
  });

  it("rotates heroes and contracts across a month", () => {
    const dates = Array.from({ length: 31 }, (_, i) => utcDate(Date.UTC(2026, 6, 1) + i * 86_400_000));
    expect(new Set(dates.map((d) => dailyPlan(d).hero)).size).toBe(CHARACTERS.length);
    expect(new Set(dates.map(dailyModifier)).size).toBeGreaterThan(4);
  });

  it("uses the UTC date and gives every player the same unlocks and no perks", () => {
    expect(utcDate(Date.UTC(2026, 10, 3, 23, 59))).toBe("2026-11-03");
    expect(previousDate("2026-03-01")).toBe("2026-02-28");
    const plan = dailyPlan("2026-11-03");
    expect(plan.setup.unlocked).toEqual(ALL_UNLOCK_IDS);
    expect(isRanked(plan.setup)).toBe(true);
  });

  it("tracks best score per day and a consecutive-day streak", () => {
    let d = advanceDaily(emptyDaily(), "2026-11-01", 500);
    d = advanceDaily(d, "2026-11-01", 300);
    expect(d).toMatchObject({ date: "2026-11-01", best: 500, streak: 1, plays: 2 });
    d = advanceDaily(d, "2026-11-02", 200);
    d = advanceDaily(d, "2026-11-03", 900);
    expect(d).toMatchObject({ best: 900, streak: 3, bestStreak: 3, bestEver: 900 });
    expect(advanceDaily(d, "2026-11-01", 5000)).toBe(d);
    d = advanceDaily(d, "2026-11-06", 100);
    expect(d).toMatchObject({ streak: 1, bestStreak: 3, best: 100, bestEver: 900 });
    expect(currentStreak(d, "2026-11-07")).toBe(1);
    expect(currentStreak(d, "2026-11-09")).toBe(0);
  });
});

describe("bounty shards", () => {
  it("pays for time, score and bosses, scaled by contracts", () => {
    expect(shardsForRun({ timeSec: 600, baseScore: 9000, bosses: 2, tainted: false, shardMult: 1 })).toBe(20 + 6 + 8);
    expect(shardsForRun({ timeSec: 600, baseScore: 9000, bosses: 2, tainted: false, shardMult: 1.5 })).toBe(51);
    expect(shardsForRun({ timeSec: 20, baseScore: 200, bosses: 0, tainted: false, shardMult: 1 })).toBe(0);
    expect(shardsForRun({ timeSec: 1e7, baseScore: 1e9, bosses: 99, tainted: false, shardMult: 3 })).toBe(MAX_SHARDS_PER_RUN);
  });

  it("pays nothing for tainted runs", () => {
    expect(shardsForRun({ timeSec: 1200, baseScore: 50000, bosses: 6, tainted: true, shardMult: 2 })).toBe(0);
  });

  it("are awarded at run end and not for a debug-tainted run", () => {
    withStorage(() => {
      const game = gameWith({});
      stepSeconds(game, 70);
      const before = save.get().meta.shards;
      game.postMortem();
      const earned = game.reward!.shards;
      expect(earned).toBeGreaterThan(0);
      expect(save.get().meta.shards).toBe(before + earned);
      game.postMortem();
      expect(save.get().meta.shards).toBe(before + earned);
      const cheat = gameWith({});
      cheat.god = true;
      stepSeconds(cheat, 70);
      cheat.postMortem();
      expect(save.get().meta.shards).toBe(before + earned);
    });
  });
});

describe("meta perks", () => {
  it("has 6-8 small perks with rising costs", () => {
    expect(META_PERKS.length).toBeGreaterThanOrEqual(6);
    expect(META_PERKS.length).toBeLessThanOrEqual(8);
    for (const p of META_PERKS) for (let r = 1; r < p.maxRank; r++) expect(perkCost(p.id, r)).toBeGreaterThan(perkCost(p.id, r - 1));
    expect(META_PERKS.reduce((n, p) => n + p.maxRank, 0)).toBeGreaterThan(MAX_TOTAL_RANKS);
  });

  it("enforces a hard total cap in the shop, in saves and in the sim", () => {
    const greedy = Object.fromEntries(META_PERKS.map((p) => [p.id, p.maxRank]));
    const clamped = clampPerks(greedy);
    expect(totalRanks(clamped)).toBe(MAX_TOTAL_RANKS);
    expect(canBuyPerk(clamped, 1e9, "alpha")).toMatchObject({ ok: false, reason: "cap" });
    expect(canBuyPerk({ edge: 5 }, 1e9, "edge")).toMatchObject({ ok: false, reason: "max-rank" });
    expect(canBuyPerk({}, 5, "edge")).toMatchObject({ ok: false, reason: "shards" });
    expect(clampPerks({ edge: -2, vault: 2.7, nope: 3, alpha: "4" })).toEqual({ vault: 2 });
    const fx = runEffects("normal", { ...defaultSetup(), perks: greedy });
    const capped = runEffects("normal", { ...defaultSetup(), perks: clamped });
    expect(fx).toEqual(capped);
  });

  it("buys, spends shards, stops at the cap and refunds in full", () => {
    withStorage(() => {
      save.awardShards(100_000);
      const start = save.get().meta.shards;
      let bought = 0;
      for (const p of META_PERKS) for (let r = 0; r < p.maxRank; r++) if (save.buyPerk(p.id)) bought++;
      expect(bought).toBe(MAX_TOTAL_RANKS);
      expect(totalRanks(save.get().meta.perks)).toBe(MAX_TOTAL_RANKS);
      const spent = start - save.get().meta.shards;
      expect(spent).toBeGreaterThan(0);
      expect(save.refundPerks()).toBe(spent);
      expect(save.get().meta.shards).toBe(start);
      expect(save.get().meta.perks).toEqual({});
    });
  });

  it("applies once at run start from the setup", () => {
    const base = gameWith({});
    const game = gameWith({ perks: { edge: 5, vault: 5, reorg: 2 } });
    expect(game.player.maxHp).toBe(base.player.maxHp + 30);
    expect(game.rerolls).toBe(base.rerolls + 2);
    expect(game.damageTotal()).toBeCloseTo(base.damageTotal() * 1.15, 5);
    const more = gameWith({ perks: { blocklist: 2, seed: 3, magnet: 3, alpha: 2 } });
    expect(more.banishes).toBe(base.banishes + 2);
    expect(more.player.coins).toBe(45);
    expect(more.player.pickupRadius).toBeCloseTo(base.player.pickupRadius * 1.3, 5);
  });
});

describe("contracts", () => {
  it("offers 8-10 opt-in modifiers that all pay more", () => {
    expect(MODIFIERS.length).toBeGreaterThanOrEqual(8);
    expect(MODIFIERS.length).toBeLessThanOrEqual(10);
    for (const m of MODIFIERS) {
      expect(m.score).toBeGreaterThan(1);
      expect(m.shards).toBeGreaterThan(1);
    }
    expect(rewardMults(MODIFIERS.map((m) => m.id)).score).toBe(MAX_SCORE_MULT);
    expect(rewardMults([])).toEqual({ score: 1, shards: 1 });
  });

  it("folds difficulty, perks and contracts into one effects table", () => {
    const fx = runEffects("hard", { ...defaultSetup(), mods: ["low-latency", "hardened", "thin-margin", "bull-market", "whale-season", "inflation", "hunted", "dark-forest"] });
    const hard = DIFFICULTY.hard;
    expect(fx.enemySpeedMult).toBeCloseTo(hard.enemySpeedMult * 1.25);
    expect(fx.enemyHpMult).toBeCloseTo(hard.enemyHpMult * 1.35);
    expect(fx.playerDamageTakenMult).toBeCloseTo(hard.playerDamageTakenMult * 1.4);
    expect(fx.spawnMult).toBeCloseTo(hard.spawnMult * 1.6);
    expect(fx).toMatchObject({ xpMult: 1.1, eliteChanceMult: 2, eliteDamageMult: 1.6, extraWhales: 2, costMult: 1.6, huntEverySec: 60, darkness: true, pickupMult: 0.5 });
    expect(runEffects("normal", defaultSetup())).toMatchObject({ damageMult: 1, healMult: 1, scoreMult: 1, shardMult: 1, rerolls: 2, banishes: 1, startCoins: 0 });
  });

  it("changes the live run", () => {
    const base = gameWith({});
    const glass = gameWith({ mods: ["glass-cannon"] });
    expect(glass.player.maxHp).toBe(Math.round(base.player.maxHp * 0.4));
    expect(glass.damageTotal()).toBeCloseTo(base.damageTotal() * 1.35, 5);
    const ledger = gameWith({ mods: ["immutable"] });
    ledger.player.hp = 10;
    ledger.healPlayer(50);
    ledger.skipCards();
    expect(ledger.player.hp).toBe(10);
    const pricey = gameWith({ mods: ["inflation"] });
    expect(pricey.chestCost(10)).toBe(16);
    const scored = gameWith({ mods: ["glass-cannon", "immutable"] });
    stepSeconds(scored, 5);
    expect(scored.baseScore()).toBeGreaterThan(0);
    expect(scored.score()).toBe(Math.floor(scored.baseScore() * rewardMults(["glass-cannon", "immutable"]).score));
  });

  it("sends a whale after you when doxxed", () => {
    const game = gameWith({ mods: ["hunted"] });
    game.god = true;
    while (game.elapsed < 59.5) stepSeconds(game, 0.5);
    const before = game.enemies.filter((e) => e.elite && !e.dead).length;
    while (game.elapsed < 60.5) stepSeconds(game, 0.25);
    expect(game.enemies.filter((e) => e.elite && !e.dead).length).toBeGreaterThan(before);
  });
});

describe("unlocks", () => {
  it("unlocks from achievements or purchases and never locks a starter tool", () => {
    expect(unlockedIds({}, {})).toEqual([]);
    expect(unlockedIds({ "first-boss": 1 }, { "tool:whale-alert": 1 })).toEqual(["hero:trace", "tool:whale-alert"]);
    expect(heroAvailable("keel", [])).toBe(true);
    expect(heroAvailable("trace", [])).toBe(false);
    const locked = lockedTools([]);
    for (const c of CHARACTERS) expect(locked).not.toContain(c.startWeapon);
  });

  it("buys an unlock with shards only once", () => {
    withStorage(() => {
      save.awardShards(100);
      expect(save.buyUnlock("hero:trace")).toBe(true);
      expect(save.buyUnlock("hero:trace")).toBe(false);
      expect(save.unlockedNow()).toContain("hero:trace");
      expect(save.buyUnlock("hero:nobody")).toBe(false);
    });
  });
});

describe("save v2 to v3 migration", () => {
  const v2 = { v: 2, best: 900, hero: "diff", stats: { runs: 5, kills: 100, bosses: 1, timeSec: 600, bestTime: 300 }, achievements: { "first-boss": 7 }, codex: { seen: { "e:x": 1 }, killed: {} } };

  it("keeps old data and adds empty meta progression", () => {
    const out = save.migrate(v2)!;
    expect(out.v).toBe(save.SAVE_VERSION);
    expect(out).toMatchObject({ best: 900, hero: "diff", achievements: { "first-boss": 7 } });
    expect(out.meta).toEqual({ shards: 0, earned: 0, perks: {} });
    expect(out.unlocks).toEqual({});
    expect(out.contracts).toEqual([]);
    expect(out.daily).toEqual(emptyDaily());
    expect(save.unlockedNow(out)).toEqual(["hero:trace"]);
  });

  it("cleans tampered meta data", () => {
    const out = save.sanitize({
      v: 3,
      meta: { shards: -5, earned: "x", perks: { edge: 99, vault: 99, alpha: 99, bogus: 1 } },
      unlocks: { "hero:trace": 5, "hero:keel": 1, "tool:whale-alert": "yes" },
      contracts: ["hunted", "hunted", "nope", "glass-cannon"],
      daily: { date: "2026-13-40", streak: 4, best: 10 },
    });
    expect(out.meta.shards).toBe(0);
    expect(totalRanks(out.meta.perks)).toBe(MAX_TOTAL_RANKS);
    expect(out.unlocks).toEqual({ "hero:trace": 5 });
    expect(out.contracts).toEqual(["glass-cannon", "hunted"]);
    expect(out.daily).toMatchObject({ date: "", streak: 4, bestStreak: 4, best: 10 });
  });

  it("migrates a v1 save all the way", () => {
    const out = save.migrate({ v: 1, best: 3, history: [] })!;
    expect(out.v).toBe(save.SAVE_VERSION);
    expect(out.meta.shards).toBe(0);
  });

  it("records the daily best and streak", () => {
    withStorage(() => {
      save.recordDaily("2026-11-02", 100);
      const d = save.recordDaily("2026-11-03", 400);
      expect(d).toMatchObject({ date: "2026-11-03", best: 400, streak: 2 });
      expect(save.get().daily.streak).toBe(2);
    });
  });
});
