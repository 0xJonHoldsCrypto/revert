import "./styles.css";
import { Input } from "./engine/Input";
import { Game } from "./game/Game";
import { TitleSceneRenderer } from "./render/TitleSceneRenderer";
import { createThreePixelEngine, type PixelEngine } from "./render/ThreePixelEngine";
import { getCharacter } from "./data/characters";
import { difficultyFromClick } from "./data/difficulty";
import { ENEMIES } from "./data/enemies";
import { WELL_STATS } from "./data/wells";
import { CHESTS } from "./data/environment";
import { FONT_MONO, FONT_UI } from "./ui/theme";
import { applyCanvasBackingStore, applyCanvasSize, readViewport } from "./render/viewport";
import { OverlayUI } from "./ui/OverlayUI";
import { drawCinematic } from "./ui/cinematicOverlay";

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
const titleScene = new TitleSceneRenderer();

const uiBridge: { overlay: OverlayUI | null } = { overlay: null };

const game = new Game(canvas, input, {
  onPhaseChange: (phase) => {
    uiBridge.overlay?.onPhaseChange(phase);
    uiBridge.overlay?.showPauseBadge(phase === "paused");
    if (phase === "menu") {
      titleScene.setHero(getCharacter(game.menuHero));
      titleScene.setDifficulty(game.runDifficulty);
    }
  },
  onLevelUpChoices: (choices) => uiBridge.overlay?.onLevelUpChoices(choices),
  onHudUpdate: (data) => uiBridge.overlay?.onHudUpdate(data),
});

const overlay = new OverlayUI(game);
uiBridge.overlay = overlay;
overlay.init();
game.rollMenuHero();
titleScene.setHero(getCharacter(game.menuHero));
titleScene.setDifficulty(game.runDifficulty);

const SIM_STEP = 1 / 60;
const MAX_SIM_STEPS = 8;
let accumulator = 0;
let pixelEngine: PixelEngine | null = null;
let last = performance.now();
let loopStarted = false;

function isWorldVisible() {
  return game.phase === "playing" || game.phase === "paused" || game.phase === "levelup" || game.phase === "won" || game.phase === "lost" || game.phase === "cinematic";
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
    if (game.phase !== "won" && game.phase !== "lost") drawRunChrome(vp.width, vp.height);
    return;
  }

  if (game.phase === "menu") {
    titleScene.setHero(getCharacter(game.menuHero));
    titleScene.drawOverlay(uiCtx, vp.width, vp.height);
  } else if (game.phase === "cutscene") {
    drawSkipHint(vp.width, vp.height);
  }
}

function drawSkipHint(w: number, h: number) {
  uiCtx.textAlign = "right";
  uiCtx.textBaseline = "alphabetic";
  uiCtx.fillStyle = "rgba(4,6,12,0.7)";
  uiCtx.fillRect(w - 158, h - 40, 146, 28);
  uiCtx.fillStyle = "#f0c14d";
  uiCtx.font = `600 12px ${FONT_MONO}`;
  uiCtx.fillText("HOLD SPACE TO SKIP", w - 20, h - 22);
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

function drawRunChrome(w: number, h: number) {
  const p = game.player;
  if (!p) return;
  drawFeetBars(w, h);

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
    uiCtx.fillStyle = "rgba(0,0,0,0.55)";
    uiCtx.fillRect(w * 0.2, 16, w * 0.6, 14);
    uiCtx.fillStyle = "#f85149";
    uiCtx.fillRect(w * 0.2, 16, w * 0.6 * pct, 14);
    uiCtx.fillStyle = "#fff";
    uiCtx.font = `500 12px ${FONT_MONO}`;
    uiCtx.textAlign = "center";
    uiCtx.fillText(boss ? ENEMIES[boss.kind].name : "BOSS", w / 2, 27);
  }

  let prompt = "";
  let best = 130;
  for (const c of game.chests) {
    if (c.opened) continue;
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d < best) {
      best = d;
      prompt = p.coins >= c.coinCost ? `Step in · ${CHESTS[c.kind].name} · ${c.coinCost} SAFU` : `Need ${c.coinCost} SAFU`;
    }
  }
  for (const well of game.wells) {
    if (well.used) continue;
    const d = Math.hypot(p.x - well.x, p.y - well.y);
    if (d < well.radius + 28) prompt = `Step in — ${WELL_STATS[well.stat].title}`;
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

function loop(now: number) {
  const frameDt = Math.min(0.25, (now - last) / 1000);
  last = now;
  accumulator += frameDt;
  let steps = 0;
  while (accumulator >= SIM_STEP && steps < MAX_SIM_STEPS) {
    game.update(SIM_STEP);
    accumulator -= SIM_STEP;
    steps++;
  }
  if (steps === MAX_SIM_STEPS) accumulator = 0;

  if (game.phase === "menu") titleScene.update(frameDt);

  if (isWorldVisible() || game.phase === "cutscene") pixelEngine?.render(game, frameDt, accumulator / SIM_STEP);
  drawUiOverlay();
  requestAnimationFrame(loop);
}

createThreePixelEngine(canvas).then((engine) => {
  pixelEngine = engine;
  if (!loopStarted) {
    loopStarted = true;
    requestAnimationFrame(loop);
  }
});

window.addEventListener("pointerdown", () => game.audio.unlock());
window.addEventListener("keydown", () => game.audio.unlock());
window.addEventListener("blur", () => game.autoPause());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) game.autoPause();
});

if (import.meta.env.DEV && new URLSearchParams(location.search).has("debug")) {
  void import("./debug/DebugPanel").then(({ mountDebugPanel }) => mountDebugPanel(game, () => pixelEngine?.stats() ?? null));
}

canvas.addEventListener("click", (e) => {
  input.focus();
  const vp = readViewport(canvas);
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if (game.phase === "menu") {
    if (titleScene.hitStart(mx, my, vp.width, vp.height)) {
      game.requestStartRun(true);
      return;
    }
    const diff = difficultyFromClick(mx, my, vp.width, vp.height);
    if (diff) {
      game.runDifficulty = diff;
      titleScene.setDifficulty(diff);
      return;
    }
  }
  if (game.phase === "paused") game.togglePause();
});
