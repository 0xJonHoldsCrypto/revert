import type { BiomeId } from "./environment";
import type { ChestKind, EnemyKind } from "../types";

export const BIOME_LABEL: Record<BiomeId, { name: string; tagline: string }> = {
  mempool: { name: "The Mempool", tagline: "Pending transactions drift through the dark." },
  vault: { name: "Hot Wallet Vault", tagline: "Server aisles, vault doors, red alarms." },
  bridge: { name: "The Bridge", tagline: "A broken span over the void." },
  forest: { name: "The Dark Forest", tagline: "Anything that moves here gets front-run." },
};

export const BIOME_HORDE_BIAS: Record<BiomeId, Partial<Record<EnemyKind, number>>> = {
  mempool: { "script-kiddie": 1.4, "sim-swapper": 1.6, "rug-dev": 1.2, "airdrop-farmer": 1.5, "tg-scammer": 1.4 },
  vault: { "phishing-bot": 1.5, "mev-searcher": 1.8, "insider": 1.2, "bot-farm": 1.6, "liquidator": 1.4 },
  bridge: { "bridge-drainer": 1.6, "oracle-manipulator": 1.8, "rug-dev": 1.1, "depegged-stable": 1.8, "wash-trader": 1.4 },
  forest: { "shadow-op": 1.7, "insider": 1.5, "oracle-manipulator": 1.2, "slasher": 1.8, "leverage-degen": 1.5 },
};

export const AREA_RULES: Record<BiomeId, { speed: number; damageTaken: number; coin: number; xp: number; rule: string }> = {
  mempool: { speed: 1, damageTaken: 1, coin: 1.3, xp: 1, rule: "Loose SAFU" },
  vault: { speed: 0.9, damageTaken: 1.12, coin: 1, xp: 1, rule: "Compliance drag" },
  bridge: { speed: 1.1, damageTaken: 0.88, coin: 1.1, xp: 1.2, rule: "Cross-chain slipstream" },
  forest: { speed: 1, damageTaken: 1.22, coin: 1.4, xp: 1.35, rule: "High bounty" },
};

export const BIOME_CHEST_KINDS: Record<BiomeId, ChestKind[]> = {
  mempool: ["airdrop-pod", "cold-wallet", "cold-wallet"],
  vault: ["cold-wallet", "defi-lootbox", "airdrop-pod"],
  bridge: ["defi-lootbox", "grant-safe", "validator-crate"],
  forest: ["grant-safe", "validator-crate", "defi-lootbox"],
};
