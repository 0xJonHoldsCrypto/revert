import type { EnemyKind, SidekickKind } from "../types";
import { getRigSprite } from "./gbcArt";
import { getThreatSprite } from "./threatArt";

const cache = new Map<string, HTMLCanvasElement>();

function fit(native: HTMLCanvasElement, size: number) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const scale = Math.min(size / native.width, size / native.height);
  const dw = Math.max(1, Math.round(native.width * scale));
  const dh = Math.max(1, Math.round(native.height * scale));
  ctx.drawImage(native, Math.floor((size - dw) / 2), Math.floor((size - dh) / 2), dw, dh);
  return canvas;
}

export function getEnemySpriteCanvas(kind: EnemyKind, size = 96): HTMLCanvasElement {
  const key = `e-${kind}-${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = fit(getThreatSprite(kind), size);
  cache.set(key, canvas);
  return canvas;
}

export function getSidekickSpriteCanvas(kind: SidekickKind, size = 96): HTMLCanvasElement {
  const key = `s-${kind}-${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = fit(getRigSprite(kind), size);
  cache.set(key, canvas);
  return canvas;
}

export function drawEnemySprite(
  ctx: CanvasRenderingContext2D,
  kind: EnemyKind,
  x: number,
  y: number,
  size: number,
  flash = false
) {
  const sheet = getEnemySpriteCanvas(kind, 96);
  ctx.imageSmoothingEnabled = false;
  if (flash) {
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "#fff";
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    ctx.globalAlpha = 1;
  }
  ctx.drawImage(sheet, x - size / 2, y - size / 2, size, size);
}

export function drawSidekickSprite(ctx: CanvasRenderingContext2D, kind: SidekickKind, x: number, y: number, size: number) {
  const sheet = getSidekickSpriteCanvas(kind, 96);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, x - size / 2, y - size / 2, size, size);
}
