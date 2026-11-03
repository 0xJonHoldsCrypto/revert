import { CHARACTERS } from "../data/characters";
import { DIFFICULTY_LABEL, type DifficultyId } from "../data/difficulty";
import { heroPortrait, paintLogo } from "../pixel/handArt";
import type { CharacterId } from "../types";
import { formatTime } from "../utils/math";
import { FONT_MONO, FONT_UI, INK } from "./theme";

export const CARD_W = 1200;
export const CARD_H = 630;

export type ShareData = {
  incident: string;
  hero: CharacterId;
  difficulty: DifficultyId;
  time: number;
  savedPct: number;
  tools: string[];
  cause: string;
  score: number;
  seed: number;
};

export type ShareOutcome = "shared" | "copied" | "downloaded" | "cancelled" | "failed";

async function loadFonts() {
  try {
    await Promise.all([document.fonts.load(`700 40px ${FONT_UI}`), document.fonts.load(`700 20px ${FONT_MONO}`)]);
  } catch {
    return;
  }
}

function fit(c: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (c.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && c.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

export async function renderShareCard(data: ShareData): Promise<HTMLCanvasElement> {
  await loadFonts();
  const hero = CHARACTERS.find((h) => h.id === data.hero) ?? CHARACTERS[0]!;
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const c = canvas.getContext("2d")!;

  const bg = c.createLinearGradient(0, 0, CARD_W, CARD_H);
  bg.addColorStop(0, "#0b0e18");
  bg.addColorStop(1, "#05060b");
  c.fillStyle = bg;
  c.fillRect(0, 0, CARD_W, CARD_H);
  c.fillStyle = "rgba(255,255,255,0.025)";
  for (let y = 0; y < CARD_H; y += 6) c.fillRect(0, y, CARD_W, 2);
  const glow = c.createRadialGradient(270, 330, 20, 270, 330, 360);
  glow.addColorStop(0, `${hero.color}55`);
  glow.addColorStop(1, "transparent");
  c.fillStyle = glow;
  c.fillRect(0, 0, CARD_W, CARD_H);

  c.fillStyle = INK.line;
  c.fillRect(0, 0, CARD_W, 4);
  c.fillRect(0, CARD_H - 4, CARD_W, 4);

  const portrait = heroPortrait(hero.id);
  const scale = Math.floor(380 / portrait.height);
  const pw = portrait.width * scale;
  const ph = portrait.height * scale;
  const px = 270 - pw / 2;
  const py = 330 - ph / 2;
  c.imageSmoothingEnabled = false;
  c.fillStyle = "rgba(0,0,0,0.35)";
  c.fillRect(px + 10, py + 10, pw, ph);
  c.drawImage(portrait, px, py, pw, ph);
  c.fillStyle = hero.color;
  c.font = `700 36px ${FONT_UI}`;
  c.textAlign = "center";
  c.fillText(hero.name, 270, 560);
  c.fillStyle = INK.muted;
  c.font = `700 16px ${FONT_MONO}`;
  c.fillText(`${hero.role} · ${DIFFICULTY_LABEL[data.difficulty]}`, 270, 588);

  const logo = paintLogo(5);
  c.drawImage(logo, 540, 36);
  c.textAlign = "left";
  c.fillStyle = INK.muted;
  c.font = `700 18px ${FONT_MONO}`;
  c.fillText(`INCIDENT ${data.incident}`, 540, 130);

  c.fillStyle = INK.gold;
  c.font = `700 150px ${FONT_UI}`;
  c.fillText(`${data.savedPct.toFixed(1)}%`, 534, 270);
  c.fillStyle = INK.muted;
  c.font = `700 20px ${FONT_MONO}`;
  c.fillText("OF FUNDS SAVED", 540, 304);

  c.fillStyle = INK.text;
  c.font = `700 56px ${FONT_UI}`;
  c.fillText(formatTime(data.time), 540, 388);
  c.fillStyle = INK.muted;
  c.font = `700 16px ${FONT_MONO}`;
  c.fillText("TIME ON-CHAIN", 540, 412);
  c.fillStyle = INK.text;
  c.font = `700 56px ${FONT_UI}`;
  c.fillText(data.score.toLocaleString("en-US"), 800, 388);
  c.fillStyle = INK.muted;
  c.font = `700 16px ${FONT_MONO}`;
  c.fillText("SCORE", 800, 412);

  c.fillStyle = INK.mint;
  c.font = `700 16px ${FONT_MONO}`;
  c.fillText("TOP TOOLS", 540, 456);
  c.fillStyle = INK.text;
  c.font = `700 22px ${FONT_MONO}`;
  const tools = data.tools.slice(0, 3).join("  ·  ") || "None logged";
  c.fillText(fit(c, tools, 620), 540, 486);

  c.fillStyle = INK.danger;
  c.font = `700 16px ${FONT_MONO}`;
  c.fillText("ROOT CAUSE", 540, 534);
  c.fillStyle = INK.text;
  c.font = `700 22px ${FONT_MONO}`;
  c.fillText(fit(c, data.cause, 620), 540, 564);

  c.textAlign = "right";
  c.fillStyle = INK.muted;
  c.font = `700 14px ${FONT_MONO}`;
  c.fillText(`SEED ${data.seed >>> 0}`, CARD_W - 28, CARD_H - 22);
  return canvas;
}

export function shareText(data: ShareData): string {
  return `REVERT ${data.incident}: saved ${data.savedPct.toFixed(1)}% of the funds in ${formatTime(data.time)} as ${data.hero}. Seed ${data.seed >>> 0}.`;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    } catch {
      resolve(null);
    }
  });
}

function download(blob: Blob, name: string): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch {
    return false;
  }
}

export async function shareImage(canvas: HTMLCanvasElement, data: ShareData): Promise<ShareOutcome> {
  const blob = await toBlob(canvas);
  if (!blob) return "failed";
  const name = `revert-${data.incident}.png`;
  const file = new File([blob], name, { type: "image/png" });
  try {
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "REVERT", text: shareText(data) });
      return "shared";
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
  }
  try {
    if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      return "copied";
    }
  } catch {
    void 0;
  }
  return download(blob, name) ? "downloaded" : "failed";
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
