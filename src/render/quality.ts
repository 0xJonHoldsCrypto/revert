export type QualityTier = "high" | "medium" | "low";

export type QualitySettings = {
  shadowSize: number;
  bloom: boolean;
  tiltShift: boolean;
  pointLights: number;
  maxDpr: number;
};

export const QUALITY: Record<QualityTier, QualitySettings> = {
  high: { shadowSize: 2048, bloom: true, tiltShift: true, pointLights: 4, maxDpr: 2 },
  medium: { shadowSize: 1024, bloom: false, tiltShift: true, pointLights: 2, maxDpr: 1.5 },
  low: { shadowSize: 0, bloom: false, tiltShift: false, pointLights: 0, maxDpr: 1 },
};

export function pickQualityTier(): QualityTier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 8;
  if (window.matchMedia("(pointer: coarse)").matches) return cores <= 4 || memory <= 3 ? "low" : "medium";
  return cores >= 8 && memory >= 8 ? "high" : "medium";
}

const SLOW_FRAME_MS = 18.5;
const FAST_FRAME_MS = 17.2;
const SCALE_STEP = 0.85;
const MIN_SCALE = 0.5;
const SETTLE_FRAMES = 45;

export class DynamicResolution {
  scale = 1;
  private average = 16;
  private settle = SETTLE_FRAMES;

  update(frameMs: number): boolean {
    this.average += (Math.min(frameMs, 100) - this.average) * 0.05;
    if (this.settle > 0) {
      this.settle--;
      return false;
    }
    if (this.average > SLOW_FRAME_MS && this.scale > MIN_SCALE) {
      this.scale = Math.max(MIN_SCALE, this.scale * SCALE_STEP);
      this.settle = SETTLE_FRAMES;
      return true;
    }
    if (this.average < FAST_FRAME_MS && this.scale < 1) {
      this.scale = Math.min(1, this.scale / SCALE_STEP);
      this.settle = SETTLE_FRAMES * 4;
      return true;
    }
    return false;
  }
}
