import "./styles.css";
import { Input } from "./engine/Input";
import { Game } from "./game/Game";
import { createThreePixelEngine, type PixelEngine } from "./render/ThreePixelEngine";
import { getCharacter } from "./data/characters";
import { ENEMIES } from "./data/enemies";
import { WELL_STATS } from "./data/wells";
import { CHESTS } from "./data/environment";
import { FONT_MONO, FONT_UI } from "./ui/theme";
import { applyCanvasBackingStore, applyCanvasSize, readViewport } from "./render/viewport";
import { OverlayUI } from "./ui/OverlayUI";
import { bootProgress, failBoot, finishBoot } from "./ui/bootScreen";
import { drawCinematic } from "./ui/cinematicOverlay";
import { bindMute } from "./ui/muteButton";
import { mountTouchControls, syncTouchVisible } from "./ui/touchControls";
import { CAMEOS } from "./data/cameos";
import { groundHalfExtents } from "./render/view";
import { chestSprite } from "./pixel/handArt";
import { getThreatSprite } from "./pixel/threatArt";
import { cameoSprite, interactableSprite } from "./pixel/worldArt";
import type { InteractableKind } from "./types";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const uiCanvas = document.createElement("canvas");
uiCanvas.id = "ui";
const app = document.getElementById("app")!;
const overlayEl = document.getElementById("overlay");
if (overlayEl) app.insertBefore(uiCanvas, overlayEl);
else app.appendChild(uiCanvas);
const uiCtx = uiCanvas.getContext("2d")!;

function resizeWebGL() {
  applyCanvasBackingStore(canvas);
}

function resizeUi() {
  const vp = readViewport(canvas);
  applyCanvasSize(uiCanvas, uiCtx);
  return vp;
}

resizeWebGL();
resizeUi();
window.addEventListener("resize", () => {
  resizeWebGL();
  resizeUi();
});

const input = new Input(canvas);

const uiBridge: { overlay: OverlayUI | null } = { overlay: null };

const game = new Game(canvas, input, {
  onPhaseChange: (phase) => {
    uiBridge.overlay?.onPhaseChange(phase);
    syncTouchVisible(phase);
  },
  onLevelUpChoices: (choices) => uiBridge.overlay?.onLevelUpChoices(choices),
  onHudUpdate: (data) => uiBridge.overlay?.onHudUpdate(data),
});

const overlay = new OverlayUI(game);
uiBridge.overlay = overlay;
overlay.init();
bindMute(game.audio);
mountTouchControls(input);

const SIM_STEP = 1 / 60;
const MAX_SIM_STEPS = 8;
let accumulator = 0;
let pixelEngine: PixelEngine | null = null;
let last = performance.now();
let loopStarted = false;

function isWorldVisible() {
  return game.phase === "menu" || game.phase === "playing" || game.phase === "paused" || game.phase === "levelup" || game.phase === "lost" || game.phase === "cinematic";
}

function drawUiOverlay() {
  const vp = readViewport(uiCanvas);
  uiCtx.clearRect(0, 0, vp.width, vp.height);
  if (game.phase === "cinematic") {
    drawCinematic(uiCtx, game, vp.width, vp.height, (x, y) => pixelEngine?.worldToScreen(x, y, vp.width, vp.height) ?? null);
    drawSkipHint(vp.width, vp.height);
    return;
  }
  if (isWorldVisible() && game.player) {
    if (game.phase !== "lost" && game.phase !== "menu") drawRunChrome(vp.width, vp.height);
    return;
  }

  if (game.phase === "cutscene") {
    drawSkipHint(vp.width, vp.height);
  }
}

const COARSE_POINTER = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

function drawSkipHint(w: number, h: number) {
  uiCtx.textAlign = "right";
  uiCtx.textBaseline = "alphabetic";
  uiCtx.fillStyle = "rgba(4,6,12,0.7)";
  uiCtx.fillRect(w - 158, h - 40, 146, 28);
  uiCtx.fillStyle = "#f0c14d";
  uiCtx.font = `600 12px ${FONT_MONO}`;
  uiCtx.fillText(COARSE_POINTER ? "HOLD SCREEN TO SKIP" : "HOLD SPACE TO SKIP", w - 20, h - 22);
  const progress = game.cutsceneSkipProgress;
  if (progress > 0) uiCtx.fillRect(w - 158, h - 14, 146 * progress, 2);
}

