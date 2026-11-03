import { DIFFICULTY, type DifficultyId } from "../data/difficulty";
import { clampPerks, perkTotals, totalRanks, type MetaPerkRanks } from "../data/metaPerks";
import { cleanModifiers, MODIFIER_BY_ID, rewardMults, type ModifierId } from "../data/modifiers";
import { ALL_UNLOCK_IDS, cleanUnlocked } from "../data/unlocks";

export type RunMode = "standard" | "daily";

export type RunSetup = {
  perks: MetaPerkRanks;
  mods: ModifierId[];
  unlocked: string[];
  mode: RunMode;
  date: string | null;
};

export type RunEffects = {
  damageMult: number;
  maxHpBonus: number;
  maxHpMult: number;
  healMult: number;
  pickupMult: number;
  xpMult: number;
  startCoins: number;
  rerolls: number;
  banishes: number;
  spawnMult: number;
  enemyHpMult: number;
  enemySpeedMult: number;
  playerDamageTakenMult: number;
  eliteChanceMult: number;
  eliteDamageMult: number;
  extraWhales: number;
  costMult: number;
  huntEverySec: number;
  darkness: boolean;
  scoreMult: number;
  shardMult: number;
};

export function defaultSetup(): RunSetup {
  return { perks: {}, mods: [], unlocked: [...ALL_UNLOCK_IDS], mode: "standard", date: null };
}

export function cleanSetup(setup: RunSetup): RunSetup {
  return {
    perks: clampPerks(setup.perks),
    mods: cleanModifiers(setup.mods),
    unlocked: cleanUnlocked(setup.unlocked),
    mode: setup.mode === "daily" ? "daily" : "standard",
    date: setup.mode === "daily" ? setup.date : null,
  };
}

export function isRanked(setup: RunSetup): boolean {
  return totalRanks(clampPerks(setup.perks)) === 0;
}

export function runEffects(difficulty: DifficultyId, setup: RunSetup): RunEffects {
  const diff = DIFFICULTY[difficulty];
  const perk = perkTotals(setup.perks);
  const reward = rewardMults(setup.mods);
  const fx: RunEffects = {
    damageMult: 1 + perk.damage,
    maxHpBonus: perk.maxHp,
    maxHpMult: 1,
    healMult: 1,
    pickupMult: 1 + perk.pickup,
    xpMult: 1 + perk.xp,
    startCoins: perk.coins,
    rerolls: 2 + perk.rerolls,
    banishes: 1 + perk.banishes,
    spawnMult: diff.spawnMult,
    enemyHpMult: diff.enemyHpMult,
    enemySpeedMult: diff.enemySpeedMult,
    playerDamageTakenMult: diff.playerDamageTakenMult,
    eliteChanceMult: 1,
    eliteDamageMult: 1,
    extraWhales: 0,
    costMult: 1,
    huntEverySec: 0,
    darkness: false,
    scoreMult: reward.score,
    shardMult: reward.shards * diff.shardMult,
  };
  for (const id of cleanModifiers(setup.mods)) {
    const m = MODIFIER_BY_ID[id].effect;
    fx.damageMult *= m.damageMult ?? 1;
    fx.maxHpMult *= m.maxHpMult ?? 1;
    fx.healMult *= m.healMult ?? 1;
    fx.pickupMult *= m.pickupMult ?? 1;
    fx.xpMult *= m.xpMult ?? 1;
    fx.spawnMult *= m.spawnMult ?? 1;
    fx.enemyHpMult *= m.enemyHpMult ?? 1;
    fx.enemySpeedMult *= m.enemySpeedMult ?? 1;
    fx.playerDamageTakenMult *= m.damageTakenMult ?? 1;
    fx.eliteChanceMult *= m.eliteChanceMult ?? 1;
    fx.eliteDamageMult *= m.eliteDamageMult ?? 1;
    fx.extraWhales += m.extraWhales ?? 0;
    fx.costMult *= m.costMult ?? 1;
    if (m.huntEverySec) fx.huntEverySec = fx.huntEverySec ? Math.min(fx.huntEverySec, m.huntEverySec) : m.huntEverySec;
    fx.darkness = fx.darkness || !!m.darkness;
  }
  return fx;
}

export function setupDigest(setup: RunSetup): number {
  const clean = cleanSetup(setup);
  const perks = Object.entries(clean.perks)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([id, rank]) => `${id}=${rank}`)
    .join(",");
  const text = `${perks}|${clean.mods.join(",")}|${clean.unlocked.join(",")}|${clean.mode}|${clean.date ?? ""}`;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  return hash;
}
