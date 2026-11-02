import { randRange } from "../utils/math";
import { RARITY_ORDER } from "./gear";
import type { BiomeId } from "./environment";
import type { ChestKind } from "../types";
import type { WeaponRarity } from "./rarity";
import type { WellStatId } from "./wells";
import { WELL_STAT_ORDER } from "./wells";

export function rollGold(minRarity: WeaponRarity): number {
  return Math.round(randRange(10, 22) * (1 + RARITY_ORDER.indexOf(minRarity) * 0.7));
}

export function rollWellStat(seed: number): WellStatId {
  return WELL_STAT_ORDER[seed % WELL_STAT_ORDER.length]!;
}

export function chestKindForBiome(biome: BiomeId, rnd: () => number): ChestKind {
  const roll = rnd();
  if (biome === "mempool") return roll < 0.6 ? "airdrop-pod" : "cold-wallet";
  if (biome === "vault") return roll < 0.5 ? "cold-wallet" : "defi-lootbox";
  if (biome === "bridge") return roll < 0.7 ? "defi-lootbox" : "validator-crate";
  return roll < 0.45 ? "defi-lootbox" : "validator-crate";
}
