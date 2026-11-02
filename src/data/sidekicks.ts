import type { SidekickKind } from "../types";

export type SidekickDef = {
  kind: SidekickKind;
  name: string;
  emoji: string;
  blurb: string;
  orbit: number;
  damage: number;
  attackCooldown: number;
  coinCollectRadius: number;
  color: string;
};

export const SIDEKICKS: Record<SidekickKind, SidekickDef> = {
  "asic-miner": {
    kind: "asic-miner",
    name: "ASIC Miner",
    emoji: "⛏",
    blurb: "Mines $SAFU for you every few seconds.",
    orbit: 52,
    damage: 14,
    attackCooldown: 0.65,
    coinCollectRadius: 90,
    color: "#f0b429",
  },
  "dev-laptop": {
    kind: "dev-laptop",
    name: "Dev Laptop",
    emoji: "💻",
    blurb: "Fires homing darts at the nearest attacker.",
    orbit: 48,
    damage: 10,
    attackCooldown: 0.45,
    coinCollectRadius: 70,
    color: "#79c0ff",
  },
  "codebase-guardian": {
    kind: "codebase-guardian",
    name: "Codebase Guardian",
    emoji: "{ }",
    blurb: "Freezes everything close to you for a moment.",
    orbit: 56,
    damage: 18,
    attackCooldown: 0.85,
    coinCollectRadius: 110,
    color: "#7ee787",
  },
  "block-builder": {
    kind: "block-builder",
    name: "Block Builder",
    emoji: "🧱",
    blurb: "Vacuums XP and pickups from a wide area.",
    orbit: 60,
    damage: 22,
    attackCooldown: 1.05,
    coinCollectRadius: 120,
    color: "#f0c14d",
  },
};
