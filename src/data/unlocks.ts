import { ACHIEVEMENT_BY_ID } from "./achievements";
import type { CharacterId, WeaponKind } from "../types";

export type UnlockKind = "hero" | "tool";

export type UnlockDef = {
  id: string;
  kind: UnlockKind;
  target: CharacterId | WeaponKind;
  achievement: string;
  shards: number;
};

const TABLE: [UnlockKind, CharacterId | WeaponKind, string, number][] = [
  ["hero", "diff", "survive-5", 60],
  ["hero", "trace", "first-boss", 90],
  ["hero", "ledger", "hard-5", 120],
  ["hero", "relay", "double-rig", 120],
  ["tool", "honeypot-trap", "chests-10", 40],
  ["tool", "merkle-proof", "kills-1000", 40],
  ["tool", "oracle-strike", "first-evolve", 50],
  ["tool", "whale-alert", "whale", 50],
  ["tool", "slashing-field", "survive-10", 60],
  ["tool", "nonce-shard", "three-bosses", 60],
];

export const UNLOCKS: UnlockDef[] = TABLE.map(([kind, target, achievement, shards]) => ({ id: `${kind}:${target}`, kind, target, achievement, shards }));

export const UNLOCK_BY_ID: Record<string, UnlockDef> = Object.fromEntries(UNLOCKS.map((u) => [u.id, u]));

export const ALL_UNLOCK_IDS: string[] = UNLOCKS.map((u) => u.id);

export function isUnlockId(id: unknown): id is string {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(UNLOCK_BY_ID, id);
}

export function heroUnlockId(hero: string): string {
  return `hero:${hero}`;
}

export function toolUnlockId(tool: string): string {
  return `tool:${tool}`;
}

export function unlockedIds(achievements: Record<string, number>, purchased: Record<string, number>): string[] {
  return UNLOCKS.filter((u) => !!achievements[u.achievement] || !!purchased[u.id]).map((u) => u.id);
}

export function cleanUnlocked(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set(raw.filter(isUnlockId));
  return ALL_UNLOCK_IDS.filter((id) => set.has(id));
}

export function unlockedListIsValid(raw: unknown): raw is string[] {
  if (!Array.isArray(raw)) return false;
  const clean = cleanUnlocked(raw);
  return clean.length === raw.length && clean.every((id, i) => id === raw[i]);
}

export function heroAvailable(hero: string, unlocked: readonly string[]): boolean {
  const id = heroUnlockId(hero);
  return !UNLOCK_BY_ID[id] || unlocked.includes(id);
}

export function lockedTools(unlocked: readonly string[]): WeaponKind[] {
  return UNLOCKS.filter((u) => u.kind === "tool" && !unlocked.includes(u.id)).map((u) => u.target as WeaponKind);
}

export function requirementText(def: UnlockDef): string {
  const ach = ACHIEVEMENT_BY_ID[def.achievement];
  return `${ach ? ach.desc.replace(/\.$/, "") : def.achievement} or ${def.shards} shards`;
}
