import type * as THREE from "three";
import type { CharacterId } from "../types";
import { BODY_FRAMES, getBodyFrame, getBodySheet } from "../pixel/bodies";
import { getPortraitCanvas } from "../pixel/portraits";
import { getEnemySpriteCanvas, getSidekickSpriteCanvas } from "../pixel/enemySprites";

export function canvasToPixelTexture(
  THREE: typeof import("three"),
  canvas: HTMLCanvasElement,
  opts?: { repeat?: boolean }
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  if (opts?.repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  return tex;
}

export function makeGrassTexture(THREE: typeof import("three"), size = 128): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const checker = ((x >> 3) + (y >> 3)) % 2;
      ctx.fillStyle = checker ? "#2a5234" : "#234628";
      ctx.fillRect(x, y, 1, 1);
    }
  }
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = i % 2 ? "#3d7a48" : "#356840";
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 2);
  }
  return canvasToPixelTexture(THREE, canvas, { repeat: true });
}

export function makeTitleGrassTexture(THREE: typeof import("three")): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#1f4a2e");
  g.addColorStop(1, "#152618");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 4) {
    for (let x = 0; x < 256; x += 4) {
      if (Math.random() > 0.55) {
        ctx.fillStyle = Math.random() > 0.5 ? "#3a6b42" : "#2d5536";
        ctx.fillRect(x, y, 3, 3);
      }
    }
  }
  return canvasToPixelTexture(THREE, canvas, { repeat: true });
}

const walkCache = new Map<string, HTMLCanvasElement>();

export function makeBiomeTileTexture(
  THREE: typeof import("three"),
  biome: string,
  checker: boolean,
  size = 32
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const palettes: Record<string, [string, string]> = {
    mempool: ["#3d7a45", "#2f6236"],
    vault: ["#4a4a6e", "#353552"],
    bridge: ["#1e6a78", "#14505c"],
    forest: ["#5a3068", "#3a2048"],
  };
  const [a, b] = palettes[biome] ?? palettes.mempool!;
  ctx.fillStyle = checker ? a : b;
  ctx.fillRect(0, 0, size, size);
  if (checker && biome === "bridge") {
    ctx.fillStyle = "#33ff66";
    ctx.fillRect(size / 2 - 2, size / 2 - 2, 4, 4);
  }
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = checker ? b : a;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  return canvasToPixelTexture(THREE, canvas);
}

export function getWalkSheetCanvas(id: CharacterId | "hacker", frames = BODY_FRAMES, frameSize = 128): HTMLCanvasElement {
  const key = `${id}-${frames}-${frameSize}`;
  const hit = walkCache.get(key);
  if (hit) return hit;

  const sheet = id === "hacker" ? null : getBodySheet(id);
  const canvas = document.createElement("canvas");
  canvas.width = frameSize * frames;
  canvas.height = frameSize;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  if (sheet) {
    const fw = sheet.width / BODY_FRAMES;
    const destH = Math.floor(frameSize * (sheet.height / fw));
    const destW = Math.floor(frameSize * 0.72);
    const y = frameSize - destH - 4;
    for (let f = 0; f < frames; f++) {
      const sx = Math.floor((f % BODY_FRAMES) * fw);
      ctx.drawImage(sheet, sx, 0, fw, sheet.height, f * frameSize + (frameSize - destW) / 2, y, destW, destH);
    }
  } else {
    const base = getPortraitCanvas("hacker", 96);
    ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
  }
  walkCache.set(key, canvas);
  return canvas;
}

export function makeBodyTexture(THREE: typeof import("three"), id: CharacterId): THREE.CanvasTexture {
  const frame = getBodyFrame(id, 1);
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 160;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const destW = 96;
  const destH = Math.floor(96 * (frame.height / frame.width));
  ctx.drawImage(frame, (128 - destW) / 2, 160 - destH - 8, destW, destH);
  return canvasToPixelTexture(THREE, canvas);
}

export function makeWalkTexture(THREE: typeof import("three"), id: CharacterId): THREE.CanvasTexture {
  const canvas = getWalkSheetCanvas(id);
  const tex = canvasToPixelTexture(THREE, canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  return tex;
}

export function makePortraitTexture(
  THREE: typeof import("three"),
  id: CharacterId | "hacker" | "trace",
  size = 256
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const base = getPortraitCanvas(id, 128);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base, 0, 0, size, size);
  return canvasToPixelTexture(THREE, canvas);
}

export function makeEnemyTexture(THREE: typeof import("three"), kind: import("../types").EnemyKind): THREE.CanvasTexture {
  const canvas = getEnemySpriteCanvas(kind, 128);
  return canvasToPixelTexture(THREE, canvas);
}

export function makeSidekickTexture(
  THREE: typeof import("three"),
  kind: import("../types").SidekickKind
): THREE.CanvasTexture {
  const canvas = getSidekickSpriteCanvas(kind, 128);
  return canvasToPixelTexture(THREE, canvas);
}

export function makeCoinTexture(THREE: typeof import("three")): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f0b429";
  ctx.beginPath();
  ctx.arc(16, 16, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#9a6700";
  ctx.fillRect(12, 10, 8, 12);
  return canvasToPixelTexture(THREE, canvas);
}
