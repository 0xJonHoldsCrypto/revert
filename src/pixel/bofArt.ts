import { BOF } from "../data/rarity";

export function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
}

export function outlineRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) {
  px(ctx, x, y, w, h, fill);
  ctx.fillStyle = BOF.outline;
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillRect(x + w - 2, y, 2, h);
}

export function drawResearcher(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const s = scale;
  outlineRect(ctx, x + 4 * s, y + 8 * s, 12 * s, 14 * s, BOF.coat);
  px(ctx, x + 6 * s, y + 4 * s, 8 * s, 6 * s, BOF.skin);
  px(ctx, x + 5 * s, y + 3 * s, 10 * s, 3 * s, BOF.hair);
  px(ctx, x + 7 * s, y + 6 * s, 2 * s, 2 * s, BOF.outline);
  px(ctx, x + 11 * s, y + 6 * s, 2 * s, 2 * s, BOF.outline);
  outlineRect(ctx, x + 18 * s, y + 10 * s, 14 * s, 10 * s, BOF.stone);
  px(ctx, x + 19 * s, y + 11 * s, 12 * s, 8 * s, BOF.terminal);
}

export function drawHacker(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, pulse: number) {
  const s = scale;
  const glow = BOF.hackerGlow;
  px(ctx, x + 2 * s, y + 6 * s, 16 * s, 16 * s, BOF.hacker);
  px(ctx, x + 5 * s, y + 10 * s, 4 * s, 2 * s, glow);
  px(ctx, x + 11 * s, y + 10 * s, 4 * s, 2 * s, glow);
  px(ctx, x + 6 * s, y + 16 * s, 8 * s, 2 * s, BOF.outline);
  outlineRect(ctx, x + 20 * s, y + 8 * s, 16 * s, 12 * s, BOF.outline);
  px(ctx, x + 21 * s, y + 9 * s, 14 * s, 10 * s, BOF.terminal);
  px(ctx, x + 22 * s, y + 10 + pulse * 2 * s, 12 * s, 2 * s, BOF.terminalRed);
  px(ctx, x + 22 * s, y + 14 * s, 8 * s, 2 * s, BOF.terminalGreen);
}

export function drawTerminalPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lines: string[], scroll: number) {
  outlineRect(ctx, x, y, w, h, BOF.terminal);
  ctx.font = `${Math.max(8, Math.floor(h / 14))}px monospace`;
  lines.forEach((line, i) => {
    const ly = y + 12 + i * 14 - scroll;
    if (ly < y + 4 || ly > y + h - 4) return;
    ctx.fillStyle = line.startsWith("CRIT") ? BOF.terminalRed : BOF.terminalGreen;
    ctx.fillText(line, x + 8, ly);
  });
}

export function drawBoFDialog(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  speaker: string,
  text: string,
  portraitDraw: (ctx: CanvasRenderingContext2D, px: number, py: number) => void
) {
  const boxH = Math.min(120, h * 0.28);
  const y = h - boxH - 12;
  outlineRect(ctx, 12, y, w - 24, boxH, BOF.dialogBg);
  outlineRect(ctx, 20, y + 8, 56, boxH - 16, BOF.skyDark);
  portraitDraw(ctx, 24, y + 12);
  ctx.fillStyle = BOF.dialogBorder;
  ctx.font = "600 13px \"IBM Plex Sans\", system-ui, sans-serif";
  ctx.fillText(speaker, 88, y + 28);
  ctx.font = "400 15px \"IBM Plex Sans\", system-ui, sans-serif";
  ctx.fillStyle = "#2a1808";
  wrapText(ctx, text, 88, y + 48, w - 120, 18);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  const words = text.split(" ");
  let line = "";
  let ly = y;
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, ly);
      line = word + " ";
      ly += lineH;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, ly);
}

export function drawChest(ctx: CanvasRenderingContext2D, x: number, y: number, kind: string, open: number) {
  const lid = open * 8;
  outlineRect(ctx, x - 16, y - 8 + lid, 32, 20, BOF.chest);
  outlineRect(ctx, x - 18, y + 10, 36, 14, BOF.dirt);
  px(ctx, x - 6, y - 4 + lid, 12, 6, BOF.gold);
  if (kind === "defi-lootbox") px(ctx, x - 4, y + 2 + lid, 8, 4, BOF.epic);
}

export function drawObstacleProp(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, kind: string, color: string) {
  if (kind === "rug-pool") {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = BOF.outline;
    ctx.lineWidth = 2;
    ctx.stroke();
    return;
  }
  if (kind === "liquidation-spike") {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - h / 2);
    ctx.lineTo(x + w / 2, y + h / 2);
    ctx.lineTo(x - w / 2, y + h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = BOF.outline;
    ctx.stroke();
    return;
  }
  outlineRect(ctx, x - w / 2, y - h / 2, w, h, color);
}

export function drawWell(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number, used: boolean) {
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x, y + 10, 28, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = used ? "#30363d" : "#1f6feb";
  ctx.beginPath();
  ctx.ellipse(x, y, 26, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = BOF.gold;
  ctx.lineWidth = 2;
  ctx.stroke();
  if (!used && progress > 0) {
    ctx.strokeStyle = BOF.terminalGreen;
    ctx.beginPath();
    ctx.arc(x, y, 32, -Math.PI / 2, -Math.PI / 2 + Math.min(1, progress / 1.35) * Math.PI * 2);
    ctx.stroke();
  }
}

export function drawBiomeTile(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, biome: string, checker: boolean) {
  const palettes: Record<string, [string, string]> = {
    wasteland: ["#2d4a2d", "#3d6c3d"],
    cex: ["#3a3a52", "#4a4a68"],
    defi: ["#1a3a4a", "#2a5a6a"],
    apt: ["#3a2a4a", "#5a3a6a"],
  };
  const [a, b] = palettes[biome] ?? palettes.wasteland!;
  ctx.fillStyle = checker ? a : b;
  ctx.fillRect(x, y, size, size);
  if (checker && biome === "defi") {
    px(ctx, x + size / 2 - 2, y + size / 2 - 2, 4, 4, BOF.terminalGreen);
  }
}
