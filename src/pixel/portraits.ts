import type { CharacterId } from "../types";
import { pick } from "../utils/math";

export const STARTER_ROSTER: CharacterId[] = ["keel", "nyx", "diff", "trace"];

export function rollStarterCharacter(): CharacterId {
  return pick(STARTER_ROSTER);
}

type PixRow = string;

function paint(grid: PixRow[], palette: Record<string, string>, size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cell = size / grid.length;
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y]!;
    for (let x = 0; x < row.length; x++) {
      const key = row[x]!;
      if (key === ".") continue;
      ctx.fillStyle = palette[key] ?? key;
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  return canvas;
}

const PAL = {
  o: "#1a1028",
  s: "#f0c9a0",
  s2: "#d4a574",
  h: "#2b1b0e",
  h2: "#4a3020",
  w: "#eef2ff",
  y: "#f0b429",
  y2: "#c4890a",
  k: "#12151c",
  b: "#3d5a80",
  b2: "#627eea",
  g: "#7ee787",
  r: "#ff7b72",
  p: "#d2a8ff",
  c: "#58a6ff",
};

const CZ: PixRow[] = [
  "........................",
  "..........hhhh..........",
  ".........hsssshh........",
  "........hsssssssh.......",
  ".......hsssssssssh......",
  "......hsssssssssssh.....",
  "......hsoossssoos.h.....",
  "......hsssssssssssh.....",
  ".......hssss2ssssh......",
  "........hsssssssh.......",
  ".........hyyyyyh........",
  "........hyyyyyyyh.......",
  ".......hyyyyyyyyyh......",
  "......hyyyyyyyyyyyh.....",
  ".....hyyyyyyyyyyyyyh....",
  ".....hyyyyyyyyyyyyyh....",
  "......hyyyyyyyyyyh......",
  ".......hyyyyyyyyh.......",
  "........hyyyyyyh........",
  ".........hyyyyh.........",
  "..........hyyh..........",
  "........................",
];

const NYX: PixRow[] = [
  "........................",
  "..........hhhh..........",
  ".........hsssshh........",
  "........hsssssssh.......",
  ".......hsssssssssh......",
  "......hsssssssssssh.....",
  ".....hhssssssssssshh....",
  "....hsssssssssssssssh...",
  "....hsssoossssoosssh....",
  "....hssssssssssssssh....",
  "....hssssssssssssssh....",
  ".....hssssssssssssh.....",
  "......hssssssssssh......",
  ".......hkkkkkkkkkh......",
  "......hkkkkkkkkkkkh.....",
  ".....hkkkkkkkkkkkkkh....",
  ".....hkkkkkkkkkkkkkh....",
  "......hkkkkkkkkkkkh.....",
  ".......hkkkkkkkkkh......",
  "........hkkkkkkkh.......",
  ".........hkkkkkh........",
  "........................",
];

const DIFF: PixRow[] = [
  "........................",
  "........hhhhhh..........",
  ".......hssssssh.........",
  "......hssssssssh........",
  ".....hssssssssssh.......",
  "....hssssssssssssh......",
  "....hssssssssssssh......",
  "....hsoosssssoossh......",
  "....hssssssssssssh......",
  ".....hssssssssssh.......",
  "......hssssssssh........",
  ".......hccccccch........",
  "......hccccccccch.......",
  ".....hccccccccccch......",
  "....hccccccccccccch.....",
  "....hccccccccccccch.....",
  ".....hccccccccccch......",
  "......hccccccccch.......",
  ".......hccccccch........",
  "........hccccch.........",
  ".........hcch...........",
  "........................",
];

const SEC: PixRow[] = [
  "........................",
  "..........hhhh..........",
  ".........hsssshh........",
  "........hsssssssh.......",
  ".......hsssssssssh......",
  "......hsssssssssssh.....",
  "......hwwossssowwh......",
  "......hsssssssssssh.....",
  ".......hssssssssh.......",
  "........hssssssh........",
  ".........hppppph........",
  "........hppppppph.......",
  ".......hppppppppph......",
  "......hppppppppppph.....",
  ".....hppppppppppppph....",
  ".....hpppbpppppbppph....",
  "......hppppppppppph.....",
  ".......hkkkkkkkkkh......",
  "........hkkkkkkkh.......",
  ".........hkkkkkh........",
  "..........hkkkh.........",
  "........................",
];

const HACKER: PixRow[] = [
  "........................",
  ".........hrrrrh.........",
  "........hrssssrh........",
  ".......hrssssssrh.......",
  "......hrssssssssrh......",
  "......hroossssoorh......",
  "......hrssssssssrh......",
  ".......hrssssssrh.......",
  "........hrssssrh........",
  ".........hrrrrh.........",
  "........hkkkkkkkh.......",
  ".......hkkkkkkkkkh......",
  "......hkkkkkkkkkkkh.....",
  "......hkkkkkkkkkkkh.....",
  ".......hkkkkkkkkkh......",
  "........hkkkkkkkh.......",
  ".........hkkkkkh........",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
];

const sheets: Record<string, PixRow[]> = {
  keel: CZ,
  nyx: NYX,
  diff: DIFF,
  "trace": SEC,
  hacker: HACKER,
};

const cache = new Map<string, HTMLCanvasElement>();

export function getPortraitCanvas(id: CharacterId | "hacker" | "researcher", size = 96): HTMLCanvasElement {
  const key = `${id}-${size}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const grid = sheets[id === "researcher" ? "trace" : id] ?? sheets.keel!;
  const base = paint(grid, PAL, size);
  cache.set(key, base);
  return base;
}

export function drawPortrait(
  ctx: CanvasRenderingContext2D,
  id: CharacterId | "hacker" | "researcher",
  x: number,
  y: number,
  w: number,
  h: number,
  glow = false
) {
  const sheet = getPortraitCanvas(id, 96);
  ctx.imageSmoothingEnabled = false;
  if (glow) {
    ctx.shadowColor = id === "hacker" ? "rgba(255,51,102,0.8)" : "rgba(240,180,41,0.45)";
    ctx.shadowBlur = 24;
  }
  ctx.drawImage(sheet, x, y, w, h);
  ctx.shadowBlur = 0;
}

export function drawPortraitMini(ctx: CanvasRenderingContext2D, id: CharacterId, x: number, y: number, size: number) {
  drawPortrait(ctx, id, x - size / 2, y - size / 2, size, size);
}
