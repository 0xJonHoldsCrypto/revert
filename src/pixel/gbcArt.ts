import type { BiomeId } from "../data/environment";
import type { CharacterId, EnemyKind, SidekickKind } from "../types";
import { blank, blitTone, fillClump, finishSprite, paintGrid, putPx, rampTones, type PixRow, type Tone } from "./spriteUtil";

const GRASS: Record<BiomeId, [string, string, string, string]> = {
  mempool: ["#2d5a28", "#3c6e32", "#4e863c", "#1e3e1c"],
  vault: ["#3a3a28", "#4a4a34", "#5c5c40", "#242418"],
  bridge: ["#1a4a48", "#246058", "#2e7870", "#103430"],
  forest: ["#3a2848", "#4a3458", "#5c4068", "#241830"],
};

const FLOWER = ["#d8d060", "#e07070", "#70b0e0", "#f0f0e8"];

function tile(biome: BiomeId, variant: number): HTMLCanvasElement {
  const [a, b, c, d] = GRASS[biome];
  const g: PixRow[] = [];
  for (let y = 0; y < 16; y++) {
    let row = "";
    for (let x = 0; x < 16; x++) {
      const n = (x * 13 + y * 7 + variant * 17) % 11;
      const edge = x === 0 || y === 0 || x === 15 || y === 15;
      row += edge && n < 2 ? "d" : n < 2 ? "c" : n < 6 ? "b" : "a";
    }
    g.push(row);
  }
  if (variant % 3 === 0) {
    const chars = g[6]!.split("");
    chars[5] = "f";
    chars[6] = "f";
    g[6] = chars.join("");
    const chars2 = g[7]!.split("");
    chars2[5] = "s";
    g[7] = chars2.join("");
  }
  return paintGrid(g, { a, b, c, d, f: FLOWER[variant % 4]!, s: "#204018" });
}

const tileCache = new Map<string, HTMLCanvasElement>();

export function getGbcTile(biome: BiomeId, x: number, y: number): HTMLCanvasElement {
  const variant = Math.abs((x * 3 + y * 5) % 4);
  const key = `${biome}-${variant}`;
  const hit = tileCache.get(key);
  if (hit) return hit;
  const canvas = tile(biome, variant);
  tileCache.set(key, canvas);
  return canvas;
}

const DOWN: PixRow[] = [
  "........hhhhhh........",
  "......hhhhhhhhhh......",
  ".....hhsssssssshh.....",
  ".....hhsEEssEEssh.....",
  ".....hhsssssssshh.....",
  "......hhssddsshh......",
  "......ooccccccoo......",
  ".....oocccccccccoo....",
  ".....ooccsssscccoo....",
  ".....oocccccccccoo....",
  "......oopp..ppoo......",
  "......oopp....ppoo....",
  ".......obb....bbo.....",
  ".......obbb..bbbo.....",
];

const UP: PixRow[] = [
  "........hhhhhh........",
  "......hhhhhhhhhh......",
  ".....hhhhhhhhhhhh.....",
  ".....hhhhhhhhhhhh.....",
  "......hhhhhhhhhh......",
  "......ooccccccoo......",
  ".....oocccccccccoo....",
  ".....oocccccccccoo....",
  ".....oocccccccccoo....",
  "......ooppppppoo......",
  "......oopp....ppoo....",
  ".......obb....bbo.....",
  ".......obbb..bbbo.....",
];

const SIDE: PixRow[] = [
  ".......hhhhhh.........",
  ".....hhhhhhhhh........",
  "....hhssssssshh.......",
  "....hhsEEsssshh.......",
  "....hhssssssshh.......",
  ".....hhssddshh........",
  ".....oocccccoo........",
  "....ooccccccccoo......",
  "....ooccssccccoo......",
  "....ooccccccccoo......",
  ".....oopp.ppoo........",
  ".....opp....bbo.......",
  ".....obb....bbo.......",
  ".....obbb..bbbo.......",
];

