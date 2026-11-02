import "./styles.css";
import { Input } from "./engine/Input";
import { Game } from "./game/Game";
import { Canvas2DRenderer } from "./render/Canvas2DRenderer";
import { applyCanvasSize } from "./render/viewport";
import { OverlayUI } from "./ui/OverlayUI";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

function resize() {
  applyCanvasSize(canvas, ctx);
}

resize();
window.addEventListener("resize", resize);

const input = new Input(canvas);
const renderer = new Canvas2DRenderer(canvas, ctx);

const uiBridge: { overlay: OverlayUI | null } = { overlay: null };

const game = new Game(canvas, input, {
  onPhaseChange: (phase) => {
    uiBridge.overlay?.onPhaseChange(phase);
    uiBridge.overlay?.showPauseBadge(phase === "paused");
  },
  onLevelUpChoices: (choices) => uiBridge.overlay?.onLevelUpChoices(choices),
  onHudUpdate: (data) => uiBridge.overlay?.onHudUpdate(data),
});

const overlay = new OverlayUI(game);
uiBridge.overlay = overlay;
overlay.init();

let last = performance.now();

function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  renderer.draw(game);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
