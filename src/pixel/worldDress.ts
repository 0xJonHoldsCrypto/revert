import { blank, blitTone, fillClump, finishSprite, putPx, rampTones } from "./spriteUtil";

export type PropKind = "tree" | "bush" | "barrel" | "fire";

const cache = new Map<PropKind, HTMLCanvasElement>();

function volume(data: Uint8ClampedArray, w: number, h: number, x: number, y: number, fw: number, fh: number, depth: number, base: string) {
  const tones = rampTones(base);
  blitTone(data, w, h, x + fw - 3, y + Math.floor(depth * 0.4), depth, fh, tones, "side");
  blitTone(data, w, h, x, y + depth, fw, fh, tones, "front");
  blitTone(data, w, h, x + 2, y, fw - 2, depth, tones, "top");
}

function paintProp(kind: PropKind) {
  const w = 72;
  const h = 84;
  const data = blank(w, h);
  if (kind === "tree") {
    volume(data, w, h, 18, 8, 28, 58, 12, "#8a938c");
    const led = rampTones("#7ee787");
    for (let i = 0; i < 4; i++) {
      blitTone(data, w, h, 24, 26 + i * 10, 18, 3, rampTones("#1a221c"), "front");
      putPx(data, w, h, 26, 27 + i * 10, led[0]!);
    }
  } else if (kind === "bush") {
    const wood = rampTones("#a87848");
    const cable = rampTones("#2a241c");
    fillClump(data, w, h, 36, 50, 22, 16, wood, 0.1);
    fillClump(data, w, h, 34, 28, 18, 8, wood, -0.25);
    fillClump(data, w, h, 34, 28, 7, 3, cable, 0.15);
    fillClump(data, w, h, 36, 50, 12, 6, cable, 0.05);
  } else if (kind === "barrel") {
    volume(data, w, h, 14, 16, 32, 46, 12, "#9aa398");
    putPx(data, w, h, 22, 36, "#7ee787");
    putPx(data, w, h, 26, 36, "#f0b429");
    putPx(data, w, h, 22, 44, "#7ee787");
  } else {
    const warn = rampTones("#e2b43a");
    const band = rampTones("#1a1a1a");
    for (let y = 10; y < 64; y++) {
      const reach = 3 + Math.floor((y - 10) * 0.4);
      const tones = (y - 10) % 12 < 5 ? band : warn;
      for (let x = -reach; x <= reach; x++) {
        const u = reach === 0 ? 0.5 : (x + reach) / (reach * 2);
        putPx(data, w, h, 34 + x, y, tones[u < 0.42 ? 1 : u < 0.7 ? 3 : 5]!);
      }
    }
    fillClump(data, w, h, 34, 12, 5, 2.2, warn, -0.35);
  }
  return finishSprite(data, w, h);
}

export function getPropCanvas(kind: PropKind): HTMLCanvasElement {
  const hit = cache.get(kind);
  if (hit) return hit;
  const canvas = paintProp(kind);
  cache.set(kind, canvas);
  return canvas;
}

export function makeFieldCanvas(biome: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const S = 512;
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const bases: Record<string, [string, string, string]> = {
    wasteland: ["#3d7a44", "#4e8a52", "#2c5a34"],
    cex: ["#3a3a52", "#4a4a68", "#2a2a40"],
    defi: ["#145868", "#1e7890", "#0e3e4c"],
    apt: ["#3a2048", "#542868", "#281434"],
  };
  const [a, b, c] = bases[biome] ?? bases.wasteland!;
  const img = ctx.createImageData(S, S);
  const data = img.data;
  const parse = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
  };
  const base = parse(a);
  const light = parse(b);
  const dark = parse(c);
  for (let i = 0; i < S * S; i++) {
    const o = i * 4;
    data[o] = base[0];
    data[o + 1] = base[1];
    data[o + 2] = base[2];
    data[o + 3] = 255;
  }
  const marks = Math.floor(S * S * 0.03);
  for (let i = 0; i < marks; i++) {
    let n = (i * 374761393) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    const x = (n >>> 0) % S;
    const y = ((Math.imul(n, 1664525) >>> 0) + i) % S;
    const col = i % 5 === 0 ? light : dark;
    const o = (y * S + x) * 4;
    data[o] = col[0];
    data[o + 1] = col[1];
    data[o + 2] = col[2];
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
