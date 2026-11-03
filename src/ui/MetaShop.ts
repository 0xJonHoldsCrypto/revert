import { canBuyPerk, MAX_TOTAL_RANKS, META_PERKS, totalRanks } from "../data/metaPerks";
import { requirementText, UNLOCKS } from "../data/unlocks";
import { CHARACTERS } from "../data/characters";
import { WEAPONS } from "../data/weapons";
import type { Game } from "../game/Game";
import type { WeaponKind } from "../types";
import * as save from "../save";
import { openMetaModal } from "./metaModal";
import { focusWithin } from "./focusTrap";

const REASON = { "max-rank": "MAXED", cap: "CAP", shards: "NEED" } as const;

function targetName(kind: string, target: string): string {
  if (kind === "hero") return CHARACTERS.find((c) => c.id === target)?.name ?? target;
  return WEAPONS[target as WeaponKind]?.name ?? target;
}

export function open(game: Game, onChange: () => void) {
  const modal = openMetaModal(game, "shop", "BOUNTY SHOP", onChange);
  if (!modal) return;
  const { body } = modal;
  body.addEventListener("click", (e) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-act]");
    if (!button || button.disabled) return;
    const id = button.dataset.id!;
    const act = button.dataset.act;
    const ok = act === "perk" ? save.buyPerk(id as Parameters<typeof save.buyPerk>[0]) : act === "unlock" ? save.buyUnlock(id) : save.refundPerks() > 0;
    game.audio.play(ok ? "coin" : "ui");
    render();
    onChange();
    focusWithin(modal.card, body.querySelector<HTMLElement>(`button[data-act="${act}"][data-id="${id}"]`) ?? body.querySelector<HTMLElement>("button:not([disabled])"));
  });

  function render() {
    const data = save.get();
    const ranks = data.meta.perks;
    const used = totalRanks(ranks);
    const unlocked = save.unlockedNow(data);
    const perkRows = META_PERKS.map((p) => {
      const rank = ranks[p.id] ?? 0;
      const check = canBuyPerk(ranks, data.meta.shards, p.id);
      const label = check.ok ? `BUY ◆${check.cost}` : check.reason === "shards" ? `NEED ◆${check.cost}` : REASON[check.reason];
      const pips = Array.from({ length: p.maxRank }, (_, i) => `<i class="${i < rank ? "on" : ""}"></i>`).join("");
      return `<div class="meta-row"><div><h3>${p.name}</h3><p>${p.desc}</p><span class="meta-pips" aria-label="Rank ${rank} of ${p.maxRank}">${pips}</span></div><button type="button" class="btn btn-secondary" data-act="perk" data-id="${p.id}" ${check.ok ? "" : "disabled"}>${label}</button></div>`;
    }).join("");
    const unlockRows = UNLOCKS.map((u) => {
      const owned = unlocked.includes(u.id);
      const affordable = data.meta.shards >= u.shards;
      const button = owned ? `<b class="meta-owned">UNLOCKED</b>` : `<button type="button" class="btn btn-secondary" data-act="unlock" data-id="${u.id}" ${affordable ? "" : "disabled"}>◆${u.shards}</button>`;
      return `<div class="meta-row${owned ? "" : " locked"}"><div><h3>${u.kind === "hero" ? "HERO" : "TOOL"} · ${targetName(u.kind, u.target)}</h3><p>${owned ? "Available in every run." : requirementText(u)}</p></div>${button}</div>`;
    }).join("");
    body.innerHTML = `
      <div class="meta-balance"><strong>◆ ${data.meta.shards.toLocaleString("en-US")}</strong><span>Bounty Shards · ${data.meta.earned.toLocaleString("en-US")} earned</span></div>
      <p class="meta-note">Perks apply at the start of every standard run. Ranks used ${used}/${MAX_TOTAL_RANKS}. Runs with perks are verified but flagged unranked. Daily runs ignore perks.</p>
      <h3 class="meta-head">PERKS</h3>
      <div class="meta-list">${perkRows}</div>
      <div class="meta-refund"><button type="button" class="btn btn-secondary" data-act="refund" data-id="all" ${used ? "" : "disabled"}>REFUND ALL PERKS</button></div>
      <h3 class="meta-head">UNLOCKS</h3>
      <div class="meta-list">${unlockRows}</div>
    `;
  }

  render();
  focusWithin(modal.card, body.querySelector<HTMLElement>("button:not([disabled])"));
}
