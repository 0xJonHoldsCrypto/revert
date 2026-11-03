import type { Game } from "../game/Game";

const ICON = `<svg viewBox="0 0 16 16" fill="currentColor"><rect x="7" y="1" width="2" height="2"/><rect x="7" y="13" width="2" height="2"/><rect x="1" y="7" width="2" height="2"/><rect x="13" y="7" width="2" height="2"/><rect x="3" y="3" width="2" height="2"/><rect x="11" y="3" width="2" height="2"/><rect x="3" y="11" width="2" height="2"/><rect x="11" y="11" width="2" height="2"/><path fill-rule="evenodd" d="M4 4h8v8H4zM6 6v4h4V6z"/></svg>`;

const LOAD_FAIL_MS = 2600;
let failNote: HTMLElement | null = null;
let failTimer = 0;

export function showLoadError(text = "Could not load that panel. Check your connection and try again.") {
  if (!failNote) {
    failNote = document.createElement("div");
    failNote.className = "load-fail";
    failNote.setAttribute("role", "status");
    document.body.appendChild(failNote);
  }
  failNote.textContent = text;
  failNote.hidden = false;
  window.clearTimeout(failTimer);
  failTimer = window.setTimeout(() => {
    if (failNote) failNote.hidden = true;
  }, LOAD_FAIL_MS);
}

export function lazyPanel(game: Game, load: () => Promise<void>, done: () => void) {
  const resume = game.phase === "playing";
  game.audio.unlock();
  game.autoPause();
  load()
    .catch(() => {
      if (resume && game.phase === "paused") game.togglePause();
      showLoadError();
    })
    .finally(done);
}

let opening = false;

export function openSettings(game: Game) {
  if (opening) return;
  opening = true;
  lazyPanel(game, () => import("./SettingsPanel").then((m) => m.showSettings(game)), () => {
    opening = false;
  });
}

let codexOpening = false;

export function openCodex(game: Game, tab?: string) {
  if (codexOpening) return;
  codexOpening = true;
  lazyPanel(game, () => import("./Codex").then((m) => m.showCodex(game, tab)), () => {
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
