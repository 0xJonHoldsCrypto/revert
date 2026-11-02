import type { CharacterId } from "../types";
import type { BiomeId } from "../data/environment";
import { blank, fillClump, finishSprite, putPx, rampTones, type Tone } from "./spriteUtil";

const fieldCache = new Map<BiomeId, HTMLCanvasElement>();
const heroCache = new Map<string, HTMLCanvasElement>();
const patchCache = new Map<string, HTMLCanvasElement>();

const FIELD: Record<BiomeId, { base: string; light: string; dark: string; spec: string; dirt: string; scrub: string }> = {
  mempool: { base: "#6ea84a", light: "#8ec45e", dark: "#4e8434", spec: "#d8e88a", dirt: "#7a5a34", scrub: "#3e7a32" },
  vault: { base: "#6a7048", light: "#8a9060", dark: "#4a5030", spec: "#d8d8a0", dirt: "#6a6244", scrub: "#545a30" },
  bridge: { base: "#3e8a78", light: "#5eaa96", dark: "#2a6858", spec: "#c8f0d8", dirt: "#3a6858", scrub: "#1e6454" },
  forest: { base: "#6a4878", light: "#8a6898", dark: "#4a3058", spec: "#e0c8f0", dirt: "#5a4060", scrub: "#4a3068" },
};

function mixHash(x: number, y: number) {
  let n = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n >>> 0) / 4294967296;
}

