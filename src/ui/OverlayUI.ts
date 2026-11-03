import { RARITY_LABEL } from "../data/rarity";
import { TitleScreen } from "./TitleScreen";
import type { UpgradeDef } from "../types";
import type { GamePhase } from "../types";
import { formatTime } from "../utils/math";
import type { Game, HudData } from "../game/Game";
import { syncTouchAbility } from "./touchControls";
import { openSettings } from "./gearButton";
import * as save from "../save";

function formatFunds(value: number): string {
  return value >= 1e9 ? `$${(value / 1e9).toFixed(2)}B` : `$${(value / 1e6).toFixed(1)}M`;
}

export class OverlayUI {
  private overlay: HTMLElement;
  private title: TitleScreen;
  private hudEl: HTMLElement | null = null;
  private hudDyn: HTMLElement | null = null;
  private hudNodes: ChildNode[] = [];
  private hudHtml: string[] = [];
  private levelHintOpen = false;

  constructor(private game: Game) {
    this.overlay = document.getElementById("overlay")!;
    this.title = new TitleScreen(game);
  }

  init() {
    this.overlay.innerHTML = "";
    this.overlay.classList.remove("interactive");
  }

  showTitleReady() {
    this.overlay.querySelector(".title")?.classList.add("ready");
  }

  onPhaseChange(phase: GamePhase) {
    if (phase !== "levelup") this.levelHintOpen = false;
    this.overlay.classList.toggle("interactive", phase === "levelup" || phase === "lost" || phase === "paused" || phase === "menu");
    this.title.unmount();
    if (phase === "menu" || phase === "cutscene" || phase === "cinematic") {
      this.overlay.innerHTML = "";
      this.hudEl = null;
    }
    if (phase === "menu") {
      this.title.mount(this.overlay);
      this.showTitleReady();
    } else if (phase === "lost") this.showEnd();
    else if (phase === "playing" || phase === "paused") {
      this.clearOverlay();
      this.ensureHud();
    }
    if (phase === "paused") this.showPauseMenu();
  }

  private buildPanel(): string {
    const b = this.game.buildSummary();
    const top = b.tools[0]?.dps ?? 1;
    return `<div class="menu-card build-panel">
      <h2>YOUR BUILD</h2>
      <div class="build-stats">${b.stats.map(([k, v]) => `<div><label>${k}</label><strong>${v}</strong></div>`).join("")}</div>
      <h3>Tools · about ${Math.round(b.total)} DPS</h3>
      ${b.tools.map((t) => `<div class="pm-bar"><span>${t.name} · Lv ${t.level}</span><b>${Math.round(t.dps)}</b><i style="width:${(t.dps / top) * 100}%"></i></div>`).join("")}
      <h3>Gear</h3>
      ${b.gear.map((g) => `<p><b>${g.slot}</b> ${g.name}${g.lines.length ? ` · ${g.lines.join(", ")}` : ""}</p>`).join("")}
      ${b.stash.length ? `<h3>Stash</h3><p>${b.stash.join(", ")}</p>` : ""}
      ${b.merges.length ? `<p class="build-merge">Ready to merge at a Merge Contract: ${b.merges.join(", ")}</p>` : ""}
      ${b.rigs.length ? `<h3>Hardware</h3><p>${b.rigs.join(", ")}</p>` : ""}
    </div>`;
  }

