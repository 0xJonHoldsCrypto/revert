import type { BiomeId } from "../data/environment";
import type { EnemyKind } from "../types";
import { enemyFrame, hasHandEnemy } from "./handArt";

type Ctx = CanvasRenderingContext2D;

const OUTLINE = [10, 9, 18];
const cache = new Map<string, HTMLCanvasElement>();

function sprite(key: string, w: number, h: number, paint: (c: Ctx) => void): HTMLCanvasElement {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = w + 2;
  canvas.height = h + 2;
  const c = canvas.getContext("2d", { willReadFrequently: true })!;
  c.translate(1, 1);
  paint(c);
  outline(c, canvas.width, canvas.height);
  cache.set(key, canvas);
  return canvas;
}

function outline(c: Ctx, w: number, h: number) {
  const image = c.getImageData(0, 0, w, h);
  const d = image.data;
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3]! > 128 ? 1 : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (solid[i]) continue;
      const near = (x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w]);
      if (!near) continue;
      d[i * 4] = OUTLINE[0]!;
      d[i * 4 + 1] = OUTLINE[1]!;
      d[i * 4 + 2] = OUTLINE[2]!;
      d[i * 4 + 3] = 255;
    }
  }
  c.putImageData(image, 0, 0);
}

function r(c: Ctx, color: string, x: number, y: number, w: number, h: number) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

const SKIN = "#dfa985";
const SKIN_D = "#b77e60";

