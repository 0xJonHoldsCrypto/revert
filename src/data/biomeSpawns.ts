import type { BiomeId } from "./environment";
import type { ChestKind, EnemyKind } from "../types";

export const BIOME_LABEL: Record<BiomeId, { name: string; tagline: string }> = {
  wasteland: { name: "Rug Wasteland", tagline: "Early exploit scrubs roam the grass." },
  cex: { name: "CEX District", tagline: "Phish bots and sandwich MEV." },
  defi: { name: "DeFi Depths", tagline: "Bridge drainers and liquidation traps." },
  apt: { name: "APT Citadel", tagline: "Lazarus ops and grand heists." },
};

export const BIOME_HORDE_BIAS: Record<BiomeId, Partial<Record<EnemyKind, number>>> = {
  wasteland: { "script-kiddie": 1.4, "sim-swapper": 1.6, "rug-dev": 1.2 },
  cex: { "phishing-bot": 1.5, "mev-searcher": 1.8, "insider": 1.2 },
  defi: { "bridge-drainer": 1.6, "oracle-witch": 1.8, "rug-dev": 1.1 },
  apt: { "lazarus-op": 1.7, "insider": 1.5, "oracle-witch": 1.2 },
};

export const AREA_RULES: Record<BiomeId, { speed: number; damageTaken: number; coin: number; xp: number; rule: string }> = {
  wasteland: { speed: 1, damageTaken: 1, coin: 1.3, xp: 1, rule: "Loose sats" },
  cex: { speed: 0.9, damageTaken: 1.12, coin: 1, xp: 1, rule: "KYC drag" },
  defi: { speed: 1.1, damageTaken: 0.88, coin: 1.1, xp: 1.2, rule: "Yield slipstream" },
  apt: { speed: 1, damageTaken: 1.22, coin: 1.4, xp: 1.35, rule: "High bounty" },
};

export const BIOME_CHEST_KINDS: Record<BiomeId, ChestKind[]> = {
  wasteland: ["airdrop-pod", "cold-wallet", "cold-wallet"],
  cex: ["cold-wallet", "defi-lootbox", "airdrop-pod"],
  defi: ["defi-lootbox", "grant-safe", "validator-crate"],
  apt: ["grant-safe", "validator-crate", "defi-lootbox"],
};
