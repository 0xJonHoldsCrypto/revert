import { CHARACTERS } from "../data/characters";
import { DIFFICULTY_LABEL, DIFFICULTY_ORDER, type DifficultyId } from "../data/difficulty";
import { WEAPONS } from "../data/weapons";
import type { Game } from "../game/Game";
import { heroPortrait, paintLogo } from "../pixel/handArt";
import { lazyPanel, openCodex } from "./gearButton";
import { ACHIEVEMENTS } from "../data/achievements";
import * as save from "../save";
import { formatTime } from "../utils/math";
import { heroAvailable, heroUnlockId, requirementText, UNLOCK_BY_ID } from "../data/unlocks";
import { MODIFIER_BY_ID, rewardMults } from "../data/modifiers";
import { currentStreak, dailyPlan, utcDate } from "../daily";
import type { RunPlan } from "../game/Game";
import type { CharacterId } from "../types";

let panelOpening = false;

function openPanel(game: Game, load: () => Promise<{ open(game: Game, onChange: () => void): void }>, onChange: () => void) {
  if (panelOpening) return;
  panelOpening = true;
  lazyPanel(game, () => load().then((m) => m.open(game, onChange)), () => {
    panelOpening = false;
  });
}

export function standardPlan(data: save.SaveData = save.get()): RunPlan {
  return { setup: { perks: { ...data.meta.perks }, mods: [...data.contracts], unlocked: save.unlockedNow(data), mode: "standard", date: null } };
}

const DIFF_BLURB: Record<DifficultyId, string> = {
  easy: "Testnet. Forgiving hits.",
  normal: "Mainnet. Recommended.",
  hard: "Insolvency ends the run.",
  nightmare: "Bear market. No mercy.",
};

function heroName(id: string): string {
  return CHARACTERS.find((c) => c.id === id)?.name ?? id;
}

function difficultyName(id: string): string {
  return DIFFICULTY_LABEL[id as DifficultyId] ?? id;
}

