import type { DifficultyId } from "./difficulty";

export type TracePool = "kills" | "poi";

export const TRACE = {
  goal: 100,
  perSec: 0.033,
  boss: 6.5,
  drainer: 0.9,
  bounty: 4,
  whale: 1.3,
  merge: 2,
  pad: 0.8,
  rig: 1.5,
  pools: { kills: { head: 2, perMin: 1 }, poi: { head: 1.5, perMin: 0.7 } } as Record<TracePool, { head: number; perMin: number }>,
  milestones: [25, 50, 75],
};

export const TRACE_RATE: Record<DifficultyId, number> = { easy: 1.2, normal: 1, hard: 0.96, nightmare: 0.92 };

export const TRACE_MILESTONE_TEXT = ["Wallet cluster found.", "Bridge hops mapped.", "One signature away."];

export const FINALE = {
  hp: 24000,
  damageScale: 3.4,
  phaseTwoAt: 0.66,
  phaseThreeAt: 0.33,
  decoyCount: 4,
  decoyFuse: 9,
  decoyArm: 1.3,
  decoyHp: 210,
  decoyShieldMult: 0.2,
  decoyEverySec: 15,
  drainPerSec: 2_200_000,
  drainFloor: 0.08,
  drainerEverySec: 14,
  maxDrainers: 3,
  ringGrow: 360,
  ringStart: 70,
  ringWindup: 1.5,
  ringActive: 2.6,
  phaseBeatSec: 1.6,
  openingDelaySec: 2.6,
};

export const WIN = {
  scoreBonus: 20000,
  speedBonusCapSec: 1800,
  speedBonusPerSec: 5,
  shards: 80,
  fastSec: 900,
  loopSec: 60,
  encoreSec: 600,
};

export const TRACE_DEBUG = { rateMult: 1, finaleHpMult: 1 };

export function traceRate(difficulty: DifficultyId): number {
  return TRACE_RATE[difficulty] * TRACE_DEBUG.rateMult;
}

export function winScoreBonus(winTime: number): number {
  return WIN.scoreBonus + Math.max(0, WIN.speedBonusCapSec - winTime) * WIN.speedBonusPerSec;
}