function drawFeetBars(w: number, h: number) {
  const p = game.player;
  const s = pixelEngine?.worldToScreen(p.x, p.y + 24, w, h);
  if (!s) return;
  const barW = 54;
  const x = s.x - barW / 2;
  const y = s.y;
  uiCtx.fillStyle = "rgba(4,6,12,0.82)";
  uiCtx.fillRect(x - 1, y - 1, barW + 2, 9);
  uiCtx.fillStyle = "#ff5d7a";
  uiCtx.fillRect(x, y, barW * Math.max(0, p.hp / p.maxHp), 4);
  const dashMax = getCharacter(p.characterId).dashCooldown;
  const ready = 1 - Math.max(0, p.dashCooldown) / dashMax;
  uiCtx.fillStyle = ready >= 1 ? "#2ee6c7" : "#3a6a78";
  uiCtx.fillRect(x, y + 5, barW * ready, 2);
}

function drawEnemyTags(w: number, h: number) {
  uiCtx.textAlign = "center";
  uiCtx.font = `700 11px ${FONT_MONO}`;
  for (const e of game.enemies) {
    if (e.kind !== "insider" && !e.feedNode && !e.implant && !e.carried && !e.elite) continue;
    const s = pixelEngine?.worldToScreen(e.x, e.y - e.radius * 3.6, w, h);
    if (!s || s.x < 0 || s.y < 0 || s.x > w || s.y > h) continue;
    let text = "";
    let color = "#2ee6c7";
    if (e.elite) { text = e.bounty ? "BOUNTY" : "WHALE"; color = "#ffc23d"; }
    else if (e.kind === "insider" && !e.revealed) text = "STAFF ✓";
    else if (e.implant) { text = "IMPLANT"; color = "#ff5c48"; }
    else if (e.feedNode) { text = "PRICE FEED"; color = "#79c0ff"; }
    else if (e.carried) { text = `-$${(e.carried / 1e6).toFixed(1)}M`; color = "#ff5c48"; }
    if (!text) continue;
    uiCtx.fillStyle = "rgba(4,6,12,0.82)";
    uiCtx.fillRect(s.x - 36, s.y - 12, 72, 16);
    uiCtx.fillStyle = color;
    uiCtx.fillText(text, s.x, s.y);
  }
}

function poiArrows() {
  const p = game.player;
  const nearest = new Map<string, { x: number; y: number; d: number; color: string; icon: HTMLCanvasElement; dim: boolean }>();
  const offer = (key: string, x: number, y: number, color: string, icon: HTMLCanvasElement, dim = false) => {
    const d = Math.hypot(x - p.x, y - p.y);
    const best = nearest.get(key);
    if (!best || d < best.d) nearest.set(key, { x, y, d, color, icon, dim });
  };
  for (const c of game.chests) {
    if (!c.opened) offer(`chest:${c.kind}`, c.x, c.y, CHESTS[c.kind].color, chestSprite(c.kind), p.coins < game.chestCost(c.coinCost));
  }
  const canMerge = game.mergeOptions().length > 0;
  for (const item of game.interactables) {
    if (item.used || game.elapsed < item.readyAt) continue;
    if (item.kind === "cameo") offer("cameo", item.x, item.y, CAMEOS[item.cameo!].color, cameoSprite(item.cameo!));
    else if (item.kind === "merge-contract") offer(item.kind, item.x, item.y, "#b58cff", interactableSprite(item.kind), !canMerge);
    else if (ARROW_ITEMS[item.kind]) offer(item.kind, item.x, item.y, ARROW_ITEMS[item.kind]!, interactableSprite(item.kind as ArrowKind));
  }
  for (const e of game.enemies) {
    if (ENEMIES[e.kind].isBoss) offer("boss", e.x, e.y, "#ff5c48", getThreatSprite(e.kind));
    else if (e.bounty) offer("bounty", e.x, e.y, "#ffc23d", getThreatSprite(e.kind));
  }
  return nearest;
}

