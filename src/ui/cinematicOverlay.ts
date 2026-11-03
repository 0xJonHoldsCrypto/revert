import { ENEMIES } from "../data/enemies";
import { BOSS_ENTRANCES, BOSS_TIMELINE, LANDING_TIMELINE } from "../game/cinematic";
import type { Game } from "../game/Game";
import { getThreatSprite } from "../pixel/threatArt";
import { FONT_MONO, FONT_UI } from "./theme";

type Project = (x: number, y: number) => { x: number; y: number } | null;

export function drawCinematic(ctx: CanvasRenderingContext2D, game: Game, w: number, h: number, project: Project) {
  const c = game.cinematic;
  if (!c) return;
  if (c.kind === "landing") drawLanding(ctx, game, c.t, c.flash, w, h, project);
  else drawBossEntrance(ctx, game, c.t, w, h);
}

function drawLanding(ctx: CanvasRenderingContext2D, game: Game, t: number, flash: number, w: number, h: number, project: Project) {
  const T = LANDING_TIMELINE;
  if (t >= T.drop && t < T.drop + T.speedLines) {
    const f = (t - T.drop) / T.speedLines;
    const center = project(game.player.x, game.player.y - 20) ?? { x: w / 2, y: h / 2 };
    const reach = Math.hypot(w, h);
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 46; i++) {
      const a = (i * 2.399) % (Math.PI * 2);
      const jitter = ((i * 37) % 11) / 11;
      const inner = reach * (0.16 + jitter * 0.18 + f * 0.1);
      const spread = 0.012 + jitter * 0.012;
      ctx.globalAlpha = (1 - f) * 0.9;
      ctx.beginPath();
      ctx.moveTo(center.x + Math.cos(a) * inner, center.y + Math.sin(a) * inner);
      ctx.lineTo(center.x + Math.cos(a - spread) * reach, center.y + Math.sin(a - spread) * reach);
      ctx.lineTo(center.x + Math.cos(a + spread) * reach, center.y + Math.sin(a + spread) * reach);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (flash > 0 && !game.cosmetics.calm) {
    ctx.fillStyle = `rgba(255,255,255,${flash})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawBars(ctx: CanvasRenderingContext2D, t: number, w: number, h: number) {
  const T = BOSS_TIMELINE;
  const end = T.taunt + T.tauntHold;
  const open = t < T.barsIn ? t / T.barsIn : t > end ? Math.max(0, 1 - (t - end) / T.barsOut) : 1;
  const bar = h * 0.12 * open;
  ctx.fillStyle = "#04050a";
  ctx.fillRect(0, 0, w, bar);
  ctx.fillRect(0, h - bar, w, bar);
}

function drawGimmick(ctx: CanvasRenderingContext2D, gimmick: string, t: number, w: number, h: number) {
  const T = BOSS_TIMELINE;
  if (t >= T.impact) return;
  const pulse = Math.floor(t * 8) % 2 === 0;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (gimmick === "modal" || gimmick === "pdf") {
    const mw = Math.min(460, w * 0.8);
    const mh = 190;
    const x = (w - mw) / 2;
    const y = (h - mh) / 2;
    ctx.fillStyle = "#f4f6fb";
    ctx.fillRect(x, y, mw, mh);
    ctx.fillStyle = gimmick === "modal" ? "#3b6cff" : "#c23c3c";
    ctx.fillRect(x, y, mw, 34);
    ctx.fillStyle = "#fff";
    ctx.font = `700 14px ${FONT_UI}`;
    ctx.fillText(gimmick === "modal" ? "Wallet · Signature request" : "offer_letter_FINAL.pdf", w / 2, y + 17);
    ctx.fillStyle = "#14161f";
    ctx.font = `800 26px ${FONT_UI}`;
    ctx.fillText(gimmick === "modal" ? "CLAIM YOUR AIRDROP" : "Senior Rust Engineer", w / 2, y + 76);
    ctx.font = `500 13px ${FONT_MONO}`;
    ctx.fillStyle = "#5a6072";
    ctx.fillText(gimmick === "modal" ? "spender: 0xdead…c0de   amount: UNLIMITED" : "$900k + tokens. Please enable macros.", w / 2, y + 110);
    ctx.fillStyle = pulse ? "#2ec27e" : "#25a56a";
    ctx.fillRect(w / 2 - 90, y + 134, 180, 38);
    ctx.fillStyle = "#fff";
    ctx.font = `800 15px ${FONT_UI}`;
    ctx.fillText(gimmick === "modal" ? "SIGN" : "OPEN", w / 2, y + 153);
    return;
  }
  if (gimmick === "rewind") {
    ctx.fillStyle = "rgba(180,60,255,0.16)";
    ctx.fillRect(0, 0, w, h);
    for (let y = (t * 500) % 24; y < h; y += 24) {
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(0, y, w, 2);
    }
    ctx.fillStyle = "#fff";
    ctx.font = `800 40px ${FONT_MONO}`;
    ctx.fillText("<< TX FRONT-RUN", w / 2, h / 2);
    return;
  }
  if (gimmick === "prices") {
    ctx.font = `800 30px ${FONT_MONO}`;
    for (let i = 0; i < 8; i++) {
      const v = Math.abs(Math.sin(i * 12.3 + Math.floor(t * 12) * 1.7)) * 9999;
      ctx.fillStyle = i % 2 ? "#ff5c48" : "#2ee6c7";
      ctx.fillText(`$${v.toFixed(2)}`, w * (0.14 + (i % 4) * 0.24), h * (0.32 + Math.floor(i / 4) * 0.36));
    }
    return;
  }
  if (gimmick === "salute") {
    ctx.fillStyle = "#ff5c48";
    ctx.font = `800 26px ${FONT_MONO}`;
    ctx.fillText("ALL UNITS: HOLD POSITION", w / 2, h * 0.22);
    return;
  }
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#ffc23d";
  ctx.font = `800 34px ${FONT_MONO}`;
  ctx.fillText("BLOCK HEIGHT HALTED", w / 2, h / 2);
}

function drawBossEntrance(ctx: CanvasRenderingContext2D, game: Game, t: number, w: number, h: number) {
  const T = BOSS_TIMELINE;
  const kind = game.cinematic?.bossKind;
  if (!kind) return;
  const data = BOSS_ENTRANCES[kind];
  const def = ENEMIES[kind];
  drawBars(ctx, t, w, h);
  if (data) drawGimmick(ctx, data.gimmick, t, w, h);
  const tauntEnd = T.taunt + T.tauntHold;
  if (t >= T.impact && t < tauntEnd) {
    const f = Math.min(1, (t - T.impact) / 0.18);
    const plateX = -320 * (1 - f * f) + 28;
    ctx.fillStyle = "rgba(4,5,10,0.88)";
    ctx.fillRect(plateX, h * 0.15, 310, 62);
    ctx.fillStyle = def.color;
    ctx.fillRect(plateX, h * 0.15, 5, 62);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.font = `800 21px ${FONT_UI}`;
    ctx.fillText(def.name.toUpperCase(), plateX + 18, h * 0.15 + 23);
    ctx.fillStyle = "#ffc23d";
    ctx.font = `500 12px ${FONT_MONO}`;
    ctx.fillText(data?.title ?? "", plateX + 18, h * 0.15 + 46);
  }
  if (data && t >= T.taunt && t < tauntEnd) {
    const boxW = Math.min(720, w - 32);
    const boxH = 96;
    const x = (w - boxW) / 2;
    const y = h - h * 0.12 - boxH - 12;
    ctx.fillStyle = "rgba(6,7,14,0.94)";
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, boxW, boxH);
    const sprite = getThreatSprite(kind);
    const ph = boxH - 16;
    const pw = Math.min(90, ph * (sprite.width / sprite.height));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, x + 10, y + 8, pw, ph);
    const shown = data.line.slice(0, Math.floor((t - T.taunt) * T.typeCps));
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fff";
    ctx.font = `600 16px ${FONT_MONO}`;
    wrap(ctx, shown, x + pw + 26, y + 36, boxW - pw - 44, 24);
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  let line = "";
  let ly = y;
  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, ly);
      line = word;
      ly += lineH;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, ly);
}
