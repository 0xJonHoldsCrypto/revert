import type { Game } from "../game/Game";
import { trapTab } from "./focusTrap";

export type MetaModal = { card: HTMLElement; body: HTMLElement; close(): void };

let current: MetaModal | null = null;

export function openMetaModal(game: Game, id: string, title: string, onClose: () => void): MetaModal | null {
  if (current) return null;
  const backdrop = document.createElement("div");
  backdrop.className = "settings-backdrop";
  backdrop.innerHTML = `
    <div class="settings-card meta-card" role="dialog" aria-modal="true" aria-labelledby="${id}-title">
      <h2 id="${id}-title">${title}</h2>
      <div class="meta-body"></div>
      <div class="set-actions"><button type="button" class="btn btn-primary" data-close>DONE <kbd>ESC</kbd></button></div>
    </div>
  `;
  document.body.appendChild(backdrop);
  const card = backdrop.querySelector<HTMLElement>(".meta-card")!;
  const onKey = (e: KeyboardEvent) => {
    e.stopImmediatePropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else trapTab(card, e);
  };
  window.addEventListener("keydown", onKey, true);
  backdrop.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    if (e.target === backdrop) close();
  });
  function close() {
    window.removeEventListener("keydown", onKey, true);
    backdrop.remove();
    current = null;
    document.getElementById("game")?.focus();
    game.audio.play("ui");
    onClose();
  }
  card.querySelector("[data-close]")!.addEventListener("click", close);
  current = { card, body: card.querySelector<HTMLElement>(".meta-body")!, close };
  return current;
}
