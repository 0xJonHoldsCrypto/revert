export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function len(x: number, y: number): number {
  return Math.hypot(x, y);
}

export function normalize(x: number, y: number): { x: number; y: number } {
  const l = len(x, y);
  if (l < 1e-6) return { x: 0, y: 0 };
  return { x: x / l, y: y / l };
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function angleBetween(ax: number, ay: number, bx: number, by: number): number {
  return Math.atan2(by - ay, bx - ax);
}

export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

let simState = 1;
let spawnState = 1;
let lootState = 1;

function deriveSeed(seed: number, salt: number): number {
  const mixed = Math.imul((seed ^ salt) >>> 0, 2654435761);
  return (mixed ^ (mixed >>> 15)) >>> 0;
}

function nextState(state: number): number {
  return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}

export function seedSim(seed: number) {
  simState = seed >>> 0;
  spawnState = deriveSeed(seed, 0x5bd1e995);
  lootState = deriveSeed(seed, 0x27d4eb2f);
}

export function spawnRandom(): number {
  spawnState = nextState(spawnState);
  return spawnState / 2 ** 32;
}

export function lootRandom(): number {
  lootState = nextState(lootState);
  return lootState / 2 ** 32;
}

export function cosmeticRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function simRandom(): number {
  simState = (simState * 1664525 + 1013904223) >>> 0;
  return simState / 2 ** 32;
}

export function randRange(min: number, max: number): number {
  return min + simRandom() * (max - min);
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(simRandom() * arr.length)]!;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(simRandom() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function rectsOverlap(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number
): boolean {
  const d = dist(ax, ay, bx, by);
  return d < ar + br;
}
