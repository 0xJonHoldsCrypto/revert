import type { CharacterDef } from "../types";
import { BOF } from "../data/rarity";
import { DIFFICULTY_LABEL, DIFFICULTY_ORDER, type DifficultyId } from "../data/difficulty";
import { getSideHero } from "../pixel/hdField";
import { FONT_MONO, FONT_UI } from "../ui/theme";

export class TitleSceneRenderer {
  private time = 0;
  private hero: CharacterDef | null = null;
  private difficulty: DifficultyId = "normal";

  setDifficulty(id: DifficultyId) {
    this.difficulty = id;
  }

  getDifficulty() {
    return this.difficulty;
  }

  setHero(hero: CharacterDef) {
    this.hero = hero;
  }

  update(dt: number) {
    this.time += dt;
  }

  startButtonRect(w: number, h: number) {
    const lay = this.laptopLayout(w, h);
    return { x: lay.keyX, y: lay.keyY, w: lay.keyW, h: lay.keyH };
  }

  hitStart(mx: number, my: number, w: number, h: number) {
    const r = this.startButtonRect(w, h);
    return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
  }

  drawOverlay(ctx: CanvasRenderingContext2D, w: number, h: number) {
    this.drawLaptopScene(ctx, w, h);
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    this.drawLaptopScene(ctx, w, h);
  }

  private laptopLayout(w: number, h: number) {
    const keyW = Math.round(Math.min(Math.max(240, w * 0.46), 500));
    const keyH = Math.round(Math.min(80, Math.max(52, h * 0.072)));
    const keyX = Math.round((w - keyW) / 2);
    const guideBaseline = Math.round(h * 0.872);
    const keyY = guideBaseline - Math.max(22, Math.round(h * 0.042)) - keyH;
    return { keyX, keyY, keyW, keyH, guideBaseline };
  }

  private drawLaptopScene(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.imageSmoothingEnabled = false;
    const lay = this.laptopLayout(w, h);
    this.drawField(ctx, w, h);
    this.drawMarginProps(ctx, w, h);
    this.drawSigner(ctx, w, h, lay.keyX, lay.keyY);
    this.drawStatus(ctx, w, lay.keyY);
    this.drawBroadcast(ctx, lay.keyX, lay.keyY, lay.keyW, lay.keyH);
    this.drawGuide(ctx, w, lay.guideBaseline);
    this.drawFooter(ctx, w, h);
  }

  private disk(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string) {
    if (rx < 1 || ry < 1) return;
    ctx.fillStyle = color;
    const icx = Math.round(cx);
    const icy = Math.round(cy);
    const irx = Math.round(rx);
    const iry = Math.round(ry);
    for (let y = -iry; y <= iry; y++) {
      const t = 1 - (y * y) / (iry * iry);
      if (t <= 0) continue;
      const hw = Math.sqrt(t) * irx;
      const left = Math.round(icx - hw);
      const width = Math.round(icx + hw) - left;
      if (width <= 0) continue;
      ctx.fillRect(left, icy + y, width, 1);
    }
  }

  private drawField(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = "#050504";
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h * 0.74;
    const rings: [number, number, string][] = [
      [0.78, 0.46, "#0c0b09"],
      [0.62, 0.38, "#1a140e"],
      [0.48, 0.3, "#2a2014"],
      [0.34, 0.22, "#3a2c18"],
      [0.22, 0.15, "#4a3820"],
    ];
    for (const [sx, sy, color] of rings) {
      this.disk(ctx, cx, cy, w * sx, h * sy, color);
    }
    this.disk(ctx, cx, h * 0.8, w * 0.46, h * 0.18, "#24301c");
    this.disk(ctx, cx, h * 0.76, w * 0.22, h * 0.1, "#314226");
    const speck = Math.round(w * h * 0.00018);
    for (let i = 0; i < speck; i++) {
      const x = (i * 73) % w;
      const y = (i * 41) % h;
      const nx = (x - cx) / (w * 0.46);
      const ny = (y - h * 0.78) / (h * 0.24);
      if (nx * nx + ny * ny > 1) continue;
      const kind = i % 5;
      ctx.fillStyle = kind === 0 ? "#1a2414" : kind === 1 ? "#6a7844" : kind === 2 ? "#8a7048" : "#3e4e2c";
      const sw = kind === 3 ? 3 : 2;
      const sh = 2 + (i % 3);
      ctx.fillRect(x, y, sw, sh);
    }
  }

  private drawMarginProps(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const spots = [
      [0.07, 0.2],
      [0.9, 0.26],
      [0.93, 0.62],
      [0.05, 0.48],
    ];
    const u = Math.max(2, Math.round(Math.min(w, h) / 180));
    for (const [fx, fy] of spots) {
      const x = Math.round(fx * w);
      const y = Math.round(fy * h);
      ctx.fillStyle = "#14110e";
      ctx.fillRect(x + u * 2, y + u * 6, u * 8, u * 2);
      ctx.fillStyle = "#3a342c";
      ctx.fillRect(x, y + u, u * 7, u * 5);
      ctx.fillStyle = "#6a6258";
      ctx.fillRect(x, y, u * 7, u * 2);
      ctx.fillStyle = "#8a8478";
      ctx.fillRect(x, y, u * 3, u);
      ctx.fillStyle = "#221e1a";
      ctx.fillRect(x + u * 7, y + u, u * 2, u * 5);
      ctx.fillStyle = "#2a261f";
      ctx.fillRect(x + u, y + u * 3, u, u);
      ctx.fillRect(x + u * 3, y + u * 3, u, u);
    }
  }

