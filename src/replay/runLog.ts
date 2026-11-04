import type { CharacterId } from "../types";
import type { DifficultyId } from "../data/difficulty";
import { isDailyDate } from "../daily";
import { perksAreValid, type MetaPerkRanks } from "../data/metaPerks";
import { modifiersAreValid, type ModifierId } from "../data/modifiers";
import { unlockedListIsValid } from "../data/unlocks";
import { cleanSetup, isRanked, type RunMode, type RunSetup } from "../game/runSetup";

export const SIM_VERSION = 3;
export const RUN_LOG_FORMAT = 2;
export const CHECKPOINT_TICKS = 600;
const MOVE_DIRECTIONS = 256;
const MAX_LOG_CHARS = 8_000_000;

export type ChoiceType = "pick" | "reroll" | "skip" | "banish";
export type RunChoice = [tick: number, type: ChoiceType, index: number];

export type RunLog = {
  format: number;
  sim: number;
  seed: number;
  hero: CharacterId;
  difficulty: DifficultyId;
  tainted: boolean;
  perks: MetaPerkRanks;
  mods: ModifierId[];
  unlocked: string[];
  mode: RunMode;
  date: string | null;
  ranked: boolean;
  ticks: number;
  moves: number[];
  dashes: number[];
  abilities: number[];
  choices: RunChoice[];
  aspects: [tick: number, aspect: number][];
  checkpoints: number[];
  finalHash: number;
};

export function encodeMove(v: { x: number; y: number }): number {
  if (v.x === 0 && v.y === 0) return 0;
  const turn = Math.atan2(v.y, v.x) / (Math.PI * 2);
  return ((Math.round(turn * MOVE_DIRECTIONS) + MOVE_DIRECTIONS) % MOVE_DIRECTIONS) + 1;
}

export function decodeMove(code: number): { x: number; y: number } {
  if (code === 0) return { x: 0, y: 0 };
  const angle = ((code - 1) / MOVE_DIRECTIONS) * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

export function roundAspect(aspect: number): number {
  return Math.round(aspect * 1000) / 1000;
}

export class RunRecorder {
  private log: RunLog;
  private moveCode = -1;
  private moveTicks = 0;

  constructor(seed: number, hero: CharacterId, difficulty: DifficultyId, setup: RunSetup) {
    const clean = cleanSetup(setup);
    this.log = {
      format: RUN_LOG_FORMAT,
      sim: SIM_VERSION,
      seed,
      hero,
      difficulty,
      tainted: false,
      perks: clean.perks,
      mods: clean.mods,
      unlocked: clean.unlocked,
      mode: clean.mode,
      date: clean.date,
      ranked: isRanked(clean),
      ticks: 0,
      moves: [],
      dashes: [],
      abilities: [],
      choices: [],
      aspects: [],
      checkpoints: [],
      finalHash: 0,
    };
  }

  move(code: number) {
    if (code === this.moveCode) {
      this.moveTicks++;
      return;
    }
    this.flushMove();
    this.moveCode = code;
    this.moveTicks = 1;
  }

  dash(tick: number) {
    this.log.dashes.push(tick);
  }

  ability(tick: number) {
    this.log.abilities.push(tick);
  }

  choice(tick: number, type: ChoiceType, index: number) {
    this.log.choices.push([tick, type, index]);
  }

  aspect(tick: number, aspect: number) {
    this.log.aspects.push([tick, aspect]);
  }

  checkpoint(hash: number) {
    this.log.checkpoints.push(hash);
  }

  get tainted(): boolean {
    return this.log.tainted;
  }

  taint() {
    this.log.tainted = true;
  }

  finish(ticks: number, finalHash: number): RunLog {
    this.flushMove();
    this.moveCode = -1;
    this.moveTicks = 0;
    this.log.ticks = ticks;
    this.log.finalHash = finalHash;
    return structuredClone(this.log);
  }

  private flushMove() {
    if (this.moveTicks > 0) this.log.moves.push(this.moveCode, this.moveTicks);
  }
}

export function serializeRunLog(log: RunLog): string {
  return JSON.stringify(log);
}

function isIntList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((n) => Number.isInteger(n) && n >= 0);
}

export const CHOICE_TYPES: ChoiceType[] = ["pick", "reroll", "skip", "banish"];

export function parseRunLog(text: string): RunLog | null {
  if (text.length > MAX_LOG_CHARS) return null;
  let raw: Partial<RunLog>;
  try {
    raw = JSON.parse(text) as Partial<RunLog>;
  } catch {
    return null;
  }
  return validateRunLog(raw);
}

export function validateRunLog(raw: Partial<RunLog> | null): RunLog | null {
  if (!raw || typeof raw !== "object") return null;
  if (raw.format !== RUN_LOG_FORMAT || !Number.isInteger(raw.sim) || !Number.isInteger(raw.seed) || !Number.isInteger(raw.ticks)) return null;
  if (typeof raw.hero !== "string" || typeof raw.difficulty !== "string") return null;
  if (!isIntList(raw.moves) || !isIntList(raw.dashes) || !isIntList(raw.abilities) || !isIntList(raw.checkpoints)) return null;
  if (raw.moves.length % 2 !== 0 || raw.moves.some((n, i) => (i % 2 === 0 ? n > MOVE_DIRECTIONS : n < 1))) return null;
  if (!Array.isArray(raw.choices) || !Array.isArray(raw.aspects)) return null;
  if (!perksAreValid(raw.perks) || !modifiersAreValid(raw.mods) || !unlockedListIsValid(raw.unlocked)) return null;
  if (raw.mode !== "standard" && raw.mode !== "daily") return null;
  if (raw.mode === "daily" ? !isDailyDate(raw.date) : raw.date !== null) return null;
  if (typeof raw.ranked !== "boolean" || raw.ranked !== isRanked(setupOf(raw as RunLog))) return null;
  return raw as RunLog;
}

export function setupOf(log: RunLog): RunSetup {
  return { perks: { ...log.perks }, mods: [...log.mods], unlocked: [...log.unlocked], mode: log.mode, date: log.date };
}