function runLine(run: save.RunSummary): HTMLElement {
  const row = document.createElement("li");
  const when = run.date ? new Date(run.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
  const tools = run.tools.length ? ` · ${run.tools.join(", ")}` : "";
  const crown = run.won ? `👑 REVERTED ${formatTime(run.winTime)} · ` : "";
  row.textContent = `${crown}${when} · ${heroName(run.hero)} · ${difficultyName(run.difficulty)} · ${run.score.toLocaleString("en-US")} · ${formatTime(run.time)} · ${run.rootCause}${tools}`;
  return row;
}

function stat(label: string, value: number): string {
  return `<div class="t-stat"><span>${label}</span><i><b style="width:${Math.round(Math.max(0, Math.min(1, value)) * 100)}%"></b></i></div>`;
}

export class TitleScreen {
  private el: HTMLElement | null = null;
  private timer = 0;

  constructor(private game: Game) {
    window.addEventListener("keydown", (e) => this.onKey(e));
  }

  private onKey(e: KeyboardEvent) {
    if (!this.el || e.repeat) return;
    const k = e.key;
    const current = CHARACTERS.findIndex((c) => c.id === this.game.selectedCharacter);
    if (k === "ArrowRight" || k === "ArrowLeft") {
      const unlocked = save.unlockedNow();
      for (let step = 1; step < CHARACTERS.length; step++) {
        const next = (current + (k === "ArrowRight" ? step : CHARACTERS.length * step - step)) % CHARACTERS.length;
        if (heroAvailable(CHARACTERS[next]!.id, unlocked)) {
          this.pickHero(next);
          break;
        }
      }
    } else if (k >= "1" && k <= String(CHARACTERS.length)) {
      this.pickHero(Number(k) - 1);
    } else if (k === "ArrowUp" || k === "ArrowDown") {
      const i = DIFFICULTY_ORDER.indexOf(this.game.runDifficulty);
      const next = (i + (k === "ArrowDown" ? 1 : DIFFICULTY_ORDER.length - 1)) % DIFFICULTY_ORDER.length;
      this.pickDifficulty(DIFFICULTY_ORDER[next]!);
    }
  }

  private pickHero(index: number) {
    const hero = CHARACTERS[index];
    if (!hero) return;
    if (!heroAvailable(hero.id, save.unlockedNow())) {
      this.game.audio.play("ui");
      this.openShop();
      return;
    }
    this.game.chooseHero(hero.id);
    this.game.audio.play("ui");
    this.sync();
  }

  private pickDifficulty(id: DifficultyId) {
    this.game.chooseDifficulty(id);
    this.game.audio.play("ui");
    this.sync();
  }

  private openShop() {
    openPanel(this.game, () => import("./MetaShop"), () => this.sync());
  }

  private openContracts() {
    openPanel(this.game, () => import("./ContractsPicker"), () => this.sync());
  }

  private startDaily() {
    this.game.requestStartRun(true, dailyPlan(utcDate()));
  }

  private ensureHeroAvailable(data: save.SaveData) {
    const unlocked = save.unlockedNow(data);
    const stored = data.hero as CharacterId | null;
    const wanted = stored && CHARACTERS.some((c) => c.id === stored) && heroAvailable(stored, unlocked) ? stored : this.game.selectedCharacter;
    const pick = heroAvailable(wanted, unlocked) ? wanted : CHARACTERS[0]!.id;
    if (pick !== this.game.selectedCharacter || pick !== stored) this.game.chooseHero(pick);
  }

  private syncMeta(data: save.SaveData) {
    const el = this.el!;
    const unlocked = save.unlockedNow(data);
    el.querySelectorAll<HTMLElement>(".t-hero").forEach((card) => {
      const def = UNLOCK_BY_ID[heroUnlockId(card.dataset.id!)];
      const locked = !heroAvailable(card.dataset.id!, unlocked);
      card.classList.toggle("locked", locked);
      const tag = card.querySelector<HTMLElement>(".t-lock")!;
      tag.hidden = !locked;
      const text = def ? `LOCKED · ${requirementText(def)}` : "";
      if (tag.textContent !== text) tag.textContent = text;
    });
    const shop = el.querySelector<HTMLElement>('[data-open="shop"]')!;
    const shopText = `SHOP ◆${data.meta.shards.toLocaleString("en-US")}`;
    if (shop.textContent !== shopText) shop.textContent = shopText;
    const mult = rewardMults(data.contracts);
    const contracts = el.querySelector<HTMLElement>('[data-open="contracts"]')!;
    const contractText = data.contracts.length ? `CONTRACTS ${data.contracts.length} · ×${mult.score.toFixed(2)}` : "CONTRACTS";
    if (contracts.textContent !== contractText) contracts.textContent = contractText;
    contracts.classList.toggle("on", data.contracts.length > 0);
    const active = el.querySelector<HTMLElement>(".t-contracts")!;
    const activeText = data.contracts.length ? `Signed: ${data.contracts.map((id) => MODIFIER_BY_ID[id].name).join(", ")}` : "";
    active.hidden = !activeText;
    if (active.textContent !== activeText) active.textContent = activeText;
    const today = utcDate();
    const plan = dailyPlan(today);
    const daily = data.daily;
    const streak = currentStreak(daily, today);
    const best = daily.date === today ? ` · best ${daily.best.toLocaleString("en-US")}` : "";
    const dailyText = `DAILY ${today} · ${heroName(plan.hero)} + ${MODIFIER_BY_ID[plan.setup.mods[0]!].name}${best}${streak ? ` · streak ${streak}` : ""}`;
    const dailyBtn = el.querySelector<HTMLElement>(".t-daily")!;
    if (dailyBtn.textContent !== dailyText) dailyBtn.textContent = dailyText;
  }

  private sync() {
    if (!this.el) return;
    const data = save.get();
    this.ensureHeroAvailable(data);
    this.game.runPlan = standardPlan(data);
    this.syncMeta(data);
    this.el.querySelectorAll<HTMLElement>(".t-hero").forEach((card) => {
      card.classList.toggle("on", card.dataset.id === this.game.selectedCharacter);
    });
    this.el.querySelectorAll<HTMLElement>(".t-diff button").forEach((b) => {
      b.classList.toggle("on", b.dataset.id === this.game.runDifficulty);
    });
    const blurb = this.el.querySelector(".t-diff-blurb");
    if (blurb) blurb.textContent = DIFF_BLURB[this.game.runDifficulty];
    this.syncBest();
  }

  private syncBest() {
    const best = this.el?.querySelector(".t-best");
    if (!best) return;
    const hero = this.game.selectedCharacter;
    const difficulty = this.game.runDifficulty;
    const entry = save.get().bests[save.bestKey(hero, difficulty)];
    const text = entry
      ? `BEST ${heroName(hero)} · ${difficultyName(difficulty)}: ${entry.score.toLocaleString("en-US")} · ${formatTime(entry.time)}`
      : `No runs yet as ${heroName(hero)} on ${difficultyName(difficulty)}.`;
    if (best.textContent !== text) best.textContent = text;
  }

  private mountHistory(el: HTMLElement) {
    const history = save.get().history;
    const box = el.querySelector<HTMLElement>(".t-history")!;
    if (!history.length) {
      box.hidden = true;
      return;
    }
    box.querySelector("summary")!.textContent = `LAST RUNS (${Math.min(history.length, 5)})`;
    const list = box.querySelector("ol")!;
    for (const run of history.slice(0, 5)) list.appendChild(runLine(run));
  }

  mount(parent: HTMLElement) {
    this.unmount();
    const el = document.createElement("div");
    el.className = "title";
    el.innerHTML = `
      <div class="t-vignette"></div>
      <div class="t-top">
        <span class="t-live"><b></b>LIVE INCIDENT</span>
        <span>OUTFLOW <strong class="t-outflow">$1.20B</strong></span>
        <span>BLOCK <strong class="t-block">20,999,999</strong></span>
      </div>
      <div class="t-brand"><div class="t-logo"></div><p>execution reverted: <em>not on my watch</em></p></div>
      <div class="t-dock">
        <div class="t-heroes"></div>
        <div class="t-side">
          <div class="t-diff">${DIFFICULTY_ORDER.map((d) => `<button type="button" data-id="${d}">${DIFFICULTY_LABEL[d]}</button>`).join("")}</div>
          <p class="t-diff-blurb"></p>
          <div class="t-record"><p class="t-best"></p><details class="t-history"><summary></summary><ol></ol></details></div>
          <div class="t-links"><button type="button" data-open="threats">CODEX</button><button type="button" data-open="feats"></button></div>
          <div class="t-links"><button type="button" data-open="shop"></button><button type="button" data-open="contracts"></button></div>
          <p class="t-contracts" hidden></p>
          <button type="button" class="t-daily"></button>
          <button type="button" class="t-start"><span>SIGN &amp; REVERT</span><kbd>ENTER</kbd></button>
          <p class="t-keys"><kbd>WASD</kbd> move <kbd>SPACE</kbd> dash <kbd>Q</kbd> ability <kbd>ESC</kbd> pause</p>
        </div>
      </div>
    `;
    const logo = paintLogo(window.innerWidth < 640 ? 6 : 12);
    el.querySelector(".t-logo")!.appendChild(logo);
    const roster = el.querySelector(".t-heroes")!;
    CHARACTERS.forEach((c, i) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "t-hero";
      card.dataset.id = c.id;
      card.style.setProperty("--hero", c.color);
      card.innerHTML = `
        <kbd>${i + 1}</kbd>
        <div class="t-portrait"></div>
        <h3>${c.name}</h3>
        <small>${c.role}</small>
        ${stat("HP", c.maxHp / 125)}${stat("SPD", (c.moveSpeed - 160) / 60)}${stat("DMG", (c.damageMult - 0.7) / 0.6)}
        <p>${WEAPONS[c.startWeapon].name}</p>
        <p class="t-passive">${c.blurb}</p>
        <p class="t-lock" hidden></p>
      `;
      const source = heroPortrait(c.id);
      const portrait = document.createElement("canvas");
      portrait.width = source.width;
      portrait.height = source.height;
      portrait.getContext("2d")!.drawImage(source, 0, 0);
      card.querySelector(".t-portrait")!.appendChild(portrait);
      card.addEventListener("click", () => this.pickHero(i));
      roster.appendChild(card);
    });
    el.querySelectorAll<HTMLElement>(".t-diff button").forEach((b) => {
      b.addEventListener("click", () => this.pickDifficulty(b.dataset.id as DifficultyId));
    });
    const feats = el.querySelector<HTMLElement>('[data-open="feats"]')!;
    feats.textContent = `ACHIEVEMENTS ${Object.keys(save.get().achievements).length}/${ACHIEVEMENTS.length}`;
    el.querySelectorAll<HTMLElement>('[data-open="threats"], [data-open="feats"]').forEach((b) => b.addEventListener("click", () => openCodex(this.game, b.dataset.open)));
    el.querySelector('[data-open="shop"]')!.addEventListener("click", () => this.openShop());
    el.querySelector('[data-open="contracts"]')!.addEventListener("click", () => this.openContracts());
    el.querySelector(".t-daily")!.addEventListener("click", () => this.startDaily());
    el.querySelector(".t-start")!.addEventListener("click", () => this.game.requestStartRun(true, standardPlan()));
    this.mountHistory(el);
    parent.appendChild(el);
    this.el = el;
    this.sync();
    const startedAt = performance.now();
    const outflow = el.querySelector(".t-outflow")!;
    const block = el.querySelector(".t-block")!;
    this.timer = window.setInterval(() => {
      const seconds = (performance.now() - startedAt) / 1000;
      outflow.textContent = `$${Math.min(3.84, 1.2 + seconds * 0.012).toFixed(2)}B`;
      block.textContent = (20999999 + Math.floor(seconds / 12)).toLocaleString("en-US");
      this.sync();
    }, 250);
  }

  unmount() {
    window.clearInterval(this.timer);
    this.el?.remove();
    this.el = null;
  }
}
