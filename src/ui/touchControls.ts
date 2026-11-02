import type { Input } from "../engine/Input";
import type { GamePhase } from "../types";

let root: HTMLElement | null = null;
let abilityButton: HTMLButtonElement | null = null;

function touchButton(id: string, label: string, onPress: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.id = id;
  b.type = "button";
  b.textContent = label;
  b.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onPress();
  });
  root!.appendChild(b);
  return b;
}

export function mountTouchControls(input: Input) {
  root = document.createElement("div");
  root.id = "touch-ui";
  touchButton("touch-dash", "DASH", () => input.pressDash());
  abilityButton = touchButton("touch-ability", "", () => input.pressAbility());
  abilityButton.hidden = true;
  touchButton("touch-pause", "II", () => input.pressPause());
  document.body.appendChild(root);
}

export function syncTouchVisible(phase: GamePhase) {
  root?.classList.toggle("on", phase === "playing");
}

export function syncTouchAbility(ability: { name: string; remaining: number } | null) {
  if (!abilityButton) return;
  abilityButton.hidden = !ability;
  if (!ability) return;
  const label = ability.remaining > 0 ? `${Math.ceil(ability.remaining)}s` : ability.name;
  if (abilityButton.textContent !== label) abilityButton.textContent = label;
  abilityButton.disabled = ability.remaining > 0;
}
