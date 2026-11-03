import type { Game } from "../game/Game";
import * as save from "../save";
import { COLORBLIND_MODES, HUD_SCALE_MAX, HUD_SCALE_MIN, type ColorblindMode } from "../save";
import { trapTab } from "./focusTrap";

const COLORBLIND_LABEL: Record<ColorblindMode, string> = {
  off: "Off",
  deut: "Deuteranopia (red-green)",
  prot: "Protanopia (red-green)",
  trit: "Tritanopia (blue-yellow)",
};

let open: { close(): void } | null = null;

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function slider(id: string, label: string, value: number, min: number, max: number): string {
  return `<label class="set-row" for="${id}"><span>${label}</span><input id="${id}" type="range" min="${min}" max="${max}" step="5" value="${Math.round(value * 100)}"><output for="${id}">${percent(value)}</output></label>`;
}

function toggle(id: string, label: string, on: boolean, hint = ""): string {
  return `<label class="set-row set-toggle" for="${id}"><span>${label}${hint ? `<small>${hint}</small>` : ""}</span><input id="${id}" type="checkbox" ${on ? "checked" : ""}></label>`;
}

export function showSettings(game: Game) {
  if (open) return;
  const s = save.get().settings;
  const vibrates = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  const backdrop = document.createElement("div");
  backdrop.className = "settings-backdrop";
  backdrop.innerHTML = `
    <div class="settings-card" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <h2 id="settings-title">SETTINGS</h2>
      ${slider("set-music", "Music volume", s.music, 0, 100)}
      ${slider("set-sfx", "Effects volume", s.sfx, 0, 100)}
      ${slider("set-shake", "Screenshake", s.shake, 0, 100)}
      ${toggle("set-calm", "Reduced motion", save.prefersReducedMotion(s), "No shake, flashes or heavy red pulses. Follows your system until changed.")}
      <label class="set-row" for="set-cb"><span>Colorblind mode</span><select id="set-cb">${COLORBLIND_MODES.map((m) => `<option value="${m}" ${m === s.colorblind ? "selected" : ""}>${COLORBLIND_LABEL[m]}</option>`).join("")}</select></label>
      ${toggle("set-haptics", "Vibration", s.haptics && vibrates, vibrates ? "Hurt, level-up, dash and boss pulses." : "Not supported on this device.")}
      <label class="set-row" for="set-hud"><span>HUD size</span><input id="set-hud" type="range" min="${HUD_SCALE_MIN * 100}" max="${HUD_SCALE_MAX * 100}" step="10" value="${Math.round(s.hudScale * 100)}"><output for="set-hud">${percent(s.hudScale)}</output></label>
      ${toggle("set-large", "Large text", s.largeText)}
      ${toggle("set-hints", "Tutorial hints", !save.get().tutorial.done, "Banner tips during your first run and the level-up primer.")}
      <div class="set-actions">
        <button type="button" class="btn btn-secondary" id="set-reset">RESET</button>
        <button type="button" class="btn btn-primary" id="set-close">DONE <kbd>ESC</kbd></button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  const card = backdrop.querySelector<HTMLElement>(".settings-card")!;
  const field = <T extends HTMLElement>(id: string) => backdrop.querySelector<T>(`#${id}`)!;

  const bindRange = (id: string, apply: (value: number) => void) => {
    const input = field<HTMLInputElement>(id);
    const out = backdrop.querySelector<HTMLOutputElement>(`output[for="${id}"]`)!;
    input.addEventListener("input", () => {
      const value = Number(input.value) / 100;
      out.textContent = percent(value);
      apply(value);
    });
  };
  bindRange("set-music", (v) => game.audio.setMusicVolume(v));
  bindRange("set-sfx", (v) => game.audio.setSfxVolume(v));
  field("set-sfx").addEventListener("change", () => game.audio.play("ui"));
  bindRange("set-shake", (v) =>
    save.patch((d) => {
      d.settings.shake = v;
    })
  );
  bindRange("set-hud", (v) =>
    save.patch((d) => {
      d.settings.hudScale = v;
    })
  );
  field<HTMLInputElement>("set-calm").addEventListener("change", (e) => {
    const on = (e.target as HTMLInputElement).checked;
    save.patch((d) => {
      d.settings.reducedMotion = on;
    });
  });
  field<HTMLSelectElement>("set-cb").addEventListener("change", (e) => {
    const mode = (e.target as HTMLSelectElement).value as ColorblindMode;
    save.patch((d) => {
      d.settings.colorblind = mode;
    });
  });
  field<HTMLInputElement>("set-haptics").addEventListener("change", (e) => {
    const on = (e.target as HTMLInputElement).checked;
    save.patch((d) => {
      d.settings.haptics = on;
    });
    if (on && vibrates) navigator.vibrate(30);
  });
  field<HTMLInputElement>("set-large").addEventListener("change", (e) => {
    const on = (e.target as HTMLInputElement).checked;
    save.patch((d) => {
      d.settings.largeText = on;
    });
  });
  field<HTMLInputElement>("set-hints").addEventListener("change", (e) => {
    game.setTutorialDone(!(e.target as HTMLInputElement).checked);
  });
  field("set-reset").addEventListener("click", () => {
    game.audio.setMusicVolume(save.DEFAULT_SETTINGS.music);
    game.audio.setSfxVolume(save.DEFAULT_SETTINGS.sfx);
    save.patch((d) => {
      const muted = d.settings.muted;
      d.settings = { ...save.DEFAULT_SETTINGS, muted };
    });
    close();
    showSettings(game);
  });

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
    open = null;
    document.getElementById("game")?.focus();
    if (game.phase === "playing") game.autoPause();
  }

  open = { close };
  field("set-close").addEventListener("click", close);
  field("set-music").focus();
}
