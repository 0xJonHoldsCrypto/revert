import * as save from "./save";

export type HapticKind = "hurt" | "levelUp" | "dash" | "boss" | "ascend" | "surge" | "overclock" | "ready";

export const HAPTIC_PATTERNS: Record<HapticKind, number | number[]> = {
  hurt: [40, 30, 60],
  levelUp: [20, 40, 20, 40, 80],
  dash: 18,
  boss: [120, 60, 120, 60, 240],
  ascend: [30, 40, 60, 40, 140],
  surge: [40, 30, 40, 30, 120],
  overclock: [60, 30, 100],
  ready: [25, 40, 25],
};

const MIN_GAP_MS = 80;
let lastAt = 0;

export function haptic(kind: HapticKind, now = Date.now()) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (!save.get().settings.haptics) return;
  if (now - lastAt < MIN_GAP_MS) return;
  lastAt = now;
  try {
    navigator.vibrate(HAPTIC_PATTERNS[kind]);
  } catch {
    return;
  }
}
