import { CAMEO_ORDER, CAMEOS, SATOSHI_CHANCE, type CameoId } from "../data/cameos";
import { gearName, rollGear } from "../data/gear";
import { SIDEKICKS } from "../data/sidekicks";
import { biomeAt } from "../data/environment";
import type { EnemyKind, Interactable, InteractableKind } from "../types";
import { dist, randRange } from "../utils/math";
import type { Game } from "./Game";

export const CHANNEL_SEC: Record<InteractableKind, number> = {
  "staking-pad": 1,
  "merge-contract": 0.8,
  "hardware-rack": 0.8,
  faucet: 0.6,
  "lp-pool": 0,
  "bridge-gate": 0.45,
  "exploit-charge": 0.5,
  "bounty-board": 0.9,
  airdrop: 0.6,
  cameo: 0.8,
};
const FAUCET_COOLDOWN_SEC = 50;
const BRIDGE_COOLDOWN_SEC = 25;
const LP_HEAL_PER_SEC = 10;
const CHARGE_FUSE_SEC = 0.9;
const CHARGE_BLAST_RADIUS = 360;
const PAD_COOLDOWN_SEC = 60;
const AIRDROP_LIFT = 420;
const AIRDROP_FALL_PER_SEC = 260;

type Wave = { title: string; text: string; kind: EnemyKind; count: number; minTime: number };

const WAVES: Wave[] = [
  { title: "AIRDROP SEASON", text: "Farmers inbound. Thousands of wallets. One human.", kind: "airdrop-farmer", count: 16, minTime: 0 },
  { title: "SYBIL RAID", text: "Every kill splits. Keep moving.", kind: "sybil", count: 8, minTime: 90 },
  { title: "FLASH BOT SWARM", text: "Watch the lines. Sidestep.", kind: "flash-bot", count: 9, minTime: 130 },
  { title: "LIQUIDATION CASCADE", text: "They speed up as your HP drops.", kind: "liquidator", count: 5, minTime: 190 },
  { title: "PUMP GROUP", text: "Kill them before they dump.", kind: "pump-bot", count: 8, minTime: 220 },
];

export class WorldEvents {
  private nextWaveAt = 42;
  private nextAirdropAt = 38;
  private nextCameoAt = 62;
  private nextPostAt = 90;
  private cameoIndex = 0;
  private delayedWave: { at: number; kind: EnemyKind; count: number } | null = null;

  constructor(private game: Game) {}

  update(dt: number) {
    const g = this.game;
    if (g.elapsed >= this.nextWaveAt) this.launchWave();
    if (g.elapsed >= this.nextAirdropAt) this.dropAirdrop();
    if (g.elapsed >= this.nextCameoAt) this.summonCameo();
    if (g.elapsed >= this.nextPostAt) this.postFromFeed();
    if (this.delayedWave && g.elapsed >= this.delayedWave.at) {
      g.spawnRing(this.delayedWave.kind, this.delayedWave.count);
      this.delayedWave = null;
    }
    for (const item of g.interactables) {
      if (!item.used) this.updateItem(item, dt);
    }
  }

  private launchWave() {
    const g = this.game;
    this.nextWaveAt = g.elapsed + randRange(38, 62);
    const options = WAVES.filter((w) => g.elapsed >= w.minTime);
    const wave = options[Math.floor(g.rand() * options.length)]!;
    g.spawnRing(wave.kind, Math.round(wave.count * (1 + g.elapsed / 420)));
    g.queueBanner(wave.title, wave.text, "#ff5c48");
    g.audio.play("alarm");
  }

  private dropAirdrop() {
    const g = this.game;
    this.nextAirdropAt = g.elapsed + randRange(55, 85);
    const a = g.rand() * Math.PI * 2;
    const d = randRange(320, 520);
    g.stream.addDynamic({ kind: "airdrop", x: g.player.x + Math.cos(a) * d, y: g.player.y + Math.sin(a) * d, radius: 54, lift: AIRDROP_LIFT, until: g.elapsed + 40 });
    g.pushFeed("Unclaimed airdrop falling nearby");
  }