const PAL: Record<CharacterId, Record<string, string>> = {
  keel: { h: "#1a120c", s: "#f3c7a0", d: "#c48b62", E: "#1a120c", c: "#f0b429", p: "#241c14", b: "#101010", o: "#140c10" },
  nyx: { h: "#3a2418", s: "#f0c09a", d: "#c48968", E: "#1a120c", c: "#1c1c1c", p: "#3d5a80", b: "#e8e4dc", o: "#140c10" },
  diff: { h: "#6b4428", s: "#f6d0b0", d: "#d4a574", E: "#1a120c", c: "#8b93a0", p: "#c4a574", b: "#2a241c", o: "#140c10" },
  "trace": { h: "#141820", s: "#e8c4a8", d: "#c49678", E: "#58a6ff", c: "#214e38", p: "#1a1e24", b: "#111111", o: "#140c10" },
};

const spriteCache = new Map<string, HTMLCanvasElement>();

function cached(key: string, grid: PixRow[], pal: Record<string, string>) {
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const canvas = paintGrid(grid, pal);
  spriteCache.set(key, canvas);
  return canvas;
}

export function getHeroSprite(id: CharacterId, facing: number, step: number): HTMLCanvasElement {
  const dir = Math.abs(Math.cos(facing)) > Math.abs(Math.sin(facing)) ? "side" : facing > 0 ? "down" : "up";
  const bob = step % 2 === 0 ? "a" : "b";
  return cached(`hero-${id}-${dir}-${bob}`, dir === "up" ? UP : dir === "side" ? SIDE : DOWN, PAL[id]);
}

export function heroFacesLeft(facing: number) {
  return Math.cos(facing) < 0 && Math.abs(Math.cos(facing)) > Math.abs(Math.sin(facing));
}

function hold(key: string, paint: () => HTMLCanvasElement) {
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const canvas = paint();
  spriteCache.set(key, canvas);
  return canvas;
}

function tapered(data: Uint8ClampedArray, w: number, h: number, cx: number, y0: number, y1: number, r0: number, r1: number, tones: Tone[]) {
  const steps = tones.length;
  const top = Math.max(0, Math.floor(y0));
  const bot = Math.min(h - 1, Math.ceil(y1));
  for (let y = top; y <= bot; y++) {
    const v = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
    const reach = r0 + (r1 - r0) * v;
    const span = Math.ceil(reach);
    for (let x = -span; x <= span; x++) {
      if (Math.abs(x) > reach) continue;
      const u = reach <= 0 ? 0.5 : (x + reach) / (reach * 2);
      const t = Math.max(0, Math.min(0.999, 0.08 + u * 0.5 + v * 0.38));
      putPx(data, w, h, cx + x, y, tones[Math.min(steps - 1, Math.floor(t * steps))]!);
    }
  }
}

function volume(data: Uint8ClampedArray, w: number, h: number, x: number, y: number, fw: number, fh: number, depth: number, tones: Tone[]) {
  blitTone(data, w, h, x + fw - 4, y + Math.floor(depth * 0.45), depth, fh, tones, "side");
  blitTone(data, w, h, x, y + depth, fw, fh, tones, "front");
  blitTone(data, w, h, x + 3, y, fw - 2, depth, tones, "top");
}

function eye(data: Uint8ClampedArray, w: number, h: number, x: number, y: number) {
  fillClump(data, w, h, x, y, 2.2, 2.2, rampTones("#f4f7fb"), -0.45);
  fillClump(data, w, h, x + 0.6, y + 0.4, 1.1, 1.1, rampTones("#1a120c"), 0.2);
  putPx(data, w, h, x - 0.4, y - 0.6, "#ffffff");
}

function paintGoblin() {
  const w = 68;
  const h = 84;
  const data = blank(w, h);
  const cloth = rampTones("#3d8b4a");
  const skin = rampTones("#e8c4a0");
  tapered(data, w, h, 30, 58, 74, 4, 5, rampTones("#17321c"));
  tapered(data, w, h, 42, 58, 74, 4, 5, rampTones("#17321c"));
  fillClump(data, w, h, 30, 74, 6, 3, rampTones("#101810"), 0);
  fillClump(data, w, h, 42, 74, 6, 3, rampTones("#101810"), 0);
  tapered(data, w, h, 36, 36, 66, 10, 16, cloth);
  tapered(data, w, h, 48, 40, 58, 4, 5, cloth);
  fillClump(data, w, h, 52, 58, 3, 3, skin, 0);
  tapered(data, w, h, 34, 16, 40, 11, 8, cloth);
  fillClump(data, w, h, 40, 30, 6, 5, skin, 0.05);
  fillClump(data, w, h, 42, 29, 6.5, 1.6, rampTones("#9be7ff"), -0.4);
  putPx(data, w, h, 45, 29, "#f4feff");
  return finishSprite(data, w, h);
}

