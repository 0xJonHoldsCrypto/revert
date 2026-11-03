import { bossTimeAt } from "../constants";
import { ENEMIES } from "../data/enemies";
import { rollGold } from "../data/loot";
import type { Enemy } from "../types";
import type { Game } from "./Game";

export type MiniEventId = "domino-defaults" | "mempool-surge" | "airdrop-rain" | "congestion" | "whale-hunt";

export type MiniEventDef = {
  id: MiniEventId;
  name: string;
  text: string;
  color: string;
  duration: number;
  minTime: number;
};

export const MINI_EVENTS: Record<MiniEventId, MiniEventDef> = {
  "domino-defaults": { id: "domino-defaults", name: "DOMINO DEFAULTS", text: "For 12 seconds every kill detonates. Chain them.", color: "#ff8552", duration: 12, minTime: 0 },
  "mempool-surge": { id: "mempool-surge", name: "MEMPOOL SURGE", text: "Twice the attackers for 18 seconds, and XP is worth 60% more.", color: "#b58cff", duration: 18, minTime: 0 },
  "airdrop-rain": { id: "airdrop-rain", name: "AIRDROP RAIN", text: "Crates are falling. Dodge the shadows, grab what lands.", color: "#ffc23d", duration: 10, minTime: 0 },
  congestion: { id: "congestion", name: "NETWORK CONGESTION", text: "Blocks are full. Everyone moves 35% slower for 10 seconds.", color: "#8fd6ff", duration: 10, minTime: 0 },
  "whale-hunt": { id: "whale-hunt", name: "WHALE HUNT", text: "Two whales surfaced. Take one down in 30 seconds for a fat purse.", color: "#ffc23d", duration: 30, minTime: 150 },
};

export const MINI_EVENT_ORDER: MiniEventId[] = ["domino-defaults", "mempool-surge", "airdrop-rain", "congestion", "whale-hunt"];

export const FIRST_EVENT_SEC = 80;
const EVENT_GAP_MIN_SEC = 70;
const EVENT_GAP_SPREAD_SEC = 40;
const BOSS_CLEARANCE_SEC = 25;
const RETRY_SEC = 8;
const SURGE_SPAWN_MULT = 2;
const SURGE_XP_MULT = 1.6;
const CONGESTION_MULT = 0.65;
const DOMINO_RADIUS = 75;
const DOMINO_MAX_STRIKES = 40;
const RAIN_EVERY_SEC = 0.5;
const RAIN_FUSE_SEC = 1.1;
const RAIN_RADIUS = 46;
const RAIN_REACH = 300;
const HUNT_WHALES = 2;

type Drop = { x: number; y: number; at: number };

export class MiniEvents {
  nextAt = FIRST_EVENT_SEC;
  active: MiniEventId | null = null;
  until = 0;
  last: MiniEventId | null = null;
  fired: MiniEventId[] = [];
  private rainTimer = 0;
  private drops: Drop[] = [];
  private huntIds: number[] = [];
  private huntPaid = false;

  constructor(private game: Game) {}

  get def(): MiniEventDef | null {
    return this.active ? MINI_EVENTS[this.active] : null;
  }

  get remaining(): number {
    return this.active ? Math.max(0, this.until - this.game.elapsed) : 0;
  }

  is(id: MiniEventId): boolean {
    return this.active === id;
  }

  spawnMult(): number {
    return this.active === "mempool-surge" ? SURGE_SPAWN_MULT : 1;
  }

  xpMult(): number {
    return this.active === "mempool-surge" ? SURGE_XP_MULT : 1;
  }

  speedMult(): number {
    return this.active === "congestion" ? CONGESTION_MULT : 1;
  }

  update(dt: number, bossAlive: boolean, bossesSpawned: number) {
    const g = this.game;
    if (this.active && g.elapsed >= this.until) this.finish();
    if (this.active === "airdrop-rain") this.rain(dt);
    if (this.drops.length) this.land();
    if (this.active || g.elapsed < this.nextAt) return;
    if (bossAlive || bossTimeAt(bossesSpawned) - g.elapsed < BOSS_CLEARANCE_SEC) {
      this.nextAt = g.elapsed + RETRY_SEC;
      return;
    }
    this.start(this.pick());
  }

  private pick(): MiniEventId {
    const g = this.game;
    const options = MINI_EVENT_ORDER.filter((id) => id !== this.last && g.elapsed >= MINI_EVENTS[id].minTime);
    return options[Math.floor(g.rand() * options.length)]!;
  }

  start(id: MiniEventId) {
    const g = this.game;
    const def = MINI_EVENTS[id];
    this.active = id;
    this.last = id;
    this.fired.push(id);
    this.until = g.elapsed + def.duration;
    this.nextAt = this.until + EVENT_GAP_MIN_SEC + g.rand() * EVENT_GAP_SPREAD_SEC;
    this.rainTimer = 0;
    this.huntPaid = false;
    g.noteCodex(`ev:${id}`);
    g.emit("event");
    g.queueBanner(def.name, def.text, def.color);
    g.pushFeed(`Event: ${def.name.toLowerCase()}`);
    g.audio.play("alarm");
    if (id === "whale-hunt") this.surfaceWhales();
  }

  private finish() {
    const g = this.game;
    if (this.active === "whale-hunt" && !this.huntPaid) g.addToast("The whales got away with it", "#ff5c48");
    this.active = null;
    this.huntIds = [];
  }

  private surfaceWhales() {
    const g = this.game;
    this.huntIds = [];
    for (let i = 0; i < HUNT_WHALES; i++) {
      const e = g.spawnHuntWhale();
      this.huntIds.push(e.id);
    }
  }

  private rain(dt: number) {
    const g = this.game;
    this.rainTimer -= dt;
    if (this.rainTimer > 0) return;
    this.rainTimer = RAIN_EVERY_SEC;
    const p = g.player;
    const a = g.rand() * Math.PI * 2;
    const r = 60 + g.rand() * RAIN_REACH;
    const x = p.x + Math.cos(a) * r;
    const y = p.y + Math.sin(a) * r;
    g.addHazard({ shape: "circle", x, y, r: RAIN_RADIUS, windup: RAIN_FUSE_SEC, active: 0, damage: 14, color: "#ffc23d", source: "airdrop-farmer", knock: 160, label: "CRATE" });
    this.drops.push({ x, y, at: g.elapsed + RAIN_FUSE_SEC });
  }

  private land() {
    const g = this.game;
    let kept = 0;
    for (const drop of this.drops) {
      if (g.elapsed < drop.at) {
        this.drops[kept++] = drop;
        continue;
      }
      const coin = g.rand() < 0.3;
      g.spawnPickup(drop.x, drop.y, coin ? "coin" : "xp", coin ? 3 : Math.max(4, g.player.xpToNext * 0.04));
    }
    this.drops.length = kept;
  }

  onKill(e: Enemy) {
    const g = this.game;
    if (this.active === "domino-defaults" && !ENEMIES[e.kind].isBoss && g.strikes.length < DOMINO_MAX_STRIKES) {
      g.addStrike(e.x, e.y, DOMINO_RADIUS, g.strikeDamage() * 0.22, "#ff8552", 0.12);
    }
    if (this.active === "whale-hunt" && !this.huntPaid && this.huntIds.includes(e.id)) {
      this.huntPaid = true;
      g.spawnPickup(e.x, e.y, "coin", rollGold("epic"));
      g.spawnPickup(e.x, e.y, "xp", g.player.xpToNext * 0.5);
      g.healPlayer(20);
      g.addToast("WHALE HUNT PAID OUT", "#ffc23d");
    }
  }
}
