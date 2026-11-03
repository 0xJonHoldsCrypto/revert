import type { Game } from "../game/Game";

const ICON = `<svg viewBox="0 0 16 16" fill="currentColor"><rect x="7" y="1" width="2" height="2"/><rect x="7" y="13" width="2" height="2"/><rect x="1" y="7" width="2" height="2"/><rect x="13" y="7" width="2" height="2"/><rect x="3" y="3" width="2" height="2"/><rect x="11" y="3" width="2" height="2"/><rect x="3" y="11" width="2" height="2"/><rect x="11" y="11" width="2" height="2"/><path fill-rule="evenodd" d="M4 4h8v8H4zM6 6v4h4V6z"/></svg>`;

let opening = false;

export function openSettings(game: Game) {
  if (opening) return;
  opening = true;
  game.audio.unlock();
  game.autoPause();
  void import("./SettingsPanel")
    .then((m) => m.showSettings(game))
    .finally(() => {
      opening = false;
    });
}

let codexOpening = false;

export function openCodex(game: Game, tab?: string) {
  if (codexOpening) return;
  codexOpening = true;
  game.audio.unlock();
  game.autoPause();
  void import("./Codex")
    .then((m) => m.showCodex(game, tab))
    .finally(() => {
      codexOpening = false;
    });
}

export function mountGearButton(game: Game) {
  const button = document.createElement("button");
  button.id = "gear-btn";
  button.type = "button";
  button.innerHTML = ICON;
  button.title = "Settings";
  button.setAttribute("aria-label", "Settings");
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    openSettings(game);
    button.blur();
  });
  document.body.appendChild(button);
}
