import { MODIFIERS, rewardMults, type ModifierId } from "../data/modifiers";
import type { Game } from "../game/Game";
import * as save from "../save";
import { openMetaModal } from "./metaModal";

export function open(game: Game, onChange: () => void) {
  const modal = openMetaModal(game, "contracts", "CONTRACTS", onChange);
  if (!modal) return;
  const { body } = modal;
  body.addEventListener("change", (e) => {
    const box = e.target as HTMLInputElement;
    if (box.type !== "checkbox") return;
    const picked = new Set(save.get().contracts);
    if (box.checked) picked.add(box.value as ModifierId);
    else picked.delete(box.value as ModifierId);
    save.setContracts([...picked]);
    game.audio.play("ui");
    renderTotals();
    onChange();
  });

  function renderTotals() {
    const mult = rewardMults(save.get().contracts);
    body.querySelector(".meta-balance")!.innerHTML = `<strong>SCORE ×${mult.score.toFixed(2)}</strong><span>SHARDS ×${mult.shards.toFixed(2)}</span>`;
  }

  const picked = new Set(save.get().contracts);
  body.innerHTML = `
    <div class="meta-balance"></div>
    <p class="meta-note">Opt-in rules for standard runs. Each one makes the run harder and pays more. Bonuses multiply, capped at ×3.</p>
    <div class="meta-list">${MODIFIERS.map(
      (m) => `<label class="meta-row contract"><input type="checkbox" value="${m.id}" ${picked.has(m.id) ? "checked" : ""}><div><h3>${m.name}</h3><p>${m.desc}</p></div><b>×${m.score.toFixed(2)}</b></label>`
    ).join("")}</div>
  `;
  renderTotals();
  body.querySelector<HTMLElement>("input")?.focus();
}