function paintFish() {
  const w = 72;
  const h = 88;
  const data = blank(w, h);
  const shell = rampTones("#c45a28");
  const dark = rampTones("#2a140c");
  tapered(data, w, h, 28, 52, 78, 4, 5, dark);
  tapered(data, w, h, 44, 52, 78, 4, 5, dark);
  tapered(data, w, h, 36, 28, 58, 10, 12, shell);
  volume(data, w, h, 18, 16, 28, 18, 6, rampTones("#1a100c"));
  blitTone(data, w, h, 22, 22, 20, 10, rampTones("#ffb020"), "front");
  putPx(data, w, h, 28, 26, "#1a100c");
  putPx(data, w, h, 34, 26, "#1a100c");
  tapered(data, w, h, 52, 20, 36, 1, 3, rampTones("#e8eef8"));
  fillClump(data, w, h, 58, 16, 3, 3, rampTones("#ff5d7a"), -0.3);
  return finishSprite(data, w, h);
}

function paintCrab() {
  const w = 88;
  const h = 72;
  const data = blank(w, h);
  const metal = rampTones("#8a9390");
  const gold = rampTones("#e0b040");
  volume(data, w, h, 24, 22, 36, 28, 10, metal);
  blitTone(data, w, h, 30, 30, 24, 12, rampTones("#102018"), "front");
  putPx(data, w, h, 36, 34, "#7ee787");
  putPx(data, w, h, 42, 36, "#7ee787");
  putPx(data, w, h, 48, 34, "#f0c14d");
  tapered(data, w, h, 44, 8, 22, 1, 2, gold);
  fillClump(data, w, h, 44, 8, 3, 3, rampTones("#ff5d7a"), -0.3);
  tapered(data, w, h, 16, 36, 48, 3, 6, gold);
  tapered(data, w, h, 70, 36, 48, 3, 6, gold);
  fillClump(data, w, h, 10, 34, 5, 3, gold, -0.2);
  fillClump(data, w, h, 76, 34, 5, 3, gold, -0.2);
  return finishSprite(data, w, h);
}

function paintWorm() {
  const w = 92;
  const h = 56;
  const data = blank(w, h);
  const body = rampTones("#3d8a4a");
  fillClump(data, w, h, 22, 32, 10, 8, body, 0.1);
  fillClump(data, w, h, 40, 30, 11, 8, body, 0);
  fillClump(data, w, h, 58, 32, 10, 7, body, 0.05);
  fillClump(data, w, h, 72, 33, 7, 6, body, 0.1);
  fillClump(data, w, h, 36, 18, 6, 4, rampTones("#101810"), 0.15);
  blitTone(data, w, h, 32, 14, 10, 7, rampTones("#9be7ff"), "front");
  eye(data, w, h, 74, 30);
  return finishSprite(data, w, h);
}

function paintWitch() {
  const w = 64;
  const h = 96;
  const data = blank(w, h);
  const robe = rampTones("#1a3048");
  const skin = rampTones("#e0b090");
  tapered(data, w, h, 26, 58, 86, 4, 5, robe);
  tapered(data, w, h, 40, 58, 86, 4, 5, robe);
  tapered(data, w, h, 34, 34, 64, 9, 12, robe);
  fillClump(data, w, h, 36, 28, 7, 7, skin, 0);
  tapered(data, w, h, 34, 10, 30, 10, 8, rampTones("#0c1824"));
  eye(data, w, h, 42, 28);
  volume(data, w, h, 40, 40, 16, 18, 4, rampTones("#102018"));
  for (let i = 0; i < 4; i++) putPx(data, w, h, 44 + i * 2, 48 + (i % 2) * 3, "#7ee787");
  return finishSprite(data, w, h);
}

