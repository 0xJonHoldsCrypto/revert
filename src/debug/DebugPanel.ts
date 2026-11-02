import { BOSS_KINDS } from "../constants";
import type { CutsceneId } from "../cutscene/CutsceneEngine";
import type { Game } from "../game/Game";
import type { EnemyKind } from "../types";

const CUTSCENES: CutsceneId[] = ["intro", "victory"];
const TIME_JUMPS = [60, 115, 205, 295, 385, 475, 835, 1195];

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.style.cssText = "font:11px monospace;margin:1px;padding:1px 4px;cursor:pointer";
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
    b.blur();
  });
  return b;
}

function row(title: string, items: HTMLElement[]): HTMLElement {
  const el = document.createElement("div");
  el.textContent = `${title} `;
  items.forEach((i) => el.appendChild(i));
  return el;
}

type RenderStats = { calls: number; triangles: number; scale: number; tier: string };

export function mountDebugPanel(game: Game, renderStats: () => RenderStats | null) {
  (window as unknown as { __game: Game }).__game = game;
  const panel = document.createElement("div");
  panel.style.cssText =
    "position:fixed;right:6px;bottom:6px;z-index:50;background:rgba(0,0,0,.8);color:#9fe;font:11px monospace;padding:6px;max-width:420px;pointer-events:auto";
  const stats = document.createElement("div");
  panel.appendChild(stats);
  panel.appendChild(row("t", TIME_JUMPS.map((t) => button(`${t}s`, () => game.debugSetTime(t)))));
  panel.appendChild(row("boss", BOSS_KINDS.map((k) => button(k.replace("boss-", ""), () => game.debugSpawnBoss(k as EnemyKind)))));
  panel.appendChild(row("scene", CUTSCENES.map((c) => button(c, () => game.debugPlayCutscene(c)))));
  panel.appendChild(
    row("cheat", [
      button("god", () => {
        game.god = !game.god;
      }),
      button("+xp", () => {
        if (game.player) game.player.xp = game.player.xpToNext - 1;
      }),
    ])
  );
  document.body.appendChild(panel);

  let frames = 0;
  let windowStart = performance.now();
  const tick = (now: number) => {
    frames++;
    if (now - windowStart >= 500) {
      const fps = Math.round((frames * 1000) / (now - windowStart));
      const r = renderStats();
      stats.textContent = `fps ${fps} · enemies ${game.enemies.length} · t ${game.elapsed.toFixed(0)} · god ${game.god} · ${r?.tier} draws ${r?.calls} scale ${r?.scale.toFixed(2)}`;
      frames = 0;
      windowStart = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
