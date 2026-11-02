import type { BiomeId } from "../data/environment";

export type FloorCanvases = { albedo: HTMLCanvasElement; emissive: HTMLCanvasElement };

type FloorStyle = { panel: string; panelAlt: string; seam: string; glow: string; density: number };

const STYLES: Record<BiomeId, FloorStyle> = {
  wasteland: { panel: "#4a4f58", panelAlt: "#42474f", seam: "#20242b", glow: "#2ee6c7", density: 0.28 },
  cex: { panel: "#54494c", panelAlt: "#4a4043", seam: "#261e20", glow: "#ff6a3c", density: 0.24 },
  defi: { panel: "#3c5558", panelAlt: "#344a4d", seam: "#172628", glow: "#6cb6ff", density: 0.3 },
  apt: { panel: "#413a52", panelAlt: "#383247", seam: "#1b1726", glow: "#d05cff", density: 0.2 },
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

export function makeFloorCanvases(biome: BiomeId, seed: number): FloorCanvases {
  const style = STYLES[biome];
  const rnd = rng(seed);
  const [albedo, a] = canvas();
  const [emissive, e] = canvas();
  e.fillStyle = "#000";
  e.fillRect(0, 0, SIZE, SIZE);

  for (let py = 0; py < SIZE; py += PANEL) {
    for (let px = 0; px < SIZE; px += PANEL) {
      a.fillStyle = (px + py) / PANEL % 2 === 0 ? style.panel : style.panelAlt;
      a.fillRect(px, py, PANEL, PANEL);
      for (let i = 0; i < 26; i++) {
        a.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.07)";
        a.fillRect(px + Math.floor(rnd() * PANEL), py + Math.floor(rnd() * PANEL), 1 + Math.floor(rnd() * 3), 1);
      }
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