function paintSuit() {
  const w = 64;
  const h = 96;
  const data = blank(w, h);
  const suit = rampTones("#2a3140");
  const skin = rampTones("#e8c4a8");
  tapered(data, w, h, 24, 58, 88, 4, 5, suit);
  tapered(data, w, h, 40, 58, 88, 4, 5, suit);
  fillClump(data, w, h, 24, 88, 6, 3, rampTones("#101014"), 0);
  fillClump(data, w, h, 40, 88, 6, 3, rampTones("#101014"), 0);
  tapered(data, w, h, 34, 32, 64, 10, 12, suit);
  tapered(data, w, h, 34, 36, 60, 1.4, 1.6, rampTones("#e8eef8"));
  tapered(data, w, h, 46, 38, 60, 3, 4, suit);
  fillClump(data, w, h, 48, 58, 3, 3, skin, 0);
  fillClump(data, w, h, 38, 24, 7, 7, skin, 0);
  tapered(data, w, h, 34, 12, 26, 8, 6, rampTones("#1a140e"));
  eye(data, w, h, 44, 24);
  putPx(data, w, h, 40, 24, "#1a140e");
  return finishSprite(data, w, h);
}

function paintCloak(mark: "plain" | "crown" | "horn") {
  const w = 64;
  const h = 100;
  const data = blank(w, h);
  const cloak = rampTones("#c04048");
  tapered(data, w, h, 32, 38, 92, 8, 13, cloak);
  tapered(data, w, h, 32, 16, 42, 7, 9, cloak);
  fillClump(data, w, h, 38, 32, 4.2, 2.2, rampTones("#1a0c10"), 0.1);
  fillClump(data, w, h, 39, 32, 4.4, 1.1, rampTones("#ffe08a"), -0.45);
  blitTone(data, w, h, 44, 42, 3, 24, rampTones("#d8dde6"), "side");
  blitTone(data, w, h, 40, 64, 10, 3, rampTones("#8a9098"), "top");
  if (mark === "crown") {
    blitTone(data, w, h, 18, 8, 20, 4, rampTones("#ffe08a"), "top");
    blitTone(data, w, h, 20, 2, 3, 8, rampTones("#ffe08a"), "front");
    blitTone(data, w, h, 28, 0, 3, 10, rampTones("#ffe08a"), "front");
    blitTone(data, w, h, 36, 2, 3, 8, rampTones("#ffe08a"), "front");
  }
  if (mark === "horn") {
    tapered(data, w, h, 16, 14, 24, 1, 4, rampTones("#2a1020"));
    tapered(data, w, h, 44, 12, 24, 1, 4, rampTones("#2a1020"));
  }
  return finishSprite(data, w, h);
}

function paintRug() {
  const w = 88;
  const h = 90;
  const data = blank(w, h);
  const cloth = rampTones("#241820");
  const skin = rampTones("#e0b090");
  const rug = rampTones("#c45a78");
  tapered(data, w, h, 24, 50, 80, 4, 5, cloth);
  tapered(data, w, h, 38, 50, 80, 4, 5, cloth);
  tapered(data, w, h, 32, 28, 56, 9, 11, cloth);
  fillClump(data, w, h, 36, 22, 6, 6, skin, 0);
  tapered(data, w, h, 34, 10, 24, 8, 6, rampTones("#1a1014"));
  eye(data, w, h, 42, 22);
  blitTone(data, w, h, 44, 48, 34, 8, rug, "top");
  blitTone(data, w, h, 46, 56, 32, 14, rug, "front");
  for (let x = 48; x < 76; x += 6) putPx(data, w, h, x, 62, "#f0c14d");
  return finishSprite(data, w, h);
}