  private summonCameo() {
    const g = this.game;
    this.nextCameoAt = g.elapsed + randRange(80, 115);
    const id: CameoId = this.cameoIndex >= CAMEO_ORDER.length && g.rand() < SATOSHI_CHANCE ? "satoshi" : CAMEO_ORDER[this.cameoIndex % CAMEO_ORDER.length]!;
    this.cameoIndex++;
    const a = g.rand() * Math.PI * 2;
    const d = randRange(420, 620);
    g.stream.addDynamic({ kind: "cameo", cameo: id, x: g.player.x + Math.cos(a) * d, y: g.player.y + Math.sin(a) * d, radius: 72, until: g.elapsed + 30 });
    g.noteCodex(`c:${id}`);
    const def = CAMEOS[id];
    g.queueBanner(`${def.name.toUpperCase()} ${def.handle}`, def.arrival, def.color);
    g.audio.play("sting");
  }

  private postFromFeed() {
    const g = this.game;
    this.nextPostAt = g.elapsed + randRange(30, 55);
    const def = CAMEOS[CAMEO_ORDER[Math.floor(g.rand() * CAMEO_ORDER.length)]!];
    g.pushFeed(`${def.handle}: ${def.posts[Math.floor(g.rand() * def.posts.length)]}`);
  }

  private updateItem(item: Interactable, dt: number) {
    const g = this.game;
    const p = g.player;
    if (item.until && g.elapsed >= item.until) {
      item.used = true;
      return;
    }
    if (item.lift) {
      item.lift = Math.max(0, item.lift - AIRDROP_FALL_PER_SEC * dt);
      if (item.lift === 0) {
        g.addTrauma(0.2);
        g.audio.play("thud");
      }
      return;
    }
    const near = dist(p.x, p.y, item.x, item.y) <= item.radius + p.radius && g.elapsed >= item.readyAt;
    if (item.kind === "lp-pool") {
      if (near && p.hp < p.maxHp && g.effects.healMult > 0) {
        const heal = Math.min(LP_HEAL_PER_SEC * dt, item.charge ?? 0);
        g.healPlayer(heal);
        item.charge = (item.charge ?? 0) - heal;
        if (item.charge <= 0) {
          item.used = true;
          g.addToast("Liquidity pool drained", "#2ee6c7");
        }
      }
      return;
    }
    if (!near) {
      item.progress = Math.max(0, item.progress - dt * 1.5);
      return;
    }
    item.progress += dt;
    if (item.progress < CHANNEL_SEC[item.kind]) return;
    item.progress = 0;
    this.trigger(item);
  }

  private trigger(item: Interactable) {
    const g = this.game;
    const p = g.player;
    switch (item.kind) {
      case "faucet": {
        item.readyAt = g.elapsed + FAUCET_COOLDOWN_SEC;
        for (let i = 0; i < 8; i++) g.spawnPickup(item.x + randRange(-46, 46), item.y + randRange(-34, 34), "coin", 1);
        g.addToast("Faucet dripped $SAFU", "#6cb6ff");
        g.audio.play("coin");
        break;
      }
      case "bridge-gate": {
        item.readyAt = g.elapsed + BRIDGE_COOLDOWN_SEC * (g.perks.wormhole > 0 ? 0.5 : 1);
        if (g.perks.wormhole > 0) g.healPlayer(25);
        p.x = item.destX ?? p.x;
        p.y = item.destY ?? p.y;
        p.px = p.x;
        p.py = p.y;
        p.invuln = Math.max(p.invuln, 1.2);
        g.impactFrames = 3;
        g.audio.play("glitch");
        g.burstParticles(p.x, p.y, "#b58cff", 24);
        g.addToast(`Bridged to ${biomeAt(p.x, p.y)}`, "#b58cff");
        break;
      }
      case "exploit-charge": {
        item.used = true;
        g.addStrike(item.x, item.y, CHARGE_BLAST_RADIUS, g.strikeDamage() * 1.4, "#ff5c48", CHARGE_FUSE_SEC);
        g.addToast("Charge armed: lure them in", "#ff5c48");
        g.audio.play("alarm");
        break;
      }
      case "bounty-board": {
        item.readyAt = g.elapsed + 1e9;
        g.showPopup("BOUNTY BOARD", [
          { id: "bounty-accept", title: "Post the bounty", description: "A whale wallet spawns nearby. Kill it for rare loot.", rarity: "rare", value: g.totalDps() * 0.3, apply: () => { item.used = true; g.postBounty(); return true; } },
          { id: "bounty-decline", title: "Not now", description: "The board stays here.", rarity: "common", value: 0, apply: () => { item.readyAt = g.elapsed + 8; return true; } },
        ]);
        break;
      }
      case "airdrop": {
        item.used = true;
        g.openChest("AIRDROP: PICK ONE", "uncommon", "#f4f3ee", item.x, item.y);
        break;
      }
      case "staking-pad": {
        item.readyAt = g.elapsed + PAD_COOLDOWN_SEC;
        g.applyPadBoost();
        break;
      }
      case "merge-contract": {
        item.readyAt = g.elapsed + 4;
        if (g.mergeOptions().length) g.showPopup("MERGE CONTRACT", g.mergeCards());
        else g.addToast(`Need two identical items. You hold: ${g.allGear().map(gearName).join(", ") || "nothing"}`, "#b58cff");
        break;
      }
      case "hardware-rack": {
        item.readyAt = g.elapsed + 5;
        g.showPopup(`HARDWARE RACK: ${SIDEKICKS[item.rig!].name.toUpperCase()}`, g.rigCards(item.rig!, item));
        break;
      }
      case "cameo": {
        item.used = true;
        this.offerDeal(item.cameo!);
        break;
      }
      default:
    }
  }