  private showPauseMenu() {
    const panel = document.createElement("div");
    panel.className = "overlay-panel pause-menu pause-with-build";
    panel.innerHTML = `
      <div class="menu-card">
        <h1>TX PAUSED</h1>
        <p>The attacker is not paused. Kidding. Take your time.</p>
        <button type="button" class="btn btn-primary" data-a="resume">RESUME <kbd>ESC</kbd></button>
        <button type="button" class="btn btn-secondary" data-a="mute"></button>
        <button type="button" class="btn btn-secondary" data-a="settings">SETTINGS</button>
        <button type="button" class="btn btn-secondary" data-a="restart">RESTART RUN</button>
        <button type="button" class="btn btn-secondary" data-a="quit">QUIT TO TITLE</button>
        <p class="t-keys"><kbd>WASD</kbd> move <kbd>SPACE</kbd> dash <kbd>Q</kbd> ability <kbd>1-3</kbd> pick card <kbd>M</kbd> mute</p>
      </div>
      ${this.buildPanel()}
    `;
    const label = () => {
      panel.querySelector('[data-a="mute"]')!.textContent = this.game.audio.muted ? "SOUND: OFF" : "SOUND: ON";
    };
    label();
    panel.querySelectorAll<HTMLElement>("[data-a]").forEach((b) => {
      b.addEventListener("click", () => {
        const action = b.dataset.a;
        if (action === "resume") this.game.togglePause();
        if (action === "restart") this.game.requestStartRun();
        if (action === "quit") this.game.setPhase("menu");
        if (action === "settings") openSettings(this.game);
        if (action === "mute") {
          this.game.audio.toggleMute();
          label();
        }
      });
    });
    this.overlay.appendChild(panel);
  }

  onLevelUpChoices(choices: UpgradeDef[]) {
    this.overlay.innerHTML = "";
    this.hudEl = null;
    this.overlay.classList.add("interactive");
    const panel = document.createElement("div");
    panel.className = "overlay-panel levelup";
    const gear = this.game.choiceMode === "popup";
    const showHint = !gear && (this.levelHintOpen || !save.get().tutorial.levelHint);
    if (showHint) {
      this.levelHintOpen = true;
      save.patch((d) => {
        d.tutorial.levelHint = true;
      });
    }
    panel.innerHTML = `
      <div class="lv-wrap">
        <h1>${gear ? this.game.popupTitle : "NEW BLOCK. SIGN ONE."}</h1>
        ${showHint ? `<p class="lv-hint"><b>First pick.</b> Rarity sets power: Common, Uncommon, Rare, Epic, Legendary (colour and label). <b>RECOMMENDED</b> marks the best fit for your current build. Hit the <b>✕</b> on a card to banish it for this run.</p>` : ""}
        <div class="upgrade-grid" id="upgrade-grid"></div>
        ${gear ? "" : `<div class="lv-actions">
          <span class="lv-banish">BANISH ${this.game.banishes}</span>
          <button type="button" class="btn btn-secondary" id="lv-reroll" ${this.game.rerolls <= 0 ? "disabled" : ""}>REORG (${this.game.rerolls}) <kbd>R</kbd></button>
          <button type="button" class="btn btn-secondary" id="lv-skip">SKIP, HEAL 15 <kbd>X</kbd></button>
        </div>`}
      </div>
    `;
    this.overlay.appendChild(panel);
    const grid = panel.querySelector("#upgrade-grid")!;
    choices.forEach((c, i) => {
      const card = document.createElement("button");
      card.type = "button";
      const rarity = c.rarity ?? "common";
      const kind = c.tag ?? (c.id.startsWith("deal-") || c.id.startsWith("bounty-") ? "CHOICE" : "PASSIVE");
      card.className = `upgrade-card rarity-${rarity}${c.recommended ? " recommended" : ""}`;
      const compare = c.compare?.length ? `<ul class="card-compare">${c.compare.map((l) => `<li>${l}</li>`).join("")}</ul>` : "";
      const value = c.value !== undefined && c.value > 0 ? `<small class="card-value">Worth about +${Math.round(c.value)} DPS</small>` : "";
      const gates = Boolean(c.tag?.startsWith("EVOLVE")) || c.id.startsWith("upgrade-");
      const banishNote = gates ? "Banish for this run. Warning: this card is part of an evolution." : "Banish for this run";
      const banish = !gear && this.game.banishes > 0 ? `<i class="card-banish" title="${banishNote}">✕</i>` : "";
      card.innerHTML = `${c.recommended ? `<b class="card-rec">RECOMMENDED</b>` : ""}<kbd>${i + 1}</kbd>${banish}<span class="rarity-tag">${kind} · ${RARITY_LABEL[rarity]}</span><h4>${c.title}</h4><p>${c.description}</p>${compare}${value}`;
      card.addEventListener("click", (event) => {
        if ((event.target as HTMLElement).classList.contains("card-banish")) {
          if (!gates || window.confirm("This card is part of an evolution. Banishing it blocks that evolution for this run. Banish anyway?")) this.game.banishCard(i);
        }
        else this.game.pickUpgrade(i);
      });
      grid.appendChild(card);
    });
    panel.querySelector("#lv-reroll")?.addEventListener("click", () => this.game.rerollCards());
    panel.querySelector("#lv-skip")?.addEventListener("click", () => this.game.skipCards());
  }