function paintBridge() {
  const w = 92;
  const h = 72;
  const data = blank(w, h);
  const stone = rampTones("#b9a6e8");
  volume(data, w, h, 10, 28, 14, 28, 8, stone);
  volume(data, w, h, 62, 28, 14, 28, 8, stone);
  blitTone(data, w, h, 16, 20, 58, 10, stone, "top");
  blitTone(data, w, h, 22, 30, 46, 16, rampTones("#241830"), "front");
  fillClump(data, w, h, 40, 44, 2, 2, rampTones("#ffe08a"), -0.3);
  fillClump(data, w, h, 48, 50, 2, 2, rampTones("#ffe08a"), -0.2);
  fillClump(data, w, h, 44, 56, 2.2, 2.2, rampTones("#f0b429"), -0.25);
  eye(data, w, h, 46, 24);
  return finishSprite(data, w, h);
}

export function getMonsterSprite(kind: EnemyKind): HTMLCanvasElement {
  if (kind.includes("grand")) return hold("cloak-crown", () => paintCloak("crown"));
  if (kind.includes("oracle")) return hold("witch", paintWitch);
  if (kind.includes("mev")) return hold("crab", paintCrab);
  if (kind.includes("sim")) return hold("worm", paintWorm);
  if (kind.includes("insider")) return hold("insider", paintSuit);
  if (kind.includes("phish")) return hold("fish", paintFish);
  if (kind.includes("forest")) return hold("cloak-horn", () => paintCloak("horn"));
  if (kind.includes("lazarus")) return hold("cloak", () => paintCloak("plain"));
  if (kind.includes("bridge")) return hold("bridge", paintBridge);
  if (kind.includes("rug")) return hold("rug", paintRug);
  return hold("goblin", paintGoblin);
}

export type CryptoProp = "rack" | "spool" | "fan" | "cone";

function paintRack() {
  const w = 70;
  const h = 96;
  const data = blank(w, h);
  const metal = rampTones("#8a938c");
  volume(data, w, h, 12, 10, 34, 68, 14, metal);
  const slot = rampTones("#1a221c");
  const led = rampTones("#7ee787");
  for (let i = 0; i < 5; i++) {
    blitTone(data, w, h, 18, 32 + i * 10, 24, 4, slot, "front");
    putPx(data, w, h, 20, 33 + i * 10, led[0]!);
    putPx(data, w, h, 22, 33 + i * 10, i % 2 ? led[2]! : "#f0b429");
  }
  return finishSprite(data, w, h);
}

function paintSpool() {
  const w = 78;
  const h = 64;
  const data = blank(w, h);
  const wood = rampTones("#a87848");
  const cable = rampTones("#2a241c");
  fillClump(data, w, h, 40, 40, 22, 14, wood, 0.1);
  fillClump(data, w, h, 36, 22, 20, 8, wood, -0.25);
  fillClump(data, w, h, 36, 22, 8, 3.2, cable, 0.2);
  fillClump(data, w, h, 40, 40, 14, 6, cable, 0.05);
  return finishSprite(data, w, h);
}

function paintFan() {
  const w = 78;
  const h = 78;
  const data = blank(w, h);
  const steel = rampTones("#b7c0c8");
  const dark = rampTones("#2a3138");
  fillClump(data, w, h, 40, 44, 24, 20, steel, 0.15);
  fillClump(data, w, h, 36, 36, 20, 16, steel, -0.2);
  fillClump(data, w, h, 36, 36, 10, 8, dark, 0.1);
  blitTone(data, w, h, 34, 22, 3, 16, dark, "side");
  blitTone(data, w, h, 28, 34, 16, 3, dark, "front");
  blitTone(data, w, h, 22, 30, 3, 14, steel, "front");
  putPx(data, w, h, 30, 30, "#7ee787");
  return finishSprite(data, w, h);
}

function paintCone() {
  const w = 56;
  const h = 64;
  const data = blank(w, h);
  const warn = rampTones("#e2b43a");
  const band = rampTones("#1a1a1a");
  for (let y = 8; y < 52; y++) {
    const reach = 4 + Math.floor((y - 8) * 0.46);
    const tones = (y - 8) % 12 < 5 ? band : warn;
    for (let x = -reach; x <= reach; x++) {
      const u = reach === 0 ? 0.5 : (x + reach) / (reach * 2);
      const tone = tones[u < 0.42 ? 1 : u < 0.7 ? 3 : 5]!;
      putPx(data, w, h, 26 + x, y, tone);
    }
  }
  fillClump(data, w, h, 26, 12, 5, 2.4, warn, -0.4);
  blitTone(data, w, h, 16, 52, 24, 5, rampTones("#4a4a4a"), "top");
  return finishSprite(data, w, h);
}

