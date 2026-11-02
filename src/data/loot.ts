import { simRandom } from "../utils/math";
import { biomeAt, CHEST_WEAPON_POOL } from "./environment";
import type { BiomeId } from "./environment";
import type { ChestKind, SidekickKind, WeaponKind } from "../types";
import type { WeaponRarity } from "./rarity";
import { rollRarity } from "./rarity";
import { WEAPONS } from "./weapons";
import { SIDEKICKS } from "./sidekicks";
import type { WellStatId } from "./wells";
import { WELL_STAT_ORDER } from "./wells";
import { pick } from "../utils/math";

export type ChestLoot =
  | { type: "weapon"; kind: WeaponKind; rarity: WeaponRarity }
  | { type: "stat"; stat: "damage" | "speed" | "maxHp" | "pickup"; amount: number }
  | { type: "sidekick"; kind: SidekickKind };

export function rollChestLoot(minRarity: WeaponRarity, biome: BiomeId): ChestLoot {
  const roll = simRandom();
  if (roll < 0.12) {
    const kinds = Object.keys(SIDEKICKS) as SidekickKind[];
    return { type: "sidekick", kind: pick(kinds) };
  }
  if (roll < 0.28) {
    const stat = pick(["damage", "speed", "maxHp", "pickup"] as const);
    const amount = stat === "maxHp" ? 12 : stat === "damage" ? 0.06 : 0.08;
    return { type: "stat", stat, amount };
  }
  const kind = pick(CHEST_WEAPON_POOL);
  let rarity = rollRarity(biome === "apt" ? 0.22 : biome === "defi" ? 0.18 : 0.12);
  const order = ["common", "uncommon", "rare", "epic", "legendary"];
  if (order.indexOf(rarity) < order.indexOf(minRarity)) rarity = minRarity;
  const base = WEAPONS[kind].rarity;
  if (order.indexOf(rarity) < order.indexOf(base)) rarity = base;
  return { type: "weapon", kind, rarity };
}

export function rollWellStat(seed: number): WellStatId {
  return WELL_STAT_ORDER[seed % WELL_STAT_ORDER.length]!;
}

export function chestKindForBiome(biome: BiomeId, rnd: () => number): ChestKind {
  const pool = (["cold-wallet", "defi-lootbox", "validator-crate", "airdrop-pod", "grant-safe"] as ChestKind[]).filter((k) => {
    if (biome === "wasteland") return k === "airdrop-pod" || k === "cold-wallet" || rnd() > 0.55;
    if (biome === "cex") return k !== "grant-safe" || rnd() > 0.6;
    if (biome === "defi") return k !== "airdrop-pod" || rnd() > 0.45;
    return k === "grant-safe" || k === "validator-crate" || rnd() > 0.5;
  });
  return pool[Math.floor(rnd() * pool.length)] ?? "cold-wallet";
}

export function biomeAtChest(x: number, y: number): BiomeId {
  return biomeAt(x, y);
}