function drawOffscreenPointers(w: number, h: number) {
  const { halfW, halfH } = groundHalfExtents(w / h);
  const p = game.player;
  const targets = [...poiArrows().values()].filter((t) => Math.abs(t.x - p.x) > halfW || Math.abs(t.y - p.y) > halfH * 0.9);
  targets.sort((a, b) => a.d - b.d);
  for (const target of targets.slice(0, MAX_ARROWS)) drawPointer(target, w, h);
}

const ARROW_ITEMS: Partial<Record<InteractableKind, string>> = {
  airdrop: "#f4f3ee",
  "staking-pad": "#ffc23d",
  "hardware-rack": "#79c0ff",
  "bounty-board": "#ffc23d",
};
type ArrowKind = "airdrop" | "staking-pad" | "hardware-rack" | "bounty-board";

function drawPointer(target: { x: number; y: number; color: string; icon: HTMLCanvasElement; dim: boolean }, w: number, h: number) {
  const p = game.player;
  const a = Math.atan2((target.y - p.y) * ARROW_DEPTH_SQUASH, target.x - p.x);
  const rx = w / 2 - 34;
  const ry = h / 2 - 76;
  const k = Math.min(rx / Math.max(Math.abs(Math.cos(a)), 1e-3), ry / Math.max(Math.abs(Math.sin(a)), 1e-3));
  const cx = w / 2 + Math.cos(a) * k;
  const cy = h / 2 + Math.sin(a) * k;
  uiCtx.save();
  uiCtx.globalAlpha = target.dim ? 0.45 : 1;
  uiCtx.translate(cx, cy);
  uiCtx.fillStyle = "rgba(4,6,12,0.82)";
  uiCtx.fillRect(-15, -15, 30, 30);
  uiCtx.strokeStyle = target.color;
  uiCtx.lineWidth = 2;
  uiCtx.strokeRect(-15, -15, 30, 30);
  const scale = Math.min(22 / target.icon.width, 22 / target.icon.height);
  uiCtx.imageSmoothingEnabled = false;
  uiCtx.drawImage(target.icon, (-target.icon.width * scale) / 2, (-target.icon.height * scale) / 2, target.icon.width * scale, target.icon.height * scale);
  uiCtx.rotate(a);
  uiCtx.fillStyle = target.color;
  uiCtx.beginPath();
  uiCtx.moveTo(28, 0);
  uiCtx.lineTo(17, -7);
  uiCtx.lineTo(17, 7);
  uiCtx.fill();
  uiCtx.restore();
}

const RADAR_RANGE = 1500;
const MAX_ARROWS = 7;
const ARROW_DEPTH_SQUASH = 0.77;

function drawRadar(w: number) {
  const size = w < 640 ? 76 : 108;
  const x = w - size - 12;
  const y = w < 640 ? 62 : 72;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const p = game.player;
  const dot = (wx: number, wy: number, color: string, r: number) => {
    const dx = ((wx - p.x) / RADAR_RANGE) * (size / 2);
    const dy = ((wy - p.y) / RADAR_RANGE) * (size / 2);
    if (Math.abs(dx) > size / 2 - 2 || Math.abs(dy) > size / 2 - 2) return;
    uiCtx.fillStyle = color;
    uiCtx.fillRect(Math.round(cx + dx - r / 2), Math.round(cy + dy - r / 2), r, r);
  };
  uiCtx.fillStyle = "rgba(4,6,12,0.72)";
  uiCtx.fillRect(x, y, size, size);
  uiCtx.strokeStyle = "rgba(255,255,255,0.14)";
  uiCtx.lineWidth = 1;
  uiCtx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  for (const well of game.wells) if (!well.used) dot(well.x, well.y, "#6cb6ff", 3);
  for (const chest of game.chests) if (!chest.opened) dot(chest.x, chest.y, "#f0c14d", 3);
  for (const item of game.interactables) {
    if (item.used) continue;
    if (item.kind === "cameo") dot(item.x, item.y, CAMEOS[item.cameo!].color, 5);
    else if (item.kind === "airdrop") dot(item.x, item.y, "#ffffff", 4);
    else dot(item.x, item.y, "#2ee6c7", 2);
  }
  for (const e of game.enemies) if (ENEMIES[e.kind].isBoss || e.elite) dot(e.x, e.y, "#ff5c48", 5);
  uiCtx.fillStyle = "#ffffff";
  uiCtx.fillRect(cx - 1, cy - 1, 3, 3);
}