  onHudUpdate(data: HudData) {
    if (this.game.phase !== "playing" && this.game.phase !== "paused") return;
    this.ensureHud();
    if (!this.hudEl) return;
    const xpPct = Math.min(100, (data.xp / data.xpToNext) * 100);
    const fundsText = data.lie ? `$${(Math.random() * 99).toFixed(2)}B` : formatFunds(data.funds);
    const weaponLines = data.weapons
      .map((w) => `<div class="hud-weapon rarity-${w.rarity}${w.jammed ? " jammed" : ""}"><span>${w.jammed ? "HIJACKED" : w.name}</span><b>${"▮".repeat(Math.min(w.level, 8))}</b></div>`)
      .join("");
    const gearLines = data.gear
      .filter((g) => g.name)
      .map((g) => `<div class="hud-weapon rarity-${g.rarity}"><span>${g.name}</span><b>${g.slot[0]}</b></div>`)
      .join("");
    const abilityLine = data.ability
      ? `<div class="hud-weapon hud-ability" style="color:${data.ability.color}"><span>${data.ability.name}</span><b>${data.ability.remaining > 0 ? `${Math.ceil(data.ability.remaining)}s` : "Q"}</b></div>`
      : "";
    const rigLines = data.rigs.map((r) => `<div class="hud-weapon hud-rig"><span>${r}</span><b>R</b></div>`).join("");
    syncTouchAbility(data.ability);
    const status = [
      data.signers > 0 ? `SIGNERS ${data.signers}/3` : "",
      data.leverage > 0 ? `LEV ${data.leverage}x` : "",
      data.flash ?? "",
      data.shielded ? "LIQUIDITY LOCKED" : "",
      data.neverSell ? "NEVER SELL · NO DASH" : "",
      ...data.buffs.map((b) => `${b.label} ${Math.ceil(b.remaining)}s`),
    ].filter(Boolean);
    const alert = data.swapped
      ? `<div class="hud-alert danger">SIM SWAPPED · CONTROLS INVERTED</div>`
      : data.banner
        ? `<div class="hud-banner" style="border-color:${data.banner.tone}"><strong style="color:${data.banner.tone}">${data.banner.title}</strong><span>${data.banner.text}</span></div>`
        : "";
    const sections = [
      `<div class="hud-xp"><div style="width:${xpPct}%"></div></div>`,
      `<div class="hud-funds${data.fundsPct < 30 ? " low" : ""}${data.lie ? " lying" : ""}">
        <label>FUNDS AT RISK</label>
        <strong>${fundsText}</strong>
        <div class="hud-funds-bar"><div style="width:${data.lie ? Math.random() * 100 : data.fundsPct}%"></div></div>
      </div>`,
      `<div class="hud-block-clock${data.gas ? " gas" : ""}">
        <label>${data.gas ? "GAS 9,999 GWEI" : "BLOCK"}</label>
        <strong>${data.block.toLocaleString("en-US")}</strong>
        <span>${formatTime(data.time)} · BOSS ${formatTime(data.nextBoss)}</span>
      </div>`,
      `<div class="hud-stats">
        <div><label>LV</label><strong>${data.level}</strong></div>
        <div><label>REVERTED</label><strong>${data.kills}</strong></div>
        <div><label>$SAFU</label><strong>${data.coins}</strong></div>
      </div>`,
      `<div class="hud-zone">${data.biome}</div>`,
      `<div class="hud-status">${status.map((t) => `<span>${t}</span>`).join("")}</div>`,
      `<div class="hud-loadout">${weaponLines}${gearLines}${rigLines}${abilityLine}</div>`,
      `<div class="hud-feed">${data.feed.map((l) => `<div>${l}</div>`).join("")}</div>`,
      `<div class="hud-toasts">${data.toasts.map((t) => `<div style="border-color:${t.color};color:${t.color}">${t.text}</div>`).join("")}</div>`,
      alert,
    ];
    this.syncHudSections(sections);
  }

