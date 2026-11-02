import { CHARACTERS } from "../data/characters";
import { DIFFICULTY_LABEL, DIFFICULTY_ORDER, type DifficultyId } from "../data/difficulty";
import { WEAPONS } from "../data/weapons";
import type { Game } from "../game/Game";
import { heroPortrait, paintLogo } from "../pixel/handArt";

const DIFF_BLURB: Record<DifficultyId, string> = {
  easy: "Testnet. Forgiving hits.",
  normal: "Mainnet. Recommended.",
  hard: "Insolvency ends the run.",
  nightmare: "Bear market. No mercy.",
};

function stat(label: string, value: number): string {
  return `<div class="t-stat"><span>${label}</span><i><b style="width:${Math.round(value * 100)}%"></b></i></div>`;
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
      const next = (current + (k === "ArrowRight" ? 1 : CHARACTERS.length - 1)) % CHARACTERS.length;
      this.pickHero(next);
    } else if (k >= "1" && k <= "4") {
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
    this.game.chooseHero(hero.id);
    this.game.audio.play("ui");
    this.sync();
  }

  private pickDifficulty(id: DifficultyId) {
    this.game.chooseDifficulty(id);
    this.game.audio.play("ui");
    this.sync();
  }

  private sync() {
    if (!this.el) return;
    this.el.querySelectorAll<HTMLElement>(".t-hero").forEach((card) => {
      card.classList.toggle("on", card.dataset.id === this.game.selectedCharacter);
    });
    this.el.querySelectorAll<HTMLElement>(".t-diff button").forEach((b) => {
      b.classList.toggle("on", b.dataset.id === this.game.runDifficulty);
    });
    const blurb = this.el.querySelector(".t-diff-blurb");
    if (blurb) blurb.textContent = DIFF_BLURB[this.game.runDifficulty];
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
    el.querySelector(".t-start")!.addEventListener("click", () => this.game.requestStartRun(true));
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