const ENEMY_ART: Partial<Record<EnemyKind, () => HTMLCanvasElement>> = {
  "boss-mev-king": () =>
    sprite("boss-mev-king", 110, 130, (c) => {
      r(c, "#2c2f44", 34, 96, 14, 28);
      r(c, "#2c2f44", 62, 96, 14, 28);
      r(c, "#101220", 30, 120, 20, 8);
      r(c, "#101220", 60, 120, 20, 8);
      r(c, "#d9a927", 22, 40, 66, 60);
      r(c, "#fff0a0", 24, 42, 60, 8);
      r(c, "#8a6510", 22, 90, 66, 10);
      r(c, "#16182a", 34, 56, 42, 22);
      r(c, "#5de9ff", 40, 62, 30, 9);
      r(c, "#e8fbff", 42, 63, 8, 3);
      r(c, "#16182a", 4, 50, 18, 28);
      r(c, "#ffb020", 6, 54, 14, 18);
      r(c, "#16182a", 88, 50, 18, 28);
      r(c, "#ffb020", 90, 54, 14, 18);
      r(c, "#ffd34d", 28, 24, 54, 16);
      for (let i = 0; i < 5; i++) r(c, "#ffd34d", 28 + i * 12, 10 + (i % 2) * 6, 6, 16);
      r(c, "#ff3a44", 52, 28, 7, 7);
      r(c, "#2ee6c7", 34, 28, 5, 5);
      r(c, "#2ee6c7", 71, 28, 5, 5);
    }),
  "boss-unit-414": () =>
    sprite("boss-unit-414", 110, 136, (c) => {
      r(c, "#1a1b28", 18, 58, 74, 74);
      r(c, "#0e0f18", 18, 118, 74, 14);
      r(c, "#2a2d42", 34, 52, 42, 46);
      r(c, "#3a0f14", 34, 76, 42, 6);
      c.fillStyle = "#ff5c48";
      c.font = "700 16px monospace";
      c.fillText("414", 40, 72);
      r(c, "#14141e", 30, 8, 50, 48);
      r(c, "#2a2d42", 30, 8, 50, 6);
      r(c, "#ff3a44", 34, 28, 42, 8);
      r(c, "#ffd0d0", 36, 30, 10, 3);
      r(c, "#0c0d14", 4, 56, 18, 56);
      r(c, "#0c0d14", 88, 56, 18, 56);
      r(c, "#c8ccd8", 92, 10, 3, 50);
      r(c, "#ff3a44", 80, 4, 26, 8);
    }),
  "boss-phish-king": () =>
    sprite("boss-phish-king", 130, 124, (c) => {
      r(c, "#f2f4fa", 8, 28, 114, 76);
      r(c, "#3b6cff", 8, 28, 114, 16);
      r(c, "#ff5c48", 106, 32, 9, 9);
      r(c, "#14161f", 20, 54, 90, 8);
      r(c, "#8c93a6", 20, 68, 64, 4);
      r(c, "#2ec27e", 36, 80, 58, 16);
      r(c, "#e8fff4", 48, 86, 34, 4);
      r(c, "#ffd34d", 32, 14, 66, 14);
      for (let i = 0; i < 5; i++) r(c, "#ffd34d", 32 + i * 15, 2 + (i % 2) * 5, 6, 14);
      r(c, "#ff3a44", 60, 18, 9, 7);
      for (const x of [20, 50, 76, 104]) {
        r(c, "#7a4de0", x, 104, 6, 12);
        r(c, "#c8ccd8", x - 2, 114, 10, 3);
        r(c, "#c8ccd8", x - 4, 110, 3, 6);
      }
    }),
  "boss-oracle": () =>
    sprite("boss-oracle", 120, 140, (c) => {
      r(c, "#3a3e58", 46, 100, 28, 30);
      r(c, "#23263a", 20, 128, 80, 10);
      r(c, "#151827", 4, 6, 112, 98);
      r(c, "#2b3a66", 4, 6, 112, 6);
      r(c, "#08101e", 10, 16, 100, 82);
      const heights = [18, 40, 12, 58, 26, 66, 30, 48, 14];
      heights.forEach((v, i) => {
        r(c, i % 2 ? "#ff5c48" : "#2ee6c7", 14 + i * 11, 94 - v, 7, v);
        r(c, i % 2 ? "#ff5c48" : "#2ee6c7", 17 + i * 11, 88 - v, 1, 12);
      });
      r(c, "#79c0ff", 40, 22, 40, 22);
      r(c, "#e8f4ff", 46, 26, 28, 14);
      r(c, "#0a0a12", 55, 27, 10, 12);
    }),
  "boss-nightdesk": () =>
    sprite("boss-nightdesk", 116, 138, (c) => {
      r(c, "#171a2a", 34, 104, 18, 30);
      r(c, "#171a2a", 64, 104, 18, 30);
      r(c, "#23273f", 24, 50, 68, 58);
      r(c, "#f4f4f4", 50, 50, 16, 34);
      r(c, "#7a4de0", 55, 52, 6, 30);
      r(c, "#2f3555", 24, 50, 10, 58);
      r(c, SKIN, 36, 12, 44, 40);
      r(c, SKIN_D, 36, 42, 44, 10);
      r(c, "#101014", 34, 6, 48, 14);
      r(c, "#0c0c10", 40, 26, 36, 8);
      r(c, "#ff3a44", 44, 28, 8, 3);
      r(c, "#ff3a44", 64, 28, 8, 3);
      r(c, "#ffffff", 46, 42, 24, 4);
      r(c, "#23273f", 2, 56, 24, 12);
      r(c, "#23273f", 90, 56, 24, 12);
      r(c, "#f4f6fb", 0, 68, 26, 34);
      r(c, "#c23c3c", 0, 68, 26, 7);
      r(c, "#8c93a6", 4, 80, 18, 2);
      r(c, "#8c93a6", 4, 86, 18, 2);
      r(c, "#f4f6fb", 92, 68, 22, 28);
      r(c, "#2ec27e", 92, 68, 22, 6);
    }),
  "boss-grandmaster": () =>
    sprite("boss-grandmaster", 130, 150, (c) => {
      r(c, "#0e0a18", 26, 44, 78, 104);
      r(c, "#1c1630", 34, 50, 62, 98);
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 6; x++) {
          if ((x + y) % 3 !== 0) continue;
          r(c, y % 2 ? "#d05cff" : "#7a2fb0", 40 + x * 9, 58 + y * 11, 7, 8);
        }
      }
      r(c, "#120d20", 40, 8, 50, 42);
      r(c, "#ff2a44", 48, 26, 12, 5);
      r(c, "#ff2a44", 70, 26, 12, 5);
      r(c, "#ffd34d", 40, 2, 50, 8);
      for (let i = 0; i < 4; i++) r(c, "#ffd34d", 42 + i * 14, -2 + (i % 2) * 2, 5, 8);
      for (const x of [2, 108]) {
        for (let i = 0; i < 7; i++) {
          r(c, i % 2 ? "#8a8f9e" : "#5a5f70", x + (i % 2) * 2, 50 + i * 13, 14, 9);
          r(c, "#120d20", x + 4 + (i % 2) * 2, 53 + i * 13, 6, 3);
        }
      }
    }),
};

export function getThreatSprite(kind: EnemyKind): HTMLCanvasElement {
  if (hasHandEnemy(kind)) return enemyFrame(kind, 0);
  return ENEMY_ART[kind]!();
}

export type ZoneProp = { key: string; height: number; art: () => HTMLCanvasElement };