function rgb(hex: string): Tone {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function getFieldTexture(biome: BiomeId): HTMLCanvasElement {
  const hit = fieldCache.get(biome);
  if (hit) return hit;
  const pal = FIELD[biome];
  const S = 768;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  const data = img.data;
  const base = rgb(pal.base);
  const mixToward = (tone: Tone, t: number): Tone => [
    Math.round(base[0] + (tone[0] - base[0]) * t),
    Math.round(base[1] + (tone[1] - base[1]) * t),
    Math.round(base[2] + (tone[2] - base[2]) * t),
  ];
  const light = mixToward(rgb(pal.light), 0.72);
  const dark = mixToward(rgb(pal.dark), 0.78);
  const spec = mixToward(rgb(pal.spec), 0.55);
  for (let i = 0; i < S * S; i++) {
    const o = i * 4;
    data[o] = base[0];
    data[o + 1] = base[1];
    data[o + 2] = base[2];
    data[o + 3] = 255;
  }
  const marks = Math.floor(S * S * 0.0045);
  for (let i = 0; i < marks; i++) {
    const x = Math.floor(mixHash(i, 3) * S);
    const y = Math.floor(mixHash(i, 9) * S);
    const roll = mixHash(i, 21);
    const col = roll > 0.97 ? spec : roll > 0.62 ? light : dark;
    const mw = roll > 0.88 ? 2 : 1;
    const mh = roll > 0.62 && roll < 0.74 ? 2 : 1;
    for (let yy = 0; yy < mh; yy++) {
      for (let xx = 0; xx < mw; xx++) {
        const px = (x + xx) % S;
        const py = (y + yy) % S;
        const o = (py * S + px) * 4;
        data[o] = col[0];
        data[o + 1] = col[1];
        data[o + 2] = col[2];
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  fieldCache.set(biome, canvas);
  return canvas;
}

export function getGroundPatch(biome: BiomeId, variant: number): HTMLCanvasElement {
  const key = `${biome}-${variant % 8}`;
  const hit = patchCache.get(key);
  if (hit) return hit;
  const pal = FIELD[biome];
  const scrub = variant % 8 >= 5;
  const w = 96 + (variant % 4) * 18;
  const h = 58 + (variant % 3) * 12;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const col = rgb(scrub ? pal.scrub : pal.dirt);
  const hi = rgb(scrub ? pal.light : pal.spec);
  const lo = rgb(pal.dark);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x - w * 0.48) / (w * 0.42);
      const ny = (y - h * 0.55) / (h * 0.36);
      const warp = (mixHash((x >> 2) + variant * 13, (y >> 2) + 4) - 0.5) * 0.55;
      if (nx * nx + ny * ny > 1 + warp) continue;
      const n = mixHash(x + variant * 17, y * 3);
      const edge = nx * nx + ny * ny;
      if (edge > 0.9 && n > 0.35) continue;
      const tone = n < 0.07 ? lo : n > 0.97 ? hi : col;
      const o = (y * w + x) * 4;
      data[o] = tone[0];
      data[o + 1] = tone[1];
      data[o + 2] = tone[2];
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  patchCache.set(key, canvas);
  return canvas;
}

export function paintGrassPatch(biome: BiomeId, variant = 0): HTMLCanvasElement {
  return getGroundPatch(biome, variant + 5);
}

type Look = { hair: string; skin: string; shirt: string; pants: string; shoe: string; accent: string };

const LOOK: Record<CharacterId, Look> = {
  keel: { hair: "#1a120c", skin: "#e0b090", shirt: "#12362f", pants: "#1a1e24", shoe: "#111111", accent: "#2ee6c7" },
  nyx: { hair: "#2a2418", skin: "#e8c4a8", shirt: "#16181e", pants: "#243044", shoe: "#101014", accent: "#6cb6ff" },
  diff: { hair: "#3a2418", skin: "#f0c8a4", shirt: "#2a3140", pants: "#1c2128", shoe: "#141414", accent: "#f0c14d" },
  "trace": { hair: "#10141c", skin: "#e8c4a8", shirt: "#1a2438", pants: "#141820", shoe: "#0c0c0c", accent: "#9b8cff" },
};

export function getSideHero(id: CharacterId, step: number): HTMLCanvasElement {
  const key = `${id}-${step % 2}`;
  const hit = heroCache.get(key);
  if (hit) return hit;
  const canvas = paintHero(id, step % 2);
  heroCache.set(key, canvas);
  return canvas;
}

function limb(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  tones: Tone[],
) {
  const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fillClump(data, w, h, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius, radius * 0.85, tones, t * 0.15);
  }
}

function paintHero(id: CharacterId, step: number): HTMLCanvasElement {
  const w = 86;
  const h = 112;
  const data = blank(w, h);
  const look = LOOK[id];
  const hair = rampTones(look.hair);
  const skin = rampTones(look.skin);
  const shirt = rampTones(look.shirt);
  const pants = rampTones(look.pants);
  const shoe = rampTones(look.shoe);
  const accent = rampTones(look.accent);
  const swing = step === 0 ? 4 : -4;
  const bob = step === 0 ? 0 : 1;
  const hip = 78 + bob;
  const shoulder = 48 + bob;

  limb(data, w, h, 40, hip, 30, 100 + swing * 0.3, 4.2, pants);
  limb(data, w, h, 52, hip, 60, 100 - swing * 0.3, 4.4, pants);
  limb(data, w, h, 30, 100, 22, 106, 5.2, shoe);
  limb(data, w, h, 60, 100, 70, 106, 5.4, shoe);

  limb(data, w, h, 34, shoulder + 4, 24, 70 + swing, 3.6, shirt);
  limb(data, w, h, 24, 70 + swing, 20, 84 + swing * 0.4, 2.8, skin);
  limb(data, w, h, 56, shoulder, 70, 64 - swing * 0.4, 3.6, shirt);
  limb(data, w, h, 70, 64 - swing * 0.4, 74, 76, 2.6, skin);

  fillClump(data, w, h, 46, 62 + bob, 12, 16, shirt, 0);
  fillClump(data, w, h, 46, 74 + bob, 8, 3, rampTones("#10141c"), 0.1);
  for (let i = 0; i < 4; i++) putPx(data, w, h, 40 + i * 3, 58 + bob, accent[1]!);

  fillClump(data, w, h, 48, 44 + bob, 4, 4, skin, 0.05);
  fillClump(data, w, h, 54, 30 + bob, 10, 11, skin, 0);
  fillClump(data, w, h, 42, 26 + bob, 11, 7, hair, -0.1);
  fillClump(data, w, h, 50, 20 + bob, 9, 5, hair, -0.2);
  if (id === "diff") fillClump(data, w, h, 62, 24 + bob, 6, 8, hair, 0);
  if (id === "nyx") fillClump(data, w, h, 38, 32 + bob, 5, 8, hair, 0.05);
  if (id === "trace" || id === "keel") {
    fillClump(data, w, h, 58, 30 + bob, 8, 3.2, accent, -0.35);
    putPx(data, w, h, 62, 30 + bob, "#f4feff");
  } else {
    fillClump(data, w, h, 62, 29 + bob, 2.2, 2.2, rampTones("#f7fbff"), -0.4);
    fillClump(data, w, h, 63, 30 + bob, 1.1, 1.1, rampTones("#1a120c"), 0.2);
  }
  putPx(data, w, h, 64, 33 + bob, skin[4]!);
  putPx(data, w, h, 65, 34 + bob, skin[5]!);
  putPx(data, w, h, 62, 37 + bob, skin[5]!);
  putPx(data, w, h, 63, 37 + bob, skin[4]!);

  fillClump(data, w, h, 76, 70, 5, 4, rampTones("#0c1210"), 0.1);
  fillClump(data, w, h, 78, 68, 3.2, 2.4, accent, -0.3);

  return finishSprite(data, w, h);
}

export function fieldColors(biome: BiomeId) {
  return FIELD[biome];
}
