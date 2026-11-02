import type { CharacterId } from "../types";

const W = 48;
const H = 72;

type RGB = [number, number, number];

const hex = (s: string): RGB => [
  parseInt(s.slice(1, 3), 16),
  parseInt(s.slice(3, 5), 16),
  parseInt(s.slice(5, 7), 16),
];

const LOOK: Record<CharacterId, { hair: RGB; hairHi: RGB; skin: RGB; skinSh: RGB; cloth: RGB; clothSh: RGB; pants: RGB; shoe: RGB; eye: RGB; hood: boolean; messy: boolean }> = {
  cz: {
    hair: hex("#1a120c"),
    hairHi: hex("#3a2a18"),
    skin: hex("#f3c7a0"),
    skinSh: hex("#c48b62"),
    cloth: hex("#f0b429"),
    clothSh: hex("#b8860b"),
    pants: hex("#2a241c"),
    shoe: hex("#111111"),
    eye: hex("#1a120c"),
    hood: false,
    messy: false,
  },
  elon: {
    hair: hex("#3a2418"),
    hairHi: hex("#6b4428"),
    skin: hex("#f0c09a"),
    skinSh: hex("#c48968"),
    cloth: hex("#1c1c1c"),
    clothSh: hex("#3a3a3a"),
    pants: hex("#3d5a80"),
    shoe: hex("#e8e4dc"),
    eye: hex("#1a120c"),
    hood: false,
    messy: false,
  },
  sbf: {
    hair: hex("#6b4428"),
    hairHi: hex("#a56b3c"),
    skin: hex("#f6d0b0"),
    skinSh: hex("#d4a574"),
    cloth: hex("#8b93a0"),
    clothSh: hex("#5c6570"),
    pants: hex("#c4a574"),
    shoe: hex("#2a241c"),
    eye: hex("#1a120c"),
    hood: false,
    messy: true,
  },
  "sec-dev": {
    hair: hex("#141820"),
    hairHi: hex("#2a3544"),
    skin: hex("#e8c4a8"),
    skinSh: hex("#c49678"),
    cloth: hex("#214e38"),
    clothSh: hex("#163628"),
    pants: hex("#1a1e24"),
    shoe: hex("#111111"),
    eye: hex("#58a6ff"),
    hood: true,
    messy: false,
  },
};

const cache = new Map<string, HTMLCanvasElement>();

export const BODY_FRAMES = 4;

export function getBodyFrame(id: CharacterId, frame: number): HTMLCanvasElement {
  const f = ((frame % BODY_FRAMES) + BODY_FRAMES) % BODY_FRAMES;
  const key = `${id}-${f}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = paintBody(id, f);
  cache.set(key, canvas);
  return canvas;
}

export function getBodySheet(id: CharacterId): HTMLCanvasElement {
  const key = `${id}-sheet`;
  const hit = cache.get(key);
  if (hit) return hit;
  const sample = getBodyFrame(id, 0);
  const canvas = document.createElement("canvas");
  canvas.width = sample.width * BODY_FRAMES;
  canvas.height = sample.height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  for (let f = 0; f < BODY_FRAMES; f++) ctx.drawImage(getBodyFrame(id, f), f * sample.width, 0);
  cache.set(key, canvas);
  return canvas;
}

function paintBody(id: CharacterId, frame: number): HTMLCanvasElement {
  const look = LOOK[id];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  const data = img.data;
  const put = (x: number, y: number, rgb: RGB) => {
    const px = x | 0;
    const py = y | 0;
    if (px < 0 || py < 0 || px >= W || py >= H) return;
    const i = (py * W + px) * 4;
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
  };
  const rect = (x: number, y: number, w: number, h: number, rgb: RGB) => {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) put(x + xx, y + yy, rgb);
  };

  const bob = frame === 1 ? -1 : frame === 3 ? 1 : 0;
  const leg = frame === 0 ? 5 : frame === 2 ? -5 : frame === 1 ? 1 : -1;
  const arm = frame === 0 ? -4 : frame === 2 ? 4 : 0;

  rect(14, 62 + bob, 20, 3, [0, 0, 0]);

  rect(15, 50 + bob, 7, 12, look.pants);
  rect(26, 50 + bob, 7, 12, look.pants);
  rect(15 + Math.min(leg, 0), 54 + bob, 7, 8, look.pants);
  rect(26 + Math.max(leg, 0), 54 + bob, 7, 8, look.pants);
  rect(14 + Math.min(leg, 0), 62 + bob, 9, 4, look.shoe);
  rect(25 + Math.max(leg, 0), 62 + bob, 9, 4, look.shoe);
  put(16 + Math.min(leg, 0), 63 + bob, [255, 255, 255]);
  put(27 + Math.max(leg, 0), 63 + bob, [255, 255, 255]);

  rect(14, 28 + bob, 20, 22, look.cloth);
  rect(14, 40 + bob, 20, 8, look.clothSh);
  rect(22, 30 + bob, 2, 16, look.clothSh);

  rect(6 + arm, 30 + bob, 8, 16, look.cloth);
  rect(34 - arm, 30 + bob, 8, 16, look.cloth);
  rect(6 + arm, 44 + bob, 7, 5, look.skin);
  rect(35 - arm, 44 + bob, 7, 5, look.skin);
  rect(7 + arm, 46 + bob, 5, 2, look.skinSh);
  rect(36 - arm, 46 + bob, 5, 2, look.skinSh);

  rect(16, 16 + bob, 16, 14, look.skin);
  rect(16, 26 + bob, 16, 4, look.skinSh);
  rect(18, 22 + bob, 4, 3, look.eye);
  rect(26, 22 + bob, 4, 3, look.eye);
  put(19, 23 + bob, [255, 255, 255]);
  put(27, 23 + bob, [255, 255, 255]);
  rect(22, 26 + bob, 4, 2, look.skinSh);

  if (look.hood) {
    rect(12, 10 + bob, 24, 16, look.cloth);
    rect(14, 12 + bob, 20, 6, look.clothSh);
    rect(16, 14 + bob, 16, 8, look.skin);
    rect(18, 20 + bob, 4, 3, look.eye);
    rect(26, 20 + bob, 4, 3, look.eye);
  } else if (look.messy) {
    rect(12, 6 + bob, 24, 14, look.hair);
    rect(10, 10 + bob, 6, 8, look.hair);
    rect(32, 8 + bob, 7, 10, look.hairHi);
    rect(18, 8 + bob, 8, 3, look.hairHi);
  } else {
    rect(15, 8 + bob, 18, 12, look.hair);
    rect(14, 12 + bob, 4, 8, look.hair);
    rect(30, 12 + bob, 4, 6, look.hair);
    rect(20, 9 + bob, 8, 3, look.hairHi);
  }

  const filled = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) filled[i] = data[i * 4 + 3] ? 1 : 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (filled[y * W + x]) continue;
      let edge = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (filled[ny * W + nx]) edge = true;
      }
      if (!edge) continue;
      const i = (y * W + x) * 4;
      data[i] = 14;
      data[i + 1] = 10;
      data[i + 2] = 12;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
