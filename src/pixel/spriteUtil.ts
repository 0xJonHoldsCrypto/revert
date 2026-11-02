export type PixRow = string;
export type Tone = [number, number, number];

export function rampTones(base: string, count = 6): Tone[] {
  const n = parseInt(base.slice(1), 16);
  const c: Tone = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const light: Tone = [255, 252, 246];
  const dark: Tone = [18, 12, 16];
  const tones: Tone[] = [];
  for (let i = 0; i < count; i++) {
    const t = count <= 1 ? 0.5 : i / (count - 1);
    const toward = t < 0.45 ? light : dark;
    const u = t < 0.45 ? (0.45 - t) / 0.45 : (t - 0.45) / 0.55;
    const lift = t < 0.45 ? u * 0.62 : u * 0.72;
    tones.push([
      Math.round(c[0] + (toward[0] - c[0]) * lift),
      Math.round(c[1] + (toward[1] - c[1]) * lift),
      Math.round(c[2] + (toward[2] - c[2]) * lift),
    ]);
  }
  return tones;
}

export function blank(w: number, h: number) {
  return new Uint8ClampedArray(w * h * 4);
}

export function putPx(data: Uint8ClampedArray, w: number, h: number, x: number, y: number, col: Tone | string) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= w || py >= h) return;
  let r: number;
  let g: number;
  let b: number;
  if (typeof col === "string") {
    const n = parseInt(col.slice(1), 16);
    r = (n >> 16) & 255;
    g = (n >> 8) & 255;
    b = n & 255;
  } else {
    r = col[0];
    g = col[1];
    b = col[2];
  }
  const i = (py * w + px) * 4;
  data[i] = r;
  data[i + 1] = g;
  data[i + 2] = b;
  data[i + 3] = 255;
}

export function fillClump(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  tones: Tone[],
  bias = 0
) {
  if (rx < 0.5 || ry < 0.5) return;
  const x0 = Math.max(0, Math.floor(cx - rx - 1));
  const x1 = Math.min(w - 1, Math.ceil(cx + rx + 1));
  const y0 = Math.max(0, Math.floor(cy - ry - 1));
  const y1 = Math.min(h - 1, Math.ceil(cy + ry + 1));
  const steps = tones.length;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const light = nx * 0.62 + ny * 0.82 + bias;
      const t = Math.max(0, Math.min(0.999, (light + 1.2) / 2.35));
      const col = tones[Math.min(steps - 1, Math.floor(t * steps))]!;
      const i = (y * w + x) * 4;
      data[i] = col[0];
      data[i + 1] = col[1];
      data[i + 2] = col[2];
      data[i + 3] = 255;
    }
  }
}

export function blitTone(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  x: number,
  y: number,
  rw: number,
  rh: number,
  tones: Tone[],
  mode: "top" | "front" | "side"
) {
  const steps = tones.length;
  for (let yy = 0; yy < rh; yy++) {
    for (let xx = 0; xx < rw; xx++) {
      const px = x + xx;
      const py = y + yy;
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      const u = rw <= 1 ? 0 : xx / (rw - 1);
      const v = rh <= 1 ? 0 : yy / (rh - 1);
      let t = 0.45;
      if (mode === "top") t = 0.02 + u * 0.22 + v * 0.28;
      else if (mode === "front") t = 0.18 + u * 0.34 + v * 0.4;
      else t = 0.58 + u * 0.16 + v * 0.24;
      const col = tones[Math.min(steps - 1, Math.floor(Math.max(0, Math.min(0.999, t)) * steps))]!;
      const i = (py * w + px) * 4;
      data[i] = col[0];
      data[i + 1] = col[1];
      data[i + 2] = col[2];
      data[i + 3] = 255;
    }
  }
}

export function applyLocalOutline(data: Uint8ClampedArray, w: number, h: number) {
  const filled = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) filled[i] = data[i * 4 + 3] ? 1 : 0;
  const mark = new Uint8Array(w * h);
  const src = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (filled[y * w + x]) continue;
      let shadow = false;
      let light = false;
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (!filled[ny * w + nx]) continue;
        const i = (ny * w + nx) * 4;
        r += data[i]!;
        g += data[i + 1]!;
        b += data[i + 2]!;
        n++;
        if (dx < 0 || dy < 0) shadow = true;
        if (dx > 0 || dy > 0) light = true;
      }
      if (!n) continue;
      const onShadow = shadow && !light;
      const amt = onShadow ? 0.6 : shadow ? 0.48 : 0.3;
      mark[y * w + x] = onShadow ? 2 : 1;
      src[y * w + x] =
        (Math.round((r / n) * (1 - amt)) << 16) |
        (Math.round((g / n) * (1 - amt)) << 8) |
        Math.round((b / n) * (1 - amt));
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mark[y * w + x] !== 2) continue;
      const base = src[y * w + x]!;
      const br = Math.round(((base >> 16) & 255) * 0.82);
      const bg = Math.round(((base >> 8) & 255) * 0.82);
      const bb = Math.round((base & 255) * 0.82);
      const darker = (br << 16) | (bg << 8) | bb;
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (filled[ni] || mark[ni]) continue;
        mark[ni] = 3;
        src[ni] = darker;
      }
    }
  }
  for (let i = 0; i < w * h; i++) {
    if (!mark[i]) continue;
    const c = src[i]!;
    const o = i * 4;
    data[o] = (c >> 16) & 255;
    data[o + 1] = (c >> 8) & 255;
    data[o + 2] = c & 255;
    data[o + 3] = 255;
  }
}

export function finishSprite(data: Uint8ClampedArray, w: number, h: number): HTMLCanvasElement {
  applyLocalOutline(data, w, h);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  img.data.set(data);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function paintGrid(grid: PixRow[], palette: Record<string, string>): HTMLCanvasElement {
  const h = grid.length;
  let w = 1;
  for (let y = 0; y < h; y++) w = Math.max(w, grid[y]?.length ?? 0);
  const data = blank(w, h);
  for (let y = 0; y < h; y++) {
    const row = (grid[y] ?? "").padEnd(w, ".");
    for (let x = 0; x < w; x++) {
      const key = row[x] ?? ".";
      if (key === ".") continue;
      const color = palette[key];
      if (!color || color === "transparent") continue;
      putPx(data, w, h, x, y, color);
    }
  }
  return finishSprite(data, w, h);
}

export function paintSprite(grid: PixRow[], palette: Record<string, string>, size: number): HTMLCanvasElement {
  const native = paintGrid(grid, palette);
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
