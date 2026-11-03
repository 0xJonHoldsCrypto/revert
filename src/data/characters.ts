import type { CharacterDef, SidekickKind } from "../types";

export const CHARACTERS: CharacterDef[] = [
  {
    id: "keel",
    name: "Keel",
    emoji: "⌨️",
    role: "Protocol Engineer",
    blurb: "Every third whip swing does double damage.",
    color: "#2ee6c7",
    accent: "#14302c",
    maxHp: 130,
    moveSpeed: 210,
    damageMult: 1.12,
    xpMult: 1,
    dashCooldown: 2.4,
    startWeapon: "reorg-whip",
  },
  {
    id: "nyx",
    name: "Nyx",
    emoji: "📡",
    role: "Mempool Watcher",
    blurb: "Spots disguised attackers, marked with a red ring.",
    color: "#6cb6ff",
    accent: "#102030",
    maxHp: 105,
    moveSpeed: 218,
    damageMult: 1.15,
    xpMult: 1.05,
    dashCooldown: 2.1,
    startWeapon: "memo-pulse",
  },
  {
    id: "diff",
    name: "Diff",
    emoji: "🩹",
    role: "Whitehat",
    blurb: "The first hit on an undamaged attacker crits.",
    color: "#e8eef8",
    accent: "#1a1e28",
    maxHp: 95,
    moveSpeed: 205,
    damageMult: 1.28,
    xpMult: 0.95,
    dashCooldown: 2.5,
    startWeapon: "audit-dart",
  },
  {
    id: "trace",
    name: "Trace",
    emoji: "🛡️",
    role: "Incident Responder",
    blurb: "Every level-up instantly reloads all tools.",
    color: "#9b8cff",
    accent: "#1a1830",
    maxHp: 110,
    moveSpeed: 200,
    damageMult: 1,
    xpMult: 1.25,
    dashCooldown: 2.3,
    startWeapon: "pager-ping",
  },
  {
    id: "ledger",
    name: "Ledger",
    emoji: "📒",
    role: "Forensic Auditor",
    blurb: "An audit shield soaks hits and books them back as thorns.",
    color: "#f0c14d",
    accent: "#2a2210",
    maxHp: 150,
    moveSpeed: 192,
    damageMult: 0.95,
    xpMult: 1,
    dashCooldown: 2.7,
    startWeapon: "finality-beam",
  },
  {
    id: "relay",
    name: "Relay",
    emoji: "🛰️",
    role: "Node Operator",
    blurb: "Starts with a Dev Laptop. Runs three rigs, faster and cheaper.",
    color: "#ff8bd1",
    accent: "#2c1426",
    maxHp: 100,
    moveSpeed: 212,
    damageMult: 0.92,
    xpMult: 1.05,
    dashCooldown: 2.2,
    startWeapon: "keeper-bot",
  },
];

export const LEDGER_SHIELD_FRACTION = 0.25;
export const LEDGER_RECHARGE_DELAY_SEC = 4;
export const LEDGER_RECHARGE_SEC = 3;
export const LEDGER_THORNS_MULT = 3;
export const LEDGER_THORNS_RADIUS = 140;
export const RELAY_START_RIG: SidekickKind = "dev-laptop";
export const RELAY_MAX_RIGS = 3;
export const RELAY_RIG_OUTPUT = 1.35;
export const RELAY_RIG_COST = 0.7;

export function getCharacter(id: string): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0]!;
}
