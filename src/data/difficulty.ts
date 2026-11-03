export type DifficultyId = "easy" | "normal" | "hard" | "nightmare";

export const DIFFICULTY_ORDER: DifficultyId[] = ["easy", "normal", "hard", "nightmare"];

export const DIFFICULTY_LABEL: Record<DifficultyId, string> = {
  easy: "EASY",
  normal: "NORMAL",
  hard: "HARD",
  nightmare: "NIGHTMARE",
};

export type DifficultyDef = {
  id: DifficultyId;
  spawnMult: number;
  enemyHpMult: number;
  enemySpeedMult: number;
  playerDamageTakenMult: number;
  shardMult: number;
};

export const DIFFICULTY: Record<DifficultyId, DifficultyDef> = {
  easy: { id: "easy", spawnMult: 0.72, enemyHpMult: 0.82, enemySpeedMult: 0.88, playerDamageTakenMult: 0.42, shardMult: 0.5 },
  normal: { id: "normal", spawnMult: 1, enemyHpMult: 1, enemySpeedMult: 1, playerDamageTakenMult: 0.7, shardMult: 1 },
  hard: { id: "hard", spawnMult: 1.22, enemyHpMult: 1.28, enemySpeedMult: 1.12, playerDamageTakenMult: 1, shardMult: 1.5 },
  nightmare: { id: "nightmare", spawnMult: 1.55, enemyHpMult: 1.55, enemySpeedMult: 1.25, playerDamageTakenMult: 1.25, shardMult: 2 },
};

export function difficultyFromClick(mx: number, my: number, w: number, h: number): DifficultyId | null {
  const y0 = h * 0.905;
  const y1 = h * 0.96;
  if (my < y0 || my > y1) return null;
  const col = Math.floor((mx / w) * 4);
  return DIFFICULTY_ORDER[clamp(col, 0, 3)]!;
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