  private drawSigner(ctx: CanvasRenderingContext2D, w: number, h: number, keyX: number, keyY: number) {
    if (!this.hero) return;
    const heroH = Math.max(48, Math.round(h * 0.1));
    const heroW = Math.round(heroH * (48 / 64));
    const x = Math.max(8, Math.min(Math.round(w * 0.08), keyX - heroW - 12));
    const feet = Math.round(keyY + h * 0.04);
    const y = feet - heroH;
    ctx.fillStyle = "#16140f";
    const rx = Math.round(heroW * 0.55);
    const ry = Math.max(3, Math.round(heroH * 0.08));
    const scx = x + Math.round(heroW * 0.62);
    const scy = feet + Math.round(heroH * 0.04);
    for (let row = -ry; row <= ry; row++) {
      const t = 1 - (row * row) / (ry * ry);
      if (t <= 0) continue;
      const hw = Math.sqrt(t) * rx;
      const left = Math.round(scx - hw);
      ctx.fillRect(left, scy + row, Math.round(scx + hw) - left, 1);
    }
    const sprite = getSideHero(this.hero.id, Math.floor(this.time * 2));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, x, y, heroW, heroH);
  }

  private cliLines() {
    const name = this.hero?.name ?? "anon";
    const role = this.hero?.role ?? "signer";
    const tick = Math.floor(this.time * 3) % 4;
    const scan = ["mempool", "bridge router", "hot wallet", "validator set"][tick]!;
    return [
      { text: "Exploit.run  —  signer cli", color: "#f0c14d" },
      { text: `operator   ${name}`, color: "#e6edf3" },
      { text: `clearance  ${role}`, color: "#8b949e" },
      { text: `watching   ${scan}`, color: "#7ee787" },
      { text: "status     block pending", color: "#e6edf3" },
      { text: "> broadcast --hold-the-chain", color: "#7ee787" },
    ];
  }

  private drawStatus(ctx: CanvasRenderingContext2D, w: number, keyY: number) {
    const lines = this.cliLines();
    let font = 15;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const fit = () => {
      ctx.font = `${font}px ${FONT_MONO}`;
      return lines.some((line) => ctx.measureText(line.text).width > w * 0.86);
    };
    while (font > 11 && fit()) font -= 1;
    const lineH = font + 6;
    let y = keyY - 16 - (lines.length - 1) * lineH;
    const minY = font + 8;
    if (y < minY) y = minY;
    lines.forEach((line, i) => {
      ctx.font = `${i === 0 ? font : Math.max(11, font - 1)}px ${FONT_MONO}`;
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, w / 2, y);
      if (i === 0) {
        const tw = ctx.measureText(line.text).width;
        ctx.fillStyle = BOF.gold;
        const mid = y - Math.round(font * 0.35);
        ctx.fillRect(Math.round(w / 2 - tw / 2 - 26), mid, 14, 2);
        ctx.fillRect(Math.round(w / 2 + tw / 2 + 12), mid, 14, 2);
      }
      y += lineH;
    });
  }

  private drawBroadcast(ctx: CanvasRenderingContext2D, x: number, y: number, bw: number, bh: number) {
    const hot = Math.floor(this.time * 2) % 2 === 0;
    ctx.fillStyle = "#0e2218";
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = hot ? "#1f5a3c" : "#184830";
    ctx.fillRect(x + 4, y + 4, bw - 8, bh - 8);
    ctx.fillStyle = hot ? "#8ee7a8" : "#3d8f62";
    ctx.fillRect(x + 4, y + 4, bw - 8, 4);
    ctx.fillStyle = "#08140e";
    ctx.fillRect(x + 4, y + bh - 8, bw - 8, 4);
    ctx.fillStyle = BOF.gold;
    ctx.fillRect(x, y, 10, 3);
    ctx.fillRect(x, y, 3, 10);
    ctx.fillRect(x + bw - 10, y, 10, 3);
    ctx.fillRect(x + bw - 3, y, 3, 10);
    ctx.fillRect(x, y + bh - 3, 10, 3);
    ctx.fillRect(x, y + bh - 10, 3, 10);
    ctx.fillRect(x + bw - 10, y + bh - 3, 10, 3);
    ctx.fillRect(x + bw - 3, y + bh - 10, 3, 10);
    ctx.fillStyle = "#f4fff6";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = Math.max(14, Math.min(26, Math.floor(bh * 0.38)));
    ctx.font = `600 ${label}px ${FONT_UI}`;
    ctx.fillText("BROADCAST", x + bw / 2, y + bh / 2 + 1);
    ctx.textBaseline = "alphabetic";
  }

  private drawGuide(ctx: CanvasRenderingContext2D, w: number, baseline: number) {
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#d9d0c2";
    const font = Math.max(12, Math.min(16, Math.round(w * 0.011 + 8)));
    ctx.font = `${font}px ${FONT_UI}`;
    ctx.fillText("Press the key to broadcast. A new signer is seated each run.", w / 2, baseline);
  }

  private drawFooter(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const top = h * 0.905;
    const bot = h * 0.96;
    const fontPx = Math.max(12, Math.min(20, Math.floor((bot - top) * 0.46)));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${fontPx}px ${FONT_UI}`;
    const mid = (top + bot) / 2;
    const colW = w / 4;
    for (let i = 0; i < 4; i++) {
      const id = DIFFICULTY_ORDER[i]!;
      ctx.fillStyle = id === this.difficulty ? BOF.gold : "#6a5428";
      ctx.fillText(DIFFICULTY_LABEL[id], colW * i + colW / 2, mid);
    }
    ctx.textBaseline = "alphabetic";
  }
}