export function getCryptoProp(kind: CryptoProp): HTMLCanvasElement {
  if (kind === "rack") return hold("rack", paintRack);
  if (kind === "spool") return hold("spool", paintSpool);
  if (kind === "fan") return hold("fan", paintFan);
  return hold("cone", paintCone);
}

function paintChest() {
  const w = 72;
  const h = 58;
  const data = blank(w, h);
  const gold = rampTones("#f0b429");
  volume(data, w, h, 10, 8, 40, 32, 12, gold);
  blitTone(data, w, h, 22, 28, 8, 8, rampTones("#6b4a10"), "front");
  fillClump(data, w, h, 26, 31, 2.2, 2.2, rampTones("#7ee787"), -0.35);
  blitTone(data, w, h, 14, 22, 32, 3, rampTones("#ffe08a"), "top");
  return finishSprite(data, w, h);
}

function paintWell() {
  const w = 78;
  const h = 70;
  const data = blank(w, h);
  const stone = rampTones("#8a8a98");
  const water = rampTones("#1a3050");
  const wood = rampTones("#6b4423");
  blitTone(data, w, h, 14, 18, 4, 28, wood, "side");
  blitTone(data, w, h, 54, 18, 4, 28, wood, "side");
  blitTone(data, w, h, 14, 14, 44, 6, wood, "top");
  fillClump(data, w, h, 38, 48, 22, 12, stone, 0.12);
  fillClump(data, w, h, 36, 36, 18, 7, stone, -0.2);
  fillClump(data, w, h, 36, 38, 9, 3.4, water, 0.15);
  putPx(data, w, h, 32, 36, "#9ecbff");
  blitTone(data, w, h, 36, 18, 2, 12, wood, "front");
  return finishSprite(data, w, h);
}

export function getTreeSprite() {
  return getCryptoProp("rack");
}
export function getBushSprite() {
  return getCryptoProp("spool");
}
export function getChestSprite() {
  return hold("chest", paintChest);
}
export function getWellSprite() {
  return hold("well", paintWell);
}

function paintRig(kind: SidekickKind) {
  const w = 56;
  const h = 48;
  const data = blank(w, h);
  if (kind === "asic-miner") {
    volume(data, w, h, 8, 6, 28, 28, 10, rampTones("#9aa398"));
    putPx(data, w, h, 14, 20, "#7ee787");
    putPx(data, w, h, 18, 20, "#f0b429");
    putPx(data, w, h, 14, 26, "#7ee787");
  } else if (kind === "block-builder") {
    volume(data, w, h, 10, 8, 32, 24, 8, rampTones("#c9a24a"));
    blitTone(data, w, h, 16, 14, 20, 10, rampTones("#1a1408"), "front");
    putPx(data, w, h, 20, 18, "#f0c14d");
    putPx(data, w, h, 28, 18, "#f0c14d");
  } else if (kind === "dev-laptop") {
    blitTone(data, w, h, 8, 8, 30, 18, rampTones("#4aa3ff"), "front");
    blitTone(data, w, h, 6, 26, 36, 6, rampTones("#2a3138"), "top");
    blitTone(data, w, h, 12, 12, 20, 10, rampTones("#102018"), "front");
    putPx(data, w, h, 16, 16, "#7ee787");
  } else {
    volume(data, w, h, 12, 6, 24, 28, 8, rampTones("#7ee787"));
    blitTone(data, w, h, 20, 16, 8, 3, rampTones("#102018"), "front");
    blitTone(data, w, h, 22, 22, 3, 8, rampTones("#102018"), "front");
  }
  return finishSprite(data, w, h);
}

export function getRigSprite(kind: SidekickKind) {
  return hold(`rig-${kind}`, () => paintRig(kind));
}