export const ZONE_PROPS: Record<BiomeId, ZoneProp[]> = {
  mempool: [
    {
      key: "tx-packet",
      height: 34,
      art: () =>
        sprite("tx-packet", 40, 34, (c) => {
          r(c, "#183a44", 2, 4, 36, 24);
          r(c, "#2ee6c7", 2, 4, 36, 4);
          r(c, "#7ef0d8", 6, 12, 22, 2);
          r(c, "#7ef0d8", 6, 17, 28, 2);
          r(c, "#ffc23d", 6, 22, 11, 2);
        }),
    },
    {
      key: "gas-sign",
      height: 72,
      art: () =>
        sprite("gas-sign", 44, 76, (c) => {
          r(c, "#3a3e50", 19, 34, 6, 42);
          r(c, "#14161f", 1, 2, 42, 34);
          r(c, "#ffc23d", 1, 2, 42, 3);
          c.fillStyle = "#ffc23d";
          c.font = "700 11px monospace";
          c.fillText("GAS", 12, 17);
          c.fillStyle = "#ff5c48";
          c.fillText("212", 12, 30);
        }),
    },
    {
      key: "queue-barrier",
      height: 28,
      art: () =>
        sprite("queue-barrier", 60, 28, (c) => {
          r(c, "#4a4e60", 4, 2, 5, 24);
          r(c, "#4a4e60", 50, 2, 5, 24);
          for (let i = 0; i < 6; i++) r(c, i % 2 ? "#ffc23d" : "#16182a", 6 + i * 8, 8, 8, 7);
        }),
    },
  ],
  vault: [
    {
      key: "server-aisle",
      height: 90,
      art: () =>
        sprite("server-aisle", 50, 92, (c) => {
          r(c, "#20232f", 2, 2, 46, 88);
          for (let i = 0; i < 8; i++) {
            r(c, "#0c0e16", 6, 7 + i * 10, 38, 7);
            r(c, i % 3 === 0 ? "#ff5c48" : "#2ee6c7", 36, 9 + i * 10, 2, 2);
            r(c, "#ffc23d", 40, 9 + i * 10, 2, 2);
          }
        }),
    },
    {
      key: "alarm-beacon",
      height: 46,
      art: () =>
        sprite("alarm-beacon", 26, 48, (c) => {
          r(c, "#3a3e50", 10, 22, 6, 26);
          r(c, "#ff3a2e", 4, 2, 18, 20);
          r(c, "#ffc8bc", 8, 5, 5, 8);
          r(c, "#2a2d3c", 2, 20, 22, 4);
        }),
    },
    {
      key: "cable-tray",
      height: 26,
      art: () =>
        sprite("cable-tray", 66, 26, (c) => {
          r(c, "#3a3e50", 2, 8, 62, 14);
          r(c, "#ffc23d", 6, 11, 54, 2);
          r(c, "#ff5c48", 6, 15, 54, 2);
          r(c, "#6cb6ff", 6, 19, 54, 2);
          r(c, "#4c5166", 2, 4, 4, 22);
          r(c, "#4c5166", 60, 4, 4, 22);
        }),
    },
  ],
  bridge: [
    {
      key: "girder",
      height: 66,
      art: () =>
        sprite("girder", 56, 68, (c) => {
          r(c, "#3f5a64", 4, 2, 8, 66);
          r(c, "#3f5a64", 44, 2, 8, 66);
          r(c, "#587a86", 4, 2, 48, 6);
          c.strokeStyle = "#587a86";
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(8, 8);
          c.lineTo(48, 62);
          c.moveTo(48, 8);
          c.lineTo(8, 62);
          c.stroke();
        }),
    },
    {
      key: "cargo",
      height: 46,
      art: () =>
        sprite("cargo", 64, 46, (c) => {
          r(c, "#c26a2a", 2, 2, 60, 42);
          for (let i = 0; i < 7; i++) r(c, "#9a4f1c", 6 + i * 8, 6, 3, 34);
          r(c, "#f4e4c0", 16, 16, 32, 14);
          c.fillStyle = "#3a1f0c";
          c.font = "700 9px monospace";
          c.fillText("L2>L1", 19, 26);
        }),
    },
    {
      key: "liquidity-pipe",
      height: 40,
      art: () =>
        sprite("liquidity-pipe", 72, 40, (c) => {
          r(c, "#3a5660", 2, 12, 68, 18);
          r(c, "#587a86", 2, 12, 68, 4);
          r(c, "#6cb6ff", 14, 18, 44, 6);
          r(c, "#d8f0ff", 18, 19, 14, 2);
          r(c, "#26363e", 8, 8, 6, 26);
          r(c, "#26363e", 58, 8, 6, 26);
        }),
    },
  ],
  forest: [
    {
      key: "monolith",
      height: 128,
      art: () =>
        sprite("monolith", 42, 130, (c) => {
          r(c, "#120d20", 8, 2, 26, 128);
          r(c, "#1e1633", 8, 2, 6, 128);
          for (let i = 0; i < 14; i++) r(c, i % 3 ? "#5a2f90" : "#d05cff", 18, 8 + i * 8, 4 + (i * 7) % 11, 2);
        }),
    },
    {
      key: "watcher",
      height: 56,
      art: () =>
        sprite("watcher", 40, 58, (c) => {
          r(c, "#0c0916", 8, 6, 24, 52);
          r(c, "#17112a", 12, 2, 16, 8);
          r(c, "#ff2a44", 12, 18, 5, 3);
          r(c, "#ff2a44", 23, 18, 5, 3);
        }),
    },
    {
      key: "dead-contract",
      height: 36,
      art: () =>
        sprite("dead-contract", 46, 38, (c) => {
          r(c, "#241c38", 2, 4, 42, 32);
          r(c, "#3a2f56", 2, 4, 42, 4);
          r(c, "#7a6a9c", 7, 13, 26, 2);
          r(c, "#7a6a9c", 7, 18, 32, 2);
          r(c, "#ff5c48", 7, 25, 20, 3);
        }),
    },
  ],
};

