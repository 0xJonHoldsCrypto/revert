import "./styles.css";
import { Input } from "./engine/Input";
import { Game } from "./game/Game";
import { TitleSceneRenderer } from "./render/TitleSceneRenderer";
import { createThreePixelEngine, type PixelEngine } from "./render/ThreePixelEngine";
import { getCharacter } from "./data/characters";
import { drawGbcWorld, gbcToScreen } from "./render/GbcRenderer";
import { difficultyFromClick } from "./data/difficulty";
import { ENEMIES } from "./data/enemies";
import { WELL_STATS } from "./data/wells";
import { CHESTS } from "./data/environment";
import { FONT_MONO, FONT_UI } from "./ui/theme";
import { applyCanvasBackingStore, applyCanvasSize, readViewport } from "./render/viewport";
import { OverlayUI } from "./ui/OverlayUI";

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

let pixelEngine: PixelEngine | null = null;
let last = performance.now();
let loopStarted = false;

function drawUiOverlay() {
  const vp = readViewport(uiCanvas);
  const playing = game.phase === "playing" || game.phase === "paused" || game.phase === "levelup";
  if (playing && game.player) {
    drawGbcWorld(uiCtx, game, vp.width, vp.height);
    drawRunChrome(vp.width, vp.height);
    return;
  }
  uiCtx.clearRect(0, 0, vp.width, vp.height);

  if (game.phase === "menu") {
    titleScene.setHero(getCharacter(game.menuHero));
    titleScene.drawOverlay(uiCtx, vp.width, vp.height);
  } else if (game.phase === "cutscene") {
    game.cutscene.draw(uiCtx, vp.width, vp.height);
  }
}

function drawRunChrome(w: number, h: number) {
  const p = game.player;
  if (!p) return;

  for (const f of game.floaters) {
    const s = gbcToScreen(game, f.x, f.y, w, h);
    if (!s) continue;
    uiCtx.globalAlpha = Math.max(0, f.life / f.maxLife);
    uiCtx.fillStyle = f.color;
    uiCtx.font = `600 14px ${FONT_UI}`;
    uiCtx.textAlign = "center";
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
      prompt = p.coins >= c.coinCost ? `Step in · ${CHESTS[c.kind].name} · ${c.coinCost} sats` : `Need ${c.coinCost} sats`;
    }
  }
  for (const well of game.wells) {
    if (well.used) continue;
    const d = Math.hypot(p.x - well.x, p.y - well.y);
    if (d < well.radius + 28) prompt = `Step in — ${WELL_STATS[well.stat].title}`;
  }
  if (prompt) {
    const s = gbcToScreen(game, p.x, p.y - 28, w, h);
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
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.cutscene.skipProgress = game.cutsceneSkipProgress;

  if (game.phase === "menu") titleScene.update(dt);

  const playing = game.phase === "playing" || game.phase === "paused" || game.phase === "levelup";
  if (!playing) pixelEngine?.render(game, dt);
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

window.addEventListener("blur", () => game.autoPause());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) game.autoPause();
});

if (import.meta.env.DEV && new URLSearchParams(location.search).has("debug")) {
  void import("./debug/DebugPanel").then(({ mountDebugPanel }) => mountDebugPanel(game));
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
  if (game.phase === "cutscene") game.cutscene.advance();
  else if (game.phase === "paused") game.togglePause();
});
