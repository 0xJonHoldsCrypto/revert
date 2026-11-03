export type ModifierId =
  | "glass-cannon"
  | "immutable"
  | "hunted"
  | "dark-forest"
  | "whale-season"
  | "inflation"
  | "low-latency"
  | "bull-market"
  | "thin-margin"
  | "hardened";

export type ModifierEffect = {
  damageMult?: number;
  maxHpMult?: number;
  healMult?: number;
  huntEverySec?: number;
  pickupMult?: number;
  darkness?: boolean;
  eliteChanceMult?: number;
  extraWhales?: number;
  costMult?: number;
  enemySpeedMult?: number;
  enemyHpMult?: number;
  spawnMult?: number;
  xpMult?: number;
  damageTakenMult?: number;
};

export type ModifierDef = {
  id: ModifierId;
  name: string;
  desc: string;
  score: number;
  shards: number;
  effect: ModifierEffect;
};

export const MAX_SCORE_MULT = 3;
export const MAX_SHARD_MULT = 3;

export const MODIFIERS: ModifierDef[] = [
  { id: "glass-cannon", name: "Glass Cannon", desc: "Deal 50% more damage. Max HP halved.", score: 1.3, shards: 1.3, effect: { damageMult: 1.5, maxHpMult: 0.5 } },
  { id: "immutable", name: "Immutable Ledger", desc: "Nothing heals you. Ever.", score: 1.35, shards: 1.35, effect: { healMult: 0 } },
  { id: "hunted", name: "Doxxed", desc: "A whale wallet hunts you every 75 seconds.", score: 1.25, shards: 1.25, effect: { huntEverySec: 75 } },
  { id: "dark-forest", name: "Dark Forest", desc: "Vision dims and pickup radius is halved.", score: 1.15, shards: 1.15, effect: { pickupMult: 0.5, darkness: true } },
  { id: "whale-season", name: "Whale Season", desc: "Whales spawn twice as often, two more at once.", score: 1.2, shards: 1.2, effect: { eliteChanceMult: 2, extraWhales: 2 } },
  { id: "inflation", name: "Inflation", desc: "Chests and rig upgrades cost 60% more.", score: 1.15, shards: 1.15, effect: { costMult: 1.6 } },
  { id: "low-latency", name: "Low Latency", desc: "Attackers move 20% faster.", score: 1.25, shards: 1.25, effect: { enemySpeedMult: 1.2 } },
  { id: "bull-market", name: "Bull Market", desc: "30% more XP, 30% more attackers.", score: 1.2, shards: 1.15, effect: { xpMult: 1.3, spawnMult: 1.3 } },
  { id: "thin-margin", name: "Thin Margin", desc: "Take 40% more damage from every hit.", score: 1.25, shards: 1.25, effect: { damageTakenMult: 1.4 } },
  { id: "hardened", name: "Hardened Exploits", desc: "Attackers have 35% more HP.", score: 1.25, shards: 1.25, effect: { enemyHpMult: 1.35 } },
];

export const MODIFIER_BY_ID = Object.fromEntries(MODIFIERS.map((m) => [m.id, m])) as Record<ModifierId, ModifierDef>;

export const DAILY_MODIFIERS: ModifierId[] = ["glass-cannon", "hunted", "whale-season", "inflation", "low-latency", "bull-market", "hardened", "dark-forest"];

export function isModifierId(id: unknown): id is ModifierId {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(MODIFIER_BY_ID, id);
}

export function cleanModifiers(raw: unknown): ModifierId[] {
  if (!Array.isArray(raw)) return [];
  const picked = new Set(raw.filter(isModifierId));
  return MODIFIERS.map((m) => m.id).filter((id) => picked.has(id));
}

export function modifiersAreValid(raw: unknown): raw is ModifierId[] {
  if (!Array.isArray(raw)) return false;
  const clean = cleanModifiers(raw);
  return clean.length === raw.length && clean.every((id, i) => id === raw[i]);
}

export function rewardMults(ids: readonly ModifierId[]): { score: number; shards: number } {
  let score = 1;
  let shards = 1;
  for (const id of cleanModifiers(ids)) {
    score *= MODIFIER_BY_ID[id].score;
    shards *= MODIFIER_BY_ID[id].shards;
  }
  return { score: Math.min(MAX_SCORE_MULT, Math.round(score * 1000) / 1000), shards: Math.min(MAX_SHARD_MULT, Math.round(shards * 1000) / 1000) };
}
