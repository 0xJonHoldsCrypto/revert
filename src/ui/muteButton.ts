const STORAGE_KEY = "revert.audio.v1";
const ICON_ON = `<svg viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="6" width="3" height="4"/><rect x="4" y="5" width="1" height="6"/><rect x="5" y="4" width="1" height="8"/><rect x="6" y="3" width="1" height="10"/><rect x="7" y="2" width="1" height="12"/><rect x="10" y="6" width="1" height="4"/><rect x="12" y="4" width="1" height="8"/><rect x="14" y="2" width="1" height="12"/></svg>`;
const ICON_OFF = `<svg viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="6" width="3" height="4"/><rect x="4" y="5" width="1" height="6"/><rect x="5" y="4" width="1" height="8"/><rect x="6" y="3" width="1" height="10"/><rect x="7" y="2" width="1" height="12"/><rect x="10" y="5" width="1" height="1"/><rect x="11" y="6" width="1" height="1"/><rect x="12" y="7" width="1" height="2"/><rect x="13" y="6" width="1" height="1"/><rect x="14" y="5" width="1" height="1"/><rect x="11" y="9" width="1" height="1"/><rect x="10" y="10" width="1" height="1"/><rect x="13" y="9" width="1" height="1"/><rect x="14" y="10" width="1" height="1"/></svg>`;

type MuteTarget = { muted: boolean; toggleMute(): void; unlock(): void; onMuteChange: ((muted: boolean) => void) | null };

let button: HTMLButtonElement | null = null;
let target: MuteTarget | null = null;

function storedMute(): boolean {
  try {
    return !!(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as { muted?: boolean }).muted;
  } catch {
    return false;
  }
}

function storeMute(muted: boolean) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, unknown>;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, muted }));
  } catch {
    button?.setAttribute("data-unsaved", "true");
  }
}

function render(muted: boolean) {
  if (!button) return;
  button.innerHTML = muted ? ICON_OFF : ICON_ON;
  button.setAttribute("aria-pressed", String(muted));
  button.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
  button.title = muted ? "Sound off (M)" : "Sound on (M)";
}

export function mountMuteButton() {
  button = document.createElement("button");
  button.id = "mute-btn";
  button.type = "button";
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (target) {
      target.unlock();
      target.toggleMute();
    } else {
      const muted = !storedMute();
      storeMute(muted);
      render(muted);
    }
    button?.blur();
  });
  document.body.appendChild(button);
  render(storedMute());
}

export function bindMute(audio: MuteTarget) {
  target = audio;
  audio.muted = storedMute();
  audio.onMuteChange = render;
  render(audio.muted);
}