  private syncHudSections(sections: string[]) {
    const dyn = this.hudDyn!;
    if (this.hudNodes.length !== sections.length || this.hudNodes[0]?.parentNode !== dyn) {
      dyn.textContent = "";
      this.hudNodes = [];
      this.hudHtml = [];
      for (let i = 0; i < sections.length; i++) {
        const node = document.createComment("");
        dyn.appendChild(node);
        this.hudNodes.push(node);
        this.hudHtml.push("");
      }
    }
    for (let i = 0; i < sections.length; i++) {
      const html = sections[i]!;
      if (html === this.hudHtml[i]) continue;
      this.hudHtml[i] = html;
      const template = document.createElement("template");
      template.innerHTML = html.trim();
      const next = template.content.firstChild ?? document.createComment("");
      this.hudNodes[i]!.replaceWith(next);
      this.hudNodes[i] = next;
    }
  }

  private ensureHud() {
    if (this.hudEl?.isConnected) return;
    this.hudEl = document.createElement("div");
    this.hudEl.className = "hud";
    this.hudDyn = document.createElement("div");
    this.hudEl.appendChild(this.hudDyn);
    this.overlay.appendChild(this.hudEl);
  }

  private clearOverlay() {
    const hud = this.hudEl;
    this.overlay.innerHTML = "";
    if (hud) {
      this.hudEl = hud;
      this.overlay.appendChild(hud);
    }
  }

  private showEnd() {
    this.overlay.innerHTML = "";
    this.overlay.classList.add("interactive");
    this.hudEl = null;
    const m = this.game.postMortem();
    const insolvent = m.cause === "Protocol insolvent";
    const panel = document.createElement("div");
    panel.className = "overlay-panel";
    const top = m.damage[0]?.amount ?? 1;
    panel.innerHTML = `
      <div class="postmortem">
        <header>
          <span>INCIDENT ${m.incident} · BLOCK ${m.block.toLocaleString("en-US")}</span>
          <span class="bad">${insolvent ? "INSOLVENT" : "RESPONDER DOWN"}</span>
        </header>
        <h1>${insolvent ? "The treasury is empty." : "Rekt."}</h1>
        <div class="pm-hero">
          <label>FUNDS SAVED</label>
          <strong>${formatFunds(m.saved)}</strong>
          <span>${m.savedPct.toFixed(1)}% of ${formatFunds(m.saved + m.lost)} · ${m.drainers} drainers stopped</span>
        </div>
        <div class="pm-grid">
          <section>
            <h2>Summary</h2>
            <dl>
              <dt>Score</dt><dd>${m.score.toLocaleString("en-US")} · best ${m.best.toLocaleString("en-US")}</dd>
              <dt>Root cause</dt><dd>${m.cause}</dd>
              <dt>Time on-chain</dt><dd>${formatTime(m.time)}</dd>
              <dt>Exploits reverted</dt><dd>${m.kills}</dd>
              <dt>Bosses contained</dt><dd>${m.bosses}</dd>
              <dt>Responder level</dt><dd>${m.level}</dd>
            </dl>
          </section>
          <section>
            <h2>Timeline</h2>
            <ol>${m.timeline.map((e) => `<li><b>#${e.block.toLocaleString("en-US")}</b> ${e.text}</li>`).join("")}</ol>
          </section>
          <section>
            <h2>Damage by tool</h2>
            ${m.damage.map((d) => `<div class="pm-bar"><span>${d.name}</span><b>${Math.round(d.amount).toLocaleString("en-US")}</b><i style="width:${(d.amount / top) * 100}%"></i></div>`).join("") || "<p>No damage logged.</p>"}
          </section>
        </div>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" id="again-btn">RESPOND AGAIN [R]</button>
          <button type="button" class="btn btn-secondary" id="menu-btn">TITLE</button>
        </div>
      </div>
    `;
    this.overlay.appendChild(panel);
    panel.querySelector("#again-btn")!.addEventListener("click", () => this.game.requestStartRun());
    panel.querySelector("#menu-btn")!.addEventListener("click", () => this.game.setPhase("menu"));
  }

}
