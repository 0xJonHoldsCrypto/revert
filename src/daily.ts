import { CHARACTERS } from "./data/characters";
import type { DifficultyId } from "./data/difficulty";
import { DAILY_MODIFIERS, type ModifierId } from "./data/modifiers";
import { ALL_UNLOCK_IDS } from "./data/unlocks";
import type { RunSetup } from "./game/runSetup";
import type { CharacterId } from "./types";

export const DAILY_DIFFICULTY: DifficultyId = "normal";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type DailyPlan = { seed: number; hero: CharacterId; difficulty: DifficultyId; setup: RunSetup };

export type DailyRecord = { date: string; best: number; streak: number; bestStreak: number; bestEver: number; plays: number };

export function isDailyDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function utcDate(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function previousDate(date: string): string {
  return utcDate(Date.parse(`${date}T00:00:00Z`) - 86_400_000);
}

function fnv(text: string, salt: number): number {
  let hash = (2166136261 ^ salt) >>> 0;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 2246822519) >>> 0;
  hash ^= hash >>> 13;
  return hash >>> 0;
}

export function dailySeed(date: string): number {
  return fnv(`revert-daily:${date}`, 0) & 0x7fffffff;
}

export function dailyHero(date: string): CharacterId {
  return CHARACTERS[fnv(date, 0x68) % CHARACTERS.length]!.id;
}

export function dailyModifier(date: string): ModifierId {
  return DAILY_MODIFIERS[fnv(date, 0x6d) % DAILY_MODIFIERS.length]!;
}

export function dailyPlan(date: string): DailyPlan {
  return {
    seed: dailySeed(date),
    hero: dailyHero(date),
    difficulty: DAILY_DIFFICULTY,
    setup: { perks: {}, mods: [dailyModifier(date)], unlocked: [...ALL_UNLOCK_IDS], mode: "daily", date },
  };
}

export function emptyDaily(): DailyRecord {
  return { date: "", best: 0, streak: 0, bestStreak: 0, bestEver: 0, plays: 0 };
}

export function advanceDaily(prior: DailyRecord, date: string, score: number): DailyRecord {
  if (!isDailyDate(date)) return prior;
  if (prior.date === date) {
    return { ...prior, best: Math.max(prior.best, score), bestEver: Math.max(prior.bestEver, score), plays: prior.plays + 1 };
  }
  if (prior.date && prior.date > date) return prior;
  const streak = prior.date === previousDate(date) ? prior.streak + 1 : 1;
  return { date, best: score, streak, bestStreak: Math.max(prior.bestStreak, streak), bestEver: Math.max(prior.bestEver, score), plays: prior.plays + 1 };
}

export function currentStreak(record: DailyRecord, today: string): number {
  return record.date === today || record.date === previousDate(today) ? record.streak : 0;
}
