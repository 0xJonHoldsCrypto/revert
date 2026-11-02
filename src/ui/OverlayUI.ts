import { RARITY_LABEL } from "../data/rarity";
import type { UpgradeDef } from "../types";
import type { GamePhase } from "../types";
import { formatTime } from "../utils/math";
import type { Game, HudData } from "../game/Game";

export class OverlayUI {
  private overlay: HTMLElement;
  private hudEl: HTMLElement | null = null;

  constructor(private game: Game) {
    this.overlay = document.getElementById("overlay")!;
  }

  handlePauseTap() {
    if (this.game.phase === "paused") this.game.togglePause();
  }

  init() {
    this.overlay.innerHTML = "";
    this.overlay.classList.remove("interactive");
  }

  onPhaseChange(phase: GamePhase) {
    this.overlay.classList.toggle("interactive", phase === "levelup" || phase === "won" || phase === "lost");
    if (phase === "menu" || phase === "cutscene") {
      this.overlay.innerHTML = "";
      this.hudEl = null;
    }
    if (phase === "levelup") {
      void 0;
    } else if (phase === "won") this.showEnd(true);
    else if (phase === "lost") this.showEnd(false);
    else     if (phase === "playing" || phase === "paused") {
      this.clearOverlay();
      this.ensureHud();
    }
    if (phase === "paused") {
      this.overlay.classList.remove("interactive");
      this.showPauseBadge(true);
    } else if (phase === "playing") {
      this.showPauseBadge(false);
    }
  }

  onLevelUpChoices(choices: UpgradeDef[]) {
    this.overlay.innerHTML = "";
    this.overlay.classList.add("interactive");
    const panel = document.createElement("div");
    panel.className = "overlay-panel";
    panel.innerHTML = `
      <div class="panel-card">
        <h1>Level up</h1>
        <p class="tagline">Exploit.run · pick a tool before the next block.</p>
        <div class="upgrade-grid" id="upgrade-grid"></div>
      </div>
    `;
    this.overlay.appendChild(panel);
    const grid = panel.querySelector("#upgrade-grid")!;
    choices.forEach((c, i) => {
      const card = document.createElement("button");
      card.type = "button";
      const rarity = c.rarity ?? "common";
      card.className = `upgrade-card rarity-${rarity}`;
      card.innerHTML = `<span class="rarity-tag">${RARITY_LABEL[rarity]}</span><h4>${c.title}</h4><p>${c.description}</p>`;
      card.addEventListener("click", () => this.game.pickUpgrade(i));
      grid.appendChild(card);
    });
  }

  onHudUpdate(data: HudData) {
    this.ensureHud();
    if (!this.hudEl) return;
    const hpPct = (data.hp / data.maxHp) * 100;
    const xpPct = (data.xp / data.xpToNext) * 100;
    const weaponLines = data.weapons
      .map((w: { name: string; level: number; rarity: string }) =>
        `<div><span class="rarity-tag">${RARITY_LABEL[w.rarity as keyof typeof RARITY_LABEL] ?? w.rarity}</span> ${w.name} Lv${w.level}</div>`
      )
      .join("");
    const buffLines =
      data.buffs.length === 0
        ? "—"
        : data.buffs.map((b) => `${b.label} ${Math.ceil(b.remaining)}s`).join("<br/>");
    this.hudEl.innerHTML = `
      <div class="wordmark">Exploit<span>.run</span></div>
      <div class="hud-block">
        <strong>HP</strong>
        ${Math.ceil(data.hp)} / ${data.maxHp}
        <div class="bar"><div class="bar-fill hp" style="width:${hpPct}%"></div></div>
      </div>
      <div class="hud-block">
        <strong>LV ${data.level}</strong>
        XP to next
        <div class="bar"><div class="bar-fill xp" style="width:${xpPct}%"></div></div>
      </div>
      <div class="hud-block">
        <strong>ZONE</strong>
        ${data.biome}<br/>
        🪙 ${data.coins} sats
        ${data.sidekick ? `<br/>🤖 ${data.sidekick}` : ""}
      </div>
      <div class="hud-block">
        <strong>BUFFS</strong>
        ${buffLines}
      </div>
      <div class="hud-block">
        <strong>RUN</strong>
        ⏱ ${formatTime(data.time)} / ${formatTime(20 * 60)}<br/>
        ☠ ${data.kills} exploits patched
      </div>
      <div class="hud-block">
        <strong>LOADOUT</strong>
        ${weaponLines || "—"}
      </div>
    `;
  }

  private ensureHud() {
    if (this.hudEl?.isConnected) return;
    this.hudEl = document.createElement("div");
    this.hudEl.className = "hud";
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

  private showEnd(won: boolean) {
    this.overlay.innerHTML = "";
    this.overlay.classList.add("interactive");
    this.hudEl = null;
    const s = this.game.stats;
    const panel = document.createElement("div");
    panel.className = "overlay-panel";
    panel.innerHTML = `
      <div class="panel-card">
        <p class="wordmark" style="position:static;left:auto;transform:none;margin-bottom:0.6rem">Exploit<span>.run</span></p>
        <h1>${won ? "Funds safu" : "Rekt"}</h1>
        <p class="tagline">
          ${won ? "You survived 20 minutes. Lazarus logs off in shame." : "The exploit won this round. Re-deploy your ego."}
        </p>
        <p style="text-align:center;margin-bottom:1.25rem;line-height:1.8;color:#8b949e">
          Time: ${formatTime(s.timeSurvived)} · Kills: ${s.kills} · Bosses: ${s.bossesDefeated}<br/>
          Damage dealt: ${Math.floor(s.damageDealt).toLocaleString()}
        </p>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" id="again-btn">PLAY AGAIN</button>
          <button type="button" class="btn btn-secondary" id="menu-btn">TITLE</button>
          <button type="button" class="btn btn-secondary" id="wallet-btn">SUBMIT SCORE (WALLET)</button>
        </div>
        <p class="controls-hint" id="wallet-status"></p>
      </div>
    `;
    this.overlay.appendChild(panel);
    panel.querySelector("#again-btn")!.addEventListener("click", () => this.game.requestStartRun());
    panel.querySelector("#menu-btn")!.addEventListener("click", () => this.game.setPhase("menu"));
    panel.querySelector("#wallet-btn")!.addEventListener("click", () => void this.submitWalletScore(won, panel));
  }

  private async submitWalletScore(won: boolean, panel: HTMLElement) {
    const status = panel.querySelector("#wallet-status") as HTMLElement;
    if (!won) {
      status.textContent = "Wallet submit requires a survived run (FUNDS SAFU).";
      return;
    }
    status.textContent = "Signing…";
    const { submitScoreWithWallet } = await import("../web3/submitScore");
    const payload = this.game.recorder.build(
      this.game.selectedCharacter,
      Math.floor(this.game.stats.kills * 100 + this.game.stats.timeSurvived),
      this.game.stats.timeSurvived,
      this.game.stats.kills
    );
    const apiBase = window.location.origin.includes("localhost") ? "http://localhost:8787" : window.location.origin;
    const result = await submitScoreWithWallet(payload, apiBase);
    status.textContent = result.message;
  }

  showPauseBadge(show: boolean) {
    let badge = this.overlay.querySelector(".pause-badge");
    if (show && !badge) {
      badge = document.createElement("div");
      badge.className = "pause-badge";
      badge.textContent = "PAUSED · Tap to resume";
      this.overlay.appendChild(badge);
    } else if (!show && badge) {
      badge.remove();
    }
  }
}
