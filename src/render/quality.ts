export type QualityTier = "high" | "medium" | "low";

export type QualitySettings = {
  shadowSize: number;
  bloom: boolean;
  tiltShift: boolean;
  pointLights: number;
  maxDpr: number;
};

export const QUALITY: Record<QualityTier, QualitySettings> = {
  high: { shadowSize: 2048, bloom: true, tiltShift: true, pointLights: 4, maxDpr: 1.5 },
  medium: { shadowSize: 1024, bloom: false, tiltShift: true, pointLights: 2, maxDpr: 1.5 },
  low: { shadowSize: 0, bloom: false, tiltShift: false, pointLights: 0, maxDpr: 1 },
};

export function pickQualityTier(): QualityTier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 8;
  if (window.matchMedia("(pointer: coarse)").matches) return cores <= 4 || memory <= 3 ? "low" : "medium";
  return "medium";
}

export function canPromoteToHigh(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (window.matchMedia("(pointer: coarse)").matches) return false;
  return (nav.hardwareConcurrency ?? 4) >= 8 && (nav.deviceMemory ?? 8) >= 8;
}

const PROMOTE_FRAME_MS = 17.6;
const PROMOTE_FRAMES = 150;

export class TierPromoter {
  private good = 0;
  private done = false;

  constructor(private enabled: boolean) {}

  update(frameMs: number, scale: number): boolean {
    if (this.done || !this.enabled) return false;
    if (frameMs > PROMOTE_FRAME_MS || scale < 1) {
      this.good = 0;
      return false;
    }
    if (++this.good < PROMOTE_FRAMES) return false;
    this.done = true;
    return true;
  }

  retire() {
    this.done = true;
  }
}

const SLOW_FRAME_MS = 18.2;
const FAST_FRAME_MS = 16.9;
const SCALE_STEP = 0.85;
const MIN_SCALE = 0.5;
const SETTLE_FRAMES = 20;

export class DynamicResolution {
  scale = 1;
  private average = 16;
  private settle = SETTLE_FRAMES;

  update(frameMs: number): boolean {
    this.average += (Math.min(frameMs, 100) - this.average) * 0.12;
    if (this.settle > 0) {
      this.settle--;
      return false;
    }
    if (this.average > SLOW_FRAME_MS && this.scale > MIN_SCALE) {
      this.scale = Math.max(MIN_SCALE, this.scale * (this.average > 28 ? SCALE_STEP * SCALE_STEP : SCALE_STEP));
      this.settle = SETTLE_FRAMES;
      return true;
    }
    if (this.average < FAST_FRAME_MS && this.scale < 1) {
      this.scale = Math.min(1, this.scale / SCALE_STEP);
      this.settle = SETTLE_FRAMES * 6;
      return true;
    }
    return false;
  }
}