function drawStick() {
  const origin = input.stickOrigin;
  if (!origin) return;
  uiCtx.strokeStyle = "rgba(255,255,255,0.35)";
  uiCtx.lineWidth = 2;
  uiCtx.beginPath();
  uiCtx.arc(origin.x, origin.y, 52, 0, Math.PI * 2);
  uiCtx.stroke();
  uiCtx.fillStyle = "rgba(46,230,199,0.55)";
  uiCtx.beginPath();
  uiCtx.arc(origin.x + input.touchMove.x * 52, origin.y + input.touchMove.y * 52, 20, 0, Math.PI * 2);
  uiCtx.fill();
}

const ITEM_PROMPT: Record<string, string> = {
  faucet: "Faucet · free $SAFU",
  "lp-pool": "Liquidity pool · stand to heal",
  "bridge-gate": "Bridge · jump across the map",
  "exploit-charge": "Exploit charge · step on to arm a big blast",
  "staking-pad": "Staking pad · temporary boost",
  "merge-contract": "Merge contract · bring two identical items",
  "hardware-rack": "Hardware rack · recruit or upgrade a rig",
  "bounty-board": "Bounty board · post a whale hunt",
  airdrop: "Airdrop · free loot",
};

function drawRunChrome(w: number, h: number) {
  const p = game.player;
  if (!p) return;
  drawFeetBars(w, h);
  drawEnemyTags(w, h);
  drawOffscreenPointers(w, h);
  drawRadar(w);
  drawStick();

  for (const f of game.floaters) {
    const s = pixelEngine?.worldToScreen(f.x, f.y, w, h);
    if (!s) continue;
    const age = 1 - f.life / f.maxLife;
    const hits = f.hits ?? 1;
    const size = Math.round(Math.min(26, 13 + Math.log2(hits + 1) * 3) * (age < 0.12 ? 1.25 : 1));
    uiCtx.globalAlpha = Math.min(1, (f.life / f.maxLife) * 2.2);
    uiCtx.font = `800 ${size}px ${FONT_UI}`;
    uiCtx.textAlign = "center";
    uiCtx.lineWidth = 3;
    uiCtx.strokeStyle = "#08080f";
    uiCtx.strokeText(f.text, s.x, s.y);
    uiCtx.fillStyle = f.color;
    uiCtx.fillText(f.text, s.x, s.y);
  }
  uiCtx.globalAlpha = 1;

  const boss = game.enemies.find((e) => !e.dead && ENEMIES[e.kind].isBoss);
  if (boss) {
    const pct = Math.max(0, boss.hp / boss.maxHp);
    const shown = game.priceLieTimer > 0 ? Math.abs(Math.sin(performance.now() / 90)) : pct;
    uiCtx.fillStyle = "rgba(4,6,12,0.82)";
    uiCtx.fillRect(w * 0.25, 82, w * 0.5, 16);
    uiCtx.fillStyle = "#e0303c";
    uiCtx.fillRect(w * 0.25 + 2, 84, (w * 0.5 - 4) * shown, 12);
    uiCtx.fillStyle = "#fff";
    uiCtx.font = `700 11px ${FONT_MONO}`;
    uiCtx.textAlign = "center";
    uiCtx.fillText(ENEMIES[boss.kind].name.toUpperCase(), w / 2, 94);
  }

  let prompt = "";
  let best = 130;
  for (const c of game.chests) {
    if (c.opened) continue;
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d < best) {
      best = d;
      const realCost = game.chestCost(c.coinCost);
      const cost = game.priceLieTimer > 0 ? 1 + Math.floor(Math.abs(Math.sin(performance.now() / 70)) * 9000) : realCost;
      prompt = p.coins >= realCost ? `Step in · ${CHESTS[c.kind].name} · ${cost} SAFU` : `Need ${cost} SAFU`;
    }
  }
  for (const well of game.wells) {
    if (well.used) continue;
    const d = Math.hypot(p.x - well.x, p.y - well.y);
    if (d < well.radius + 28) prompt = `Step in — ${WELL_STATS[well.stat].title}`;
  }
  for (const item of game.interactables) {
    if (item.used || game.elapsed < item.readyAt) continue;
    if (Math.hypot(p.x - item.x, p.y - item.y) > item.radius + 70) continue;
    prompt = item.cameo ? `${CAMEOS[item.cameo].name} · ${CAMEOS[item.cameo].deal}` : ITEM_PROMPT[item.kind] ?? "";
  }
  if (prompt) {
    const s = pixelEngine?.worldToScreen(p.x, p.y - 60, w, h);
    if (s) {
      uiCtx.font = `500 13px ${FONT_UI}`;
      const pw = Math.ceil(uiCtx.measureText(prompt).width) + 28;
      uiCtx.fillStyle = "rgba(8,12,16,0.72)";
      uiCtx.fillRect(s.x - pw / 2, s.y - 28, pw, 22);
      uiCtx.fillStyle = "#f0c14d";
      uiCtx.textAlign = "center";
      uiCtx.fillText(prompt, s.x, s.y - 13);
    }
  }
}