  private offerDeal(id: CameoId) {
    const def = CAMEOS[id];
    this.game.audio.play("jackpot");
    this.game.showPopup(`${def.name.toUpperCase()} ${def.handle}`, [
      { id: "deal-accept", title: "Take the deal", description: `"${def.arrival}" ${def.deal}`, rarity: id === "satoshi" ? "legendary" : "epic", value: this.game.totalDps() * 0.6, apply: () => { this.takeDeal(id); return true; } },
      { id: "deal-decline", title: "Walk away", description: "Take 15 $SAFU instead.", rarity: "common", value: 13, apply: () => { this.game.player.coins += 15; return true; } },
    ]);
  }

  private takeDeal(id: CameoId) {
    const g = this.game;
    const p = g.player;
    const def = CAMEOS[id];
    g.addToast(`Deal: ${def.name}`, def.color);
    g.emit("cameo", { cameo: id });
    g.audio.play("jackpot");
    if (id === "elon-tusk") {
      for (let i = 0; i < 16; i++) {
        const target = g.enemies[Math.floor(g.rand() * g.enemies.length)];
        const x = target ? target.x : p.x + randRange(-280, 280);
        const y = target ? target.y : p.y + randRange(-200, 200);
        g.addStrike(x, y, 110, g.strikeDamage(), "#7cc4ff", 0.5 + i * 0.3);
        if (i % 4 === 3) g.addHazard({ shape: "circle", x: p.x + randRange(-60, 60), y: p.y + randRange(-50, 50), r: 70, windup: 1 + i * 0.3, active: 0, damage: 18, color: "#7cc4ff", source: "boss-shill", knock: 120, label: "OOPS" });
      }
    } else if (id === "cz-four") {
      g.fundsLost = Math.max(0, g.fundsLost - 200_000_000);
      g.healPlayer(p.maxHp * 0.4);
      g.addToast("Next boss gets stronger: the attackers noticed", "#f0c14d");
      g.nextBossHpBonus = 1.25;
      p.invuln = Math.max(p.invuln, 3);
    } else if (id === "donald-pump") {
      for (let i = 0; i < 30; i++) g.spawnPickup(p.x + randRange(-170, 170), p.y + randRange(-120, 120), "coin", 2);
      this.delayedWave = { at: g.elapsed + 10, kind: "airdrop-farmer", count: 28 };
    } else if (id === "vitalik-butterin") {
      g.hardFork();
    } else if (id === "michael-sailor") {
      p.neverSellUntil = g.elapsed + 30;
    } else {
      g.offerGear({ id: rollGear("legendary"), tier: 0 });
    }
  }
}
