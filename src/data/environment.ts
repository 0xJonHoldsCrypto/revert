import type { ChestKind, EnvObstacleKind, WeaponKind } from "../types";
import type { WeaponRarity } from "./rarity";

export type BiomeId = "mempool" | "vault" | "bridge" | "forest";

export interface EnvObstacleDef {
  kind: EnvObstacleKind;
  name: string;
  width: number;
  height: number;
  blocks: boolean;
  slowMult?: number;
  damagePerSec?: number;
  color: string;
  biome: BiomeId[];
}

export interface ChestDef {
  kind: ChestKind;
  name: string;
  radius: number;
  openTime: number;
  minRarity: WeaponRarity;
  color: string;
  coinCost: number;
}

export const ENV_OBSTACLES: Record<EnvObstacleKind, EnvObstacleDef> = {
  "rug-pool": {
    kind: "rug-pool",
    name: "Rug Pool",
    width: 96,
    height: 64,
    blocks: false,
    slowMult: 0.45,
    damagePerSec: 3,
    color: "#f778ba",
    biome: ["mempool", "bridge"],
  },
  "gas-gate": {
    kind: "gas-gate",
    name: "Gas Gate",
    width: 48,
    height: 120,
    blocks: true,
    color: "#ffa657",
    biome: ["vault", "bridge"],
  },
  "kyc-wall": {
    kind: "kyc-wall",
    name: "KYC Wall",
    width: 140,
    height: 40,
    blocks: true,
    color: "#79c0ff",
    biome: ["vault"],
  },
  "liquidation-spike": {
    kind: "liquidation-spike",
    name: "Liquidation Spike",
    width: 56,
    height: 56,
    blocks: true,
    damagePerSec: 5,
    color: "#f85149",
    biome: ["bridge", "forest"],
  },
  "sandwich-bot": {
    kind: "sandwich-bot",
    name: "Sandwich Bot",
    width: 72,
    height: 48,
    blocks: false,
    slowMult: 0.7,
    color: "#d2a8ff",
    biome: ["mempool", "vault"],
  },
  honeypot: {
    kind: "honeypot",
    name: "Honeypot",
    width: 70,
    height: 70,
    blocks: false,
    damagePerSec: 7,
    color: "#ff5d7a",
    biome: ["bridge", "forest", "mempool"],
  },
  "mempool-fog": {
    kind: "mempool-fog",
    name: "Mempool Fog",
    width: 120,
    height: 90,
    blocks: false,
    slowMult: 0.55,
    color: "#6cb6ff",
    biome: ["vault", "bridge", "forest"],
  },
};

export const CHESTS: Record<ChestKind, ChestDef> = {
  "cold-wallet": {
    kind: "cold-wallet",
    name: "Cold Wallet Cache",
    radius: 52,
    openTime: 1.15,
    minRarity: "uncommon",
    color: "#58a6ff",
    coinCost: 5,
  },
  "defi-lootbox": {
    kind: "defi-lootbox",
    name: "DeFi Loot Box",
    radius: 58,
    openTime: 1.35,
    minRarity: "rare",
    color: "#a371f7",
    coinCost: 12,
  },
  "validator-crate": {
    kind: "validator-crate",
    name: "Validator Crate",
    radius: 64,
    openTime: 1.6,
    minRarity: "epic",
    color: "#f0b429",
    coinCost: 25,
  },
  "airdrop-pod": {
    kind: "airdrop-pod",
    name: "Airdrop Pod",
    radius: 48,
    openTime: 0.95,
    minRarity: "common",
    color: "#2ee6c7",
    coinCost: 3,
  },
  "grant-safe": {
    kind: "grant-safe",
    name: "Grant Safe",
    radius: 60,
    openTime: 1.45,
    minRarity: "rare",
    color: "#f0c14d",
    coinCost: 18,
  },
};

export const CHEST_WEAPON_POOL: WeaponKind[] = [
  "audit-dart",
  "rug-coin",
  "memo-pulse",
  "finality-beam",
  "reorg-whip",
  "stable-shield",
  "patch-burst",
  "flash-loan",
  "validator-seal",
  "bridge-bolt",
  "nonce-shard",
];

export const FLOOR_CELL = 768;
const REGION = 2600;
const SPAWN_SAFE_CELLS = 2;
const BIOMES: BiomeId[] = ["mempool", "vault", "bridge", "forest"];

let biomeSeed = 0;
const biomeCache = new Map<number, BiomeId>();

export function setBiomeSeed(seed: number) {
  biomeSeed = seed | 0;
  biomeCache.clear();
}

function scramble(x: number, y: number, salt: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(salt + biomeSeed, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function biomeOfCell(cx: number, cy: number): BiomeId {
  if (Math.abs(cx) < SPAWN_SAFE_CELLS && Math.abs(cy) < SPAWN_SAFE_CELLS) return "mempool";
  const wx = (cx + 0.5) * FLOOR_CELL;
  const wy = (cy + 0.5) * FLOOR_CELL;
  const rx = Math.floor(wx / REGION);
  const ry = Math.floor(wy / REGION);
  let best = Infinity;
  let biome: BiomeId = "mempool";
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      const sx = (rx + ox + scramble(rx + ox, ry + oy, 1)) * REGION;
      const sy = (ry + oy + scramble(rx + ox, ry + oy, 2)) * REGION;
      const d = (sx - wx) ** 2 + (sy - wy) ** 2;
      if (d < best) {
        best = d;
        biome = BIOMES[Math.floor(scramble(rx + ox, ry + oy, 3) * BIOMES.length)]!;
      }
    }
  }
  return biome;
}

export function biomeOfFloorCell(cx: number, cy: number): BiomeId {
  const key = (cx + 32768) * 65536 + (cy + 32768);
  let biome = biomeCache.get(key);
  if (!biome) {
    biome = biomeOfCell(cx, cy);
    biomeCache.set(key, biome);
  }
  return biome;
}

export function biomeAt(x: number, y: number): BiomeId {
  return biomeOfFloorCell(Math.floor(x / FLOOR_CELL), Math.floor(y / FLOOR_CELL));
}