let errorShown = false;

function showLoopError(error: unknown) {
  console.error(error);
  if (errorShown) return;
  errorShown = true;
  const banner = document.createElement("div");
  banner.setAttribute("role", "alert");
  banner.textContent = "Something broke in the game loop. Reload the page if it looks stuck.";
  banner.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:9999;padding:8px 12px;background:#ff5c48;color:#0b0f14;font:600 13px system-ui,sans-serif;text-align:center";
  document.body.appendChild(banner);
}

function loop(now: number) {
  requestAnimationFrame(loop);
  try {
    const frameDt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (game.windowActive) accumulator += frameDt;
    let steps = 0;
    while (accumulator >= SIM_STEP && steps < MAX_SIM_STEPS) {
      game.update(SIM_STEP);
      accumulator -= SIM_STEP;
      steps++;
    }
    if (steps === MAX_SIM_STEPS) accumulator = 0;

    if (isWorldVisible() || game.phase === "cutscene") pixelEngine?.render(game, frameDt, accumulator / SIM_STEP);
    drawUiOverlay();
  } catch (error) {
    accumulator = 0;
    showLoopError(error);
  }
}

bootProgress(0.55);
createThreePixelEngine(canvas)
  .then((engine) => {
    pixelEngine = engine;
    bootProgress(0.95);
    game.setPhase("menu");
    finishBoot(() => overlay.showTitleReady());
    if (!loopStarted) {
      loopStarted = true;
      requestAnimationFrame(loop);
    }
  })
  .catch(() => failBoot("This game needs WebGL. Turn on hardware acceleration or try another browser."));

function wake() {
  game.setWindowActive(true);
  game.audio.unlock();
}

window.addEventListener("pointerdown", wake);
window.addEventListener("keydown", wake);
window.addEventListener("focus", () => game.setWindowActive(true));
window.addEventListener("blur", () => game.setWindowActive(false));
document.addEventListener("visibilitychange", () => {
  game.setWindowActive(!document.hidden);
});

if (import.meta.env.DEV && new URLSearchParams(location.search).has("debug")) {
  void import("./debug/DebugPanel").then(({ mountDebugPanel }) => mountDebugPanel(game, () => pixelEngine?.stats() ?? null));
}

canvas.addEventListener("click", () => input.focus());