export type Landmark = { key: string; biome: BiomeId; height: number; art: () => HTMLCanvasElement };

export const LANDMARKS: Landmark[] = [
  {
    key: "mempool-gate",
    biome: "mempool",
    height: 300,
    art: () =>
      sprite("mempool-gate", 180, 160, (c) => {
        r(c, "#16202e", 4, 8, 30, 152);
        r(c, "#16202e", 146, 8, 30, 152);
        r(c, "#22344a", 4, 2, 172, 30);
        c.fillStyle = "#2ee6c7";
        c.font = "700 16px monospace";
        c.fillText("PENDING", 58, 23);
        for (let i = 0; i < 8; i++) r(c, "#2ee6c7", 10, 40 + i * 14, 18, 4);
        for (let i = 0; i < 8; i++) r(c, "#ffc23d", 152, 40 + i * 14, 18, 4);
      }),
  },
  {
    key: "vault-door",
    biome: "vault",
    height: 320,
    art: () =>
      sprite("vault-door", 170, 170, (c) => {
        r(c, "#22242f", 2, 2, 166, 166);
        c.fillStyle = "#4a4e62";
        c.beginPath();
        c.arc(85, 85, 70, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#2c2f40";
        c.beginPath();
        c.arc(85, 85, 54, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#c8ccd8";
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          c.fillRect(85 + Math.cos(a) * 60 - 4, 85 + Math.sin(a) * 60 - 4, 8, 8);
        }
        r(c, "#ff3a2e", 76, 76, 18, 18);
        r(c, "#c8ccd8", 40, 82, 90, 6);
        r(c, "#c8ccd8", 82, 40, 6, 90);
      }),
  },
  {
    key: "bridge-span",
    biome: "bridge",
    height: 280,
    art: () =>
      sprite("bridge-span", 220, 130, (c) => {
        r(c, "#3f5a64", 20, 20, 18, 110);
        r(c, "#3f5a64", 182, 20, 18, 110);
        r(c, "#587a86", 0, 90, 90, 14);
        r(c, "#587a86", 130, 90, 90, 14);
        c.strokeStyle = "#7a9aa6";
        c.lineWidth = 3;
        for (let i = 0; i < 5; i++) {
          c.beginPath();
          c.moveTo(29, 22);
          c.lineTo(36 + i * 12, 90);
          c.moveTo(191, 22);
          c.lineTo(184 - i * 12, 90);
          c.stroke();
        }
        r(c, "#ff5c48", 92, 92, 6, 12);
        r(c, "#ff5c48", 122, 92, 6, 12);
      }),
  },
  {
    key: "dark-monolith",
    biome: "forest",
    height: 420,
    art: () =>
      sprite("dark-monolith", 90, 220, (c) => {
        r(c, "#0c0916", 12, 2, 66, 218);
        r(c, "#1e1633", 12, 2, 10, 218);
        for (let i = 0; i < 22; i++) r(c, i % 4 ? "#5a2f90" : "#d05cff", 28, 10 + i * 9, 8 + (i * 13) % 34, 3);
        r(c, "#ff2a44", 30, 70, 30, 6);
      }),
  },
];
