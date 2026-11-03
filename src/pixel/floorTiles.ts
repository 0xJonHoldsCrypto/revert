import type { BiomeId } from "../data/environment";

export type FloorCanvases = { albedo: HTMLCanvasElement; emissive: HTMLCanvasElement };

type FloorStyle = { panel: string; panelAlt: string; seam: string; glow: string; density: number; pattern: "grid" | "grate" | "plank" | "rock" | "frost" };

const STYLES: Record<BiomeId, FloorStyle> = {
  mempool: { panel: "#3f4757", panelAlt: "#394050", seam: "#1d2230", glow: "#2ee6c7", density: 0.28, pattern: "grid" },
  vault: { panel: "#54494c", panelAlt: "#4a4043", seam: "#241c1e", glow: "#ff6a3c", density: 0.2, pattern: "grate" },
  bridge: { panel: "#4a5c60", panelAlt: "#415256", seam: "#1b2a2e", glow: "#6cb6ff", density: 0.26, pattern: "plank" },
  forest: { panel: "#2f2a42", panelAlt: "#292439", seam: "#14101f", glow: "#d05cff", density: 0.16, pattern: "rock" },
  cold: { panel: "#3f5868", panelAlt: "#3a5160", seam: "#172430", glow: "#9fe8ff", density: 0.22, pattern: "frost" },
};

const SIZE = 256;
const PANEL = 64;

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  return [c, c.getContext("2d")!];
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function speckle(a: CanvasRenderingContext2D, rnd: () => number, px: number, py: number) {
  for (let i = 0; i < 26; i++) {
    a.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.07)";
    a.fillRect(px + Math.floor(rnd() * PANEL), py + Math.floor(rnd() * PANEL), 1 + Math.floor(rnd() * 3), 1);
  }
}

function panelGrid(a: CanvasRenderingContext2D, style: FloorStyle, px: number, py: number) {
  a.fillStyle = style.seam;
  a.fillRect(px, py, PANEL, 2);
  a.fillRect(px, py, 2, PANEL);
  a.fillStyle = "rgba(255,255,255,0.1)";
  a.fillRect(px + 2, py + 2, PANEL - 2, 1);
  a.fillRect(px + 2, py + 2, 1, PANEL - 2);
  a.fillStyle = style.seam;
  for (const [rx, ry] of [[6, 6], [PANEL - 7, 6], [6, PANEL - 7], [PANEL - 7, PANEL - 7]] as const) {
    a.fillRect(px + rx, py + ry, 2, 2);
  }
}

function grate(a: CanvasRenderingContext2D, style: FloorStyle, px: number, py: number) {
  panelGrid(a, style, px, py);
  a.fillStyle = style.seam;
  for (let i = 0; i < 7; i++) a.fillRect(px + 12, py + 10 + i * 7, PANEL - 24, 3);
  a.fillStyle = "rgba(255,255,255,0.07)";
  for (let i = 0; i < 7; i++) a.fillRect(px + 12, py + 13 + i * 7, PANEL - 24, 1);
}

function plank(a: CanvasRenderingContext2D, style: FloorStyle, rnd: () => number, px: number, py: number) {
  a.fillStyle = style.seam;
  for (let i = 0; i < 4; i++) {
    a.fillRect(px, py + i * 16, PANEL, 2);
    a.fillRect(px + 8 + Math.floor(rnd() * 44), py + i * 16 + 2, 2, 14);
  }
  a.fillStyle = "rgba(255,255,255,0.08)";
  for (let i = 0; i < 4; i++) a.fillRect(px, py + i * 16 + 2, PANEL, 1);
  if (rnd() < 0.12) {
    a.fillStyle = "#070a10";
    a.fillRect(px + 14, py + 22, 34, 16);
  }
}

function rock(a: CanvasRenderingContext2D, style: FloorStyle, rnd: () => number, px: number, py: number) {
  a.fillStyle = style.seam;
  for (let i = 0; i < 3; i++) {
    let x = px + Math.floor(rnd() * PANEL);
    let y = py + Math.floor(rnd() * PANEL);
    for (let s = 0; s < 14; s++) {
      a.fillRect(x, y, 2, 2);
      x += Math.floor(rnd() * 5) - 2;
      y += Math.floor(rnd() * 4);
    }
  }
}

function frost(a: CanvasRenderingContext2D, style: FloorStyle, rnd: () => number, px: number, py: number) {
  panelGrid(a, style, px, py);
  a.fillStyle = "rgba(220,245,255,0.16)";
  a.fillRect(px + 4, py + 4, PANEL - 8, 3);
  a.fillRect(px + 4, py + PANEL - 9, 18 + Math.floor(rnd() * 20), 2);
  a.fillStyle = "rgba(220,245,255,0.22)";
  const cx = px + 16 + Math.floor(rnd() * 32);
  const cy = py + 16 + Math.floor(rnd() * 32);
  for (let s = 0; s < 4; s++) {
    const dx = s % 2 === 0 ? 1 : -1;
    const dy = s < 2 ? 1 : -1;
    for (let k = 0; k < 6 + Math.floor(rnd() * 6); k++) a.fillRect(cx + dx * k, cy + dy * k + (k % 3 === 0 ? 1 : 0), 1, 1);
  }
  a.fillStyle = style.seam;
  a.fillRect(px + 30, py + 28, 4, 8);
  a.fillRect(px + 28, py + 30, 8, 4);
}

export function makeFloorCanvases(biome: BiomeId, seed: number): FloorCanvases {
  const style = STYLES[biome];
  const rnd = rng(seed);
  const [albedo, a] = canvas();
  const [emissive, e] = canvas();
  e.fillStyle = "#000";
  e.fillRect(0, 0, SIZE, SIZE);

  for (let py = 0; py < SIZE; py += PANEL) {
    for (let px = 0; px < SIZE; px += PANEL) {
      const flat = style.pattern === "rock" || style.pattern === "plank";
      a.fillStyle = flat || (px + py) / PANEL % 2 === 0 ? style.panel : style.panelAlt;
      a.fillRect(px, py, PANEL, PANEL);
      speckle(a, rnd, px, py);
      if (style.pattern === "grid") panelGrid(a, style, px, py);
      else if (style.pattern === "grate") grate(a, style, px, py);
      else if (style.pattern === "plank") plank(a, style, rnd, px, py);
      else if (style.pattern === "frost") frost(a, style, rnd, px, py);
      else rock(a, style, rnd, px, py);
      if (rnd() < style.density) drawTrace(e, a, style, rnd, px, py);
    }
  }
  return { albedo, emissive };
}

function drawTrace(
  e: CanvasRenderingContext2D,
  a: CanvasRenderingContext2D,
  style: FloorStyle,
  rnd: () => number,
  px: number,
  py: number,
) {
  e.fillStyle = style.glow;
  a.fillStyle = style.seam;
  const inset = 12 + Math.floor(rnd() * 3) * 8;
  const midY = py + inset;
  const horizontal = 16 + Math.floor(rnd() * 28);
  const startX = px + 8;
  a.fillRect(startX - 1, midY - 1, horizontal + 2, 3);
  e.fillRect(startX, midY, horizontal, 1);
  const drop = 8 + Math.floor(rnd() * 16);
  const endX = startX + horizontal;
  a.fillRect(endX - 1, midY - 1, 3, drop + 2);
  e.fillRect(endX, midY, 1, drop);
  a.fillRect(endX - 2, midY + drop - 2, 5, 5);
  e.fillRect(endX - 1, midY + drop - 1, 3, 3);
}
