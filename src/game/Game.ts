import {
  BOSS_KINDS,
  BOSS_TIMES,
  COLORS,
  DASH,
  MAX_ENEMIES,
  PLAYER_RADIUS,
  WIN_TIME_SEC,
  WORLD,
} from "../constants";
import { getCharacter } from "../data/characters";
import { rollStarterCharacter } from "../pixel/portraits";
import { ENEMIES, HORDE_WEIGHTS } from "../data/enemies";
import { buildUpgradePool } from "../data/upgrades";
import { ENV_OBSTACLES } from "../data/environment";
import { rarityDamageMult } from "../data/rarity";
import { EVOLUTIONS, weaponAtLevel, WEAPONS } from "../data/weapons";
import type { Input } from "../engine/Input";
import { CutsceneEngine, type CutsceneId } from "../cutscene/CutsceneEngine";
import { MusicDirector } from "../audio/ChipSynth";
import { generateWorld } from "./worldGen";
import { CHESTS } from "../data/environment";
import { HashItem, SpatialHash } from "../physics/SpatialHash";
import { RunRecorder } from "../replay/RunRecorder";
import { DIFFICULTY, type DifficultyId } from "../data/difficulty";
import { BIOME_HORDE_BIAS, BIOME_LABEL, AREA_RULES } from "../data/biomeSpawns";
import { biomeAt } from "../data/environment";
import { rollChestLoot, type ChestLoot } from "../data/loot";
import { SIDEKICKS } from "../data/sidekicks";
import { TIMED_BUFFS, TIMED_BUFF_ORDER, type TimedBuffKind } from "../data/timedBuffs";
import { WELL_STATS, type WellStatId } from "../data/wells";
import { readViewport } from "../render/viewport";
import { groundHalfExtents } from "../render/view";
import type {
  CharacterId,
  Enemy,
  EnemyKind,
  GamePhase,
  Orbiter,
  Floater,
  Particle,
  Pickup,
  PlayerState,
  Projectile,
  RunStats,
  UpgradeContext,
  UpgradeDef,
  WeaponInstance,
  WeaponKind,
  WorldChest,
  WorldObstacle,
  SidekickState,
  WorldWell,
} from "../types";
import {
  angleBetween,
  clamp,
  dist,
  normalize,
  randRange,
  rectsOverlap,
  seedSim,
  shuffle,
  simRandom,
} from "../utils/math";

const PLAYER_HIT_RADIUS = 11;
const ENEMY_HIT_SCALE = 0.8;
const HUD_TICKS = 6;
const CUTSCENE_SKIP_HOLD_SEC = 1;
const CUTSCENE_TAP_MAX_SEC = 0.35;

let nextId = 1;
function uid(): number {
  return nextId++;
}

export type GameCallbacks = {
  onPhaseChange: (phase: GamePhase) => void;
  onLevelUpChoices: (choices: UpgradeDef[]) => void;
  onHudUpdate: (data: HudData) => void;
};

export type HudData = {
  hp: number;
  maxHp: number;
  xp: number;
  xpToNext: number;
  level: number;
  time: number;
  kills: number;
  weapons: { name: string; level: number; rarity: string }[];
  coins: number;
  biome: string;
  buffs: { label: string; remaining: number }[];
  sidekick: string | null;
};

export class Game {
  phase: GamePhase = "menu";
  selectedCharacter: CharacterId = "cz";
  menuHero: CharacterId = "cz";
  runDifficulty: DifficultyId = "normal";
  player!: PlayerState;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  orbiters: Orbiter[] = [];
  pickups: Pickup[] = [];
  particles: Particle[] = [];
  floaters: Floater[] = [];
  weapons: WeaponInstance[] = [];
  chests: WorldChest[] = [];
  wells: WorldWell[] = [];
  obstacles: WorldObstacle[] = [];
  sidekickEntity: SidekickState | null = null;
  stats: RunStats = { kills: 0, damageDealt: 0, timeSurvived: 0, bossesDefeated: 0 };

  readonly cutscene = new CutsceneEngine();

  camera = { x: 0, y: 0 };
  spawnTimer = 0;
  spawnRate = 0.85;
  elapsed = 0;
  bossesSpawned = 0;
  levelUpChoices: UpgradeDef[] = [];
  private upgradeCounts = new Map<string, number>();
  shake = 0;

  readonly recorder = new RunRecorder();
  private music = new MusicDirector();
  private spatial = new SpatialHash();
  private collisionScratch: HashItem[] = [];

  private maxHpBonus = 0;
  private pendingBossKind: EnemyKind | null = null;
  private victoryPending = false;
  private cutsceneHold = 0;
  private hudTick = 0;
  god = false;
  worldSeed = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private input: Input,
    private cb: GameCallbacks
  ) {}

  selectCharacter(id: CharacterId) {
    this.selectedCharacter = id;
  }

  rollMenuHero() {
    this.menuHero = rollStarterCharacter();
    this.selectedCharacter = this.menuHero;
  }

  requestStartRun(fromTitle = false) {
    if (!fromTitle) this.rollMenuHero();
    this.selectCharacter(this.menuHero);
    this.cutscene.setHero(this.menuHero);
    this.setPhase("cutscene");
    this.cutscene.play("intro", () => this.startRun());
  }

  startRun() {
    const ch = getCharacter(this.selectedCharacter);
    this.player = {
      id: uid(),
      characterId: ch.id,
      x: WORLD.width / 4,
      y: WORLD.height / 4,
      vx: 0,
      vy: 0,
      radius: PLAYER_RADIUS,
      dead: false,
      hp: ch.maxHp,
      maxHp: ch.maxHp,
      level: 1,
      xp: 0,
      xpToNext: 25,
      invuln: 0,
      dashCooldown: 0,
      dashTimer: 0,
      facing: 0,
      damageMult: ch.damageMult,
      xpMult: ch.xpMult,
      moveSpeed: ch.moveSpeed,
      pickupRadius: 72,
      armor: 0,
      cooldownMult: 1,
      yieldPerSec: 0,
      coins: 0,
      sidekick: null,
      activeBuffs: [],
      wellBonusArmor: 0,
    };
    this.enemies = [];
    this.projectiles = [];
    this.orbiters = [];
    this.pickups = [];
    this.particles = [];
    this.floaters = [];
    this.weapons = [{ kind: ch.startWeapon, level: 1, timer: 0, rarity: WEAPONS[ch.startWeapon].rarity }];
    this.stats = { kills: 0, damageDealt: 0, timeSurvived: 0, bossesDefeated: 0 };
    this.worldSeed = (Math.random() * 2 ** 31) | 0;
    seedSim(this.worldSeed);
    const world = generateWorld(this.worldSeed);
    this.chests = world.chests;
    this.obstacles = world.obstacles;
    this.wells = world.wells;
    this.sidekickEntity = null;
    this.pendingBossKind = null;
    this.victoryPending = false;
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.spawnRate = 0.85;
    this.bossesSpawned = 0;
    this.maxHpBonus = 0;
    this.upgradeCounts.clear();
    this.recorder.reset();
    this.setPhase("playing");
    this.input.focus();
    this.syncOrbiters();
  }

  setPhase(phase: GamePhase) {
    this.phase = phase;
    this.input.clearEdges();
    this.cutsceneHold = 0;
    if (phase === "menu" || phase === "won" || phase === "lost" || phase === "paused") this.music.stop();
    if (phase === "menu") this.rollMenuHero();
    if (phase === "playing") {
      this.music.start();
      this.music.resume();
    }
    if (phase === "cutscene") {
      this.music.resume();
    }
    this.cb.onPhaseChange(phase);
    this.pushHud();
  }

  togglePause() {
    if (this.phase === "playing") this.setPhase("paused");
    else if (this.phase === "paused") this.setPhase("playing");
  }

  autoPause() {
    if (this.phase === "playing") this.setPhase("paused");
  }

  get cutsceneSkipProgress(): number {
    return clamp(this.cutsceneHold / CUTSCENE_SKIP_HOLD_SEC, 0, 1);
  }

  pickUpgrade(index: number) {
    const up = this.levelUpChoices[index];
    if (!up || this.phase !== "levelup") return;
    const ctx = this.makeUpgradeContext();
    if (up.id === "hp-up") {
      this.maxHpBonus += 15;
      this.player.maxHp += 15;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 20);
    } else {
      up.apply(ctx);
    }
    this.upgradeCounts.set(up.id, (this.upgradeCounts.get(up.id) ?? 0) + 1);
    this.syncOrbiters();
    this.setPhase("playing");
  }

  private makeUpgradeContext(): UpgradeContext {
    return {
      addWeapon: (kind, rarity) => {
        if (!this.weapons.find((w) => w.kind === kind)) {
          this.weapons.push({
            kind,
            level: 1,
            timer: 0,
            rarity: rarity ?? WEAPONS[kind].rarity,
          });
        }
      },
      upgradeWeapon: (kind) => {
        const w = this.weapons.find((x) => x.kind === kind);
        if (!w) return;
        if (w.level < WEAPONS[kind].maxLevel) w.level += 1;
        else w.evolved = true;
      },
      heal: (amount) => {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + amount);
      },
      boostStat: (stat, amount) => {
        if (stat === "damage") this.player.damageMult *= 1 + amount;
        if (stat === "speed") this.player.moveSpeed *= 1 + amount;
        if (stat === "pickup") this.player.pickupRadius *= 1 + amount;
        if (stat === "armor") this.player.armor = clamp(this.player.armor + amount, 0, 0.65);
        if (stat === "cooldown") this.player.cooldownMult *= 1 - amount;
        if (stat === "yield") this.player.yieldPerSec += 0.75 * amount;
      },
      hasWeapon: (kind) => this.weapons.some((w) => w.kind === kind),
      weaponLevel: (kind) => this.weapons.find((w) => w.kind === kind)?.level ?? 0,
      weaponEvolved: (kind) => !!this.weapons.find((w) => w.kind === kind)?.evolved,
    };
  }

  triggerLevelUp() {
    const ctx = this.makeUpgradeContext();
    const pool = buildUpgradePool(ctx).filter((u) => (this.upgradeCounts.get(u.id) ?? 0) < (u.maxTimes ?? 99));
    this.levelUpChoices = shuffle(pool).slice(0, 3);
    if (this.levelUpChoices.length === 0) {
      this.player.maxHp += 5;
      this.player.hp += 5;
      return;
    }
    this.setPhase("levelup");
    this.cb.onLevelUpChoices(this.levelUpChoices);
  }

  update(dt: number) {
    if (this.phase === "menu") {
      if (this.input.consumeConfirm()) this.requestStartRun(true);
      return;
    }

    if (this.phase === "cutscene") {
      this.updateCutsceneInput(dt);
      if (this.phase === "cutscene") this.cutscene.update(dt);
      return;
    }

    if (this.phase === "levelup") {
      const pick = this.input.consumeCardPick();
      if (pick !== null) this.pickUpgrade(pick);
      return;
    }

    if (this.phase === "won" || this.phase === "lost") {
      if (this.input.consumeRestart()) this.requestStartRun();
      return;
    }

    if (this.input.consumePause()) this.togglePause();
    if (this.phase === "paused") return;

    this.snapshotPositions();
    this.elapsed += dt;
    this.stats.timeSurvived = this.elapsed;

    if (this.victoryReady()) {
      this.victoryPending = true;
      this.setPhase("cutscene");
      this.cutscene.play("victory", () => this.setPhase("won"));
      return;
    }

    this.updatePlayer(dt);
    this.updateWells(dt);
    this.updateChests(dt);
    this.updateSidekick(dt);
    this.updateSpawner(dt);
    this.rebuildEnemySpatial();
    this.updateEnemies(dt);
    this.updateWeapons(dt);
    this.updateProjectiles(dt);
    this.updateOrbiters(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateYield(dt);
    this.music.updateRegion(biomeAt(this.player.x, this.player.y));
    const mv = this.input.moveVector();
    this.recorder.sample(this.elapsed, mv.x, mv.y, false);
    this.checkBossSchedule();
    this.updateCamera();
    if (++this.hudTick % HUD_TICKS === 0) this.pushHud();

    if (this.god) this.player.hp = this.player.maxHp;
    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.player.dead = true;
      this.setPhase("lost");
    }
  }

  private snapshotPositions() {
    const p = this.player;
    p.px = p.x;
    p.py = p.y;
    for (const e of this.enemies) {
      e.px = e.x;
      e.py = e.y;
    }
    for (const pr of this.projectiles) {
      pr.px = pr.x;
      pr.py = pr.y;
    }
    for (const pk of this.pickups) {
      pk.px = pk.x;
      pk.py = pk.y;
    }
  }

  private updateCutsceneInput(dt: number) {
    this.input.consumePause();
    if (this.input.advanceHeld) {
      this.cutsceneHold += dt;
      if (this.cutsceneHold >= CUTSCENE_SKIP_HOLD_SEC) this.cutscene.skip();
      return;
    }
    const tapped = this.cutsceneHold > 0 && this.cutsceneHold < CUTSCENE_TAP_MAX_SEC;
    this.cutsceneHold = 0;
    if (tapped) this.cutscene.advance();
  }

  private victoryReady(): boolean {
    if (this.victoryPending || this.elapsed < WIN_TIME_SEC) return false;
    if (this.pendingBossKind || this.bossesSpawned < BOSS_TIMES.length) return false;
    return !this.enemies.some((e) => !e.dead && ENEMIES[e.kind].isBoss);
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    this.pruneBuffs();
    if (p.invuln > 0) p.invuln -= dt;
    if (p.dashCooldown > 0) p.dashCooldown -= dt;

    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    } else {
      const mv = this.input.moveVector();
      const n = normalize(mv.x, mv.y);
      const spd = p.moveSpeed * this.buffMult("speed") * AREA_RULES[biomeAt(p.x, p.y)].speed;
      p.vx = n.x * spd;
      p.vy = n.y * spd;
      if (n.x !== 0 || n.y !== 0) p.facing = Math.atan2(n.y, n.x);
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (this.input.consumeDash() && p.dashCooldown <= 0) {
        const dashDir =
          n.x !== 0 || n.y !== 0
            ? n
            : normalize(Math.cos(p.facing), Math.sin(p.facing));
        p.vx = dashDir.x * p.moveSpeed * DASH.speedMult * this.buffMult("speed");
        p.vy = dashDir.y * p.moveSpeed * DASH.speedMult * this.buffMult("speed");
        p.dashTimer = DASH.duration;
        p.dashCooldown = getCharacter(p.characterId).dashCooldown;
        p.invuln = DASH.iframes;
        this.burstParticles(p.x, p.y, getCharacter(p.characterId).color, 8);
      }
    }

    p.x = clamp(p.x, p.radius, WORLD.width - p.radius);
    p.y = clamp(p.y, p.radius, WORLD.height - p.radius);
    this.applyObstacleEffects(p, dt);
  }

  private playerInObstacle(p: PlayerState, o: WorldObstacle): boolean {
    const hw = o.width / 2;
    const hh = o.height / 2;
    const cx = clamp(p.x, o.x - hw, o.x + hw);
    const cy = clamp(p.y, o.y - hh, o.y + hh);
    return dist(p.x, p.y, cx, cy) < p.radius;
  }

  private applyObstacleEffects(p: PlayerState, dt: number) {
    for (const o of this.obstacles) {
      if (!this.playerInObstacle(p, o)) continue;
      const def = ENV_OBSTACLES[o.kind];
      if (def.damagePerSec) {
        p.hp -= def.damagePerSec * dt * (1 - this.totalArmor());
      }
      if (def.blocks) this.pushOutOfObstacle(p, o);
      if (def.slowMult && p.dashTimer <= 0) {
        p.x -= p.vx * dt * (1 - def.slowMult);
        p.y -= p.vy * dt * (1 - def.slowMult);
      }
    }
  }

  private pushOutOfObstacle(p: PlayerState, o: WorldObstacle) {
    const hw = o.width / 2;
    const hh = o.height / 2;
    const cx = clamp(p.x, o.x - hw, o.x + hw);
    const cy = clamp(p.y, o.y - hh, o.y + hh);
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d = Math.hypot(dx, dy);
    if (d > 0) {
      p.x = cx + (dx / d) * p.radius;
      p.y = cy + (dy / d) * p.radius;
      return;
    }
    const left = p.x - (o.x - hw);
    const right = o.x + hw - p.x;
    const top = p.y - (o.y - hh);
    const bottom = o.y + hh - p.y;
    const nearest = Math.min(left, right, top, bottom);
    if (nearest === left) p.x = o.x - hw - p.radius;
    else if (nearest === right) p.x = o.x + hw + p.radius;
    else if (nearest === top) p.y = o.y - hh - p.radius;
    else p.y = o.y + hh + p.radius;
  }

  private pruneBuffs() {
    this.player.activeBuffs = this.player.activeBuffs.filter((b) => b.until > this.elapsed);
  }

  private buffMult(stat: "damage" | "speed" | "pickup"): number {
    let m = 1;
    for (const b of this.player.activeBuffs) {
      const def = TIMED_BUFFS[b.kind];
      if (def.stat === stat) m *= def.mult;
    }
    return m;
  }

  private totalArmor(): number {
    let a = this.player.armor + this.player.wellBonusArmor;
    for (const b of this.player.activeBuffs) {
      if (TIMED_BUFFS[b.kind].stat === "armor") a += b.kind === "slashing-ward" ? 0.16 : 0.22;
    }
    return clamp(a, 0, 0.82);
  }

  private applyTimedBuff(kind: TimedBuffKind) {
    const def = TIMED_BUFFS[kind];
    this.player.activeBuffs.push({ kind, until: this.elapsed + def.duration });
    this.burstParticles(this.player.x, this.player.y, def.color, 10);
  }

  private applyWellBonus(stat: WellStatId) {
    const def = WELL_STATS[stat];
    const ctx = this.makeUpgradeContext();
    if (stat === "maxHp") {
      this.player.maxHp += def.applyAmount;
      this.player.hp += def.applyAmount;
    } else if (stat === "armor") {
      this.player.wellBonusArmor += def.applyAmount;
    } else if (stat === "yield") {
      ctx.boostStat("yield", def.applyAmount);
    } else {
      ctx.boostStat(stat, def.applyAmount);
    }
  }

  private applyChestLoot(loot: ChestLoot) {
    const ctx = this.makeUpgradeContext();
    if (loot.type === "weapon") {
      if (ctx.hasWeapon(loot.kind)) ctx.upgradeWeapon(loot.kind);
      else ctx.addWeapon(loot.kind, loot.rarity);
      this.syncOrbiters();
      return;
    }
    if (loot.type === "stat") {
      if (loot.stat === "maxHp") {
        this.player.maxHp += loot.amount;
        this.player.hp += loot.amount;
      } else ctx.boostStat(loot.stat, loot.amount);
      return;
    }
    this.grantSidekick(loot.kind);
  }

  private grantSidekick(kind: import("../types").SidekickKind) {
    if (this.player.sidekick === kind) return;
    this.player.sidekick = kind;
    const def = SIDEKICKS[kind];
    this.sidekickEntity = {
      kind,
      x: this.player.x,
      y: this.player.y,
      angle: 0,
      attackTimer: 0,
    };
    this.ringParticle(this.player.x, this.player.y, def.orbit, def.color);
  }

  private updateWells(dt: number) {
    const p = this.player;
    for (const w of this.wells) {
      if (w.used) continue;
      const near = dist(p.x, p.y, w.x, w.y) <= w.radius + p.radius + 4;
      if (!near) {
        w.channelProgress = Math.max(0, w.channelProgress - dt * 1.2);
        continue;
      }
      w.channelProgress += dt;
      if (w.channelProgress < 1.35) continue;
      w.used = true;
      w.channelProgress = 0;
      this.applyWellBonus(w.stat);
      this.ringParticle(w.x, w.y, w.radius, "#58a6ff");
    }
  }

  private updateSidekick(dt: number) {
    const sk = this.sidekickEntity;
    if (!sk || !this.player.sidekick) return;
    const def = SIDEKICKS[sk.kind];
    const p = this.player;
    sk.angle += dt * 2.2;
    const lead = p.facing + Math.PI;
    const bob = Math.sin(sk.angle * 2) * 6;
    const tx = p.x + Math.cos(lead) * (def.orbit * 0.72) + Math.cos(sk.angle) * 10;
    const ty = p.y + Math.sin(lead) * (def.orbit * 0.72) + bob;
    sk.x = lerpVec(sk.x, tx, clamp(dt * 6, 0, 1));
    sk.y = lerpVec(sk.y, ty, clamp(dt * 6, 0, 1));

    for (const pk of this.pickups) {
      if (pk.dead || pk.kind !== "coin") continue;
      if (dist(sk.x, sk.y, pk.x, pk.y) < def.coinCollectRadius) pk.magnetized = true;
    }

    sk.attackTimer -= dt;
    if (sk.attackTimer > 0) return;
    let target: Enemy | undefined;
    let bestD = 320;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = dist(sk.x, sk.y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        target = e;
      }
    }
    if (!target) return;
    sk.attackTimer = def.attackCooldown;
    this.damageEnemy(target, def.damage * this.buffMult("damage"));
    this.burstParticles(target.x, target.y, def.color, 4);
  }

  private updateChests(dt: number) {
    const p = this.player;
    for (const c of this.chests) {
      if (c.opened) continue;
      const def = CHESTS[c.kind];
      const near = dist(p.x, p.y, c.x, c.y) <= c.radius + p.radius + 6;
      if (!near || p.coins < c.coinCost) {
        c.openProgress = Math.max(0, c.openProgress - dt * 1.5);
        continue;
      }
      c.openProgress += dt;
      if (c.openProgress < def.openTime) continue;
      c.opened = true;
      p.coins -= c.coinCost;
      const loot = rollChestLoot(def.minRarity, biomeAt(c.x, c.y));
      this.applyChestLoot(loot);
      this.burstParticles(c.x, c.y, def.color, 14);
    }
  }

  private weaponDamageScale(w: WeaponInstance, baseDamage: number): number {
    return baseDamage * this.player.damageMult * this.buffMult("damage") * rarityDamageMult(w.rarity);
  }

  private bossCutsceneFor(kind: EnemyKind): CutsceneId {
    if (kind === "boss-mev-king") return "boss-mev";
    if (kind === "boss-lazarus-414") return "boss-414";
    if (kind === "boss-phish-king") return "boss-phish";
    if (kind === "boss-oracle") return "boss-oracle";
    if (kind === "boss-apt38") return "boss-apt";
    return "boss-grand";
  }

  private diffMult() {
    return DIFFICULTY[this.runDifficulty];
  }

  private updateSpawner(dt: number) {
    this.spawnTimer -= dt;
    const ramp = 1 + this.elapsed / 120;
    const targetRate = Math.max(0.12, this.spawnRate / ramp / this.diffMult().spawnMult);

    if (this.spawnTimer <= 0 && this.enemies.length < MAX_ENEMIES) {
      this.spawnTimer = targetRate;
      const batch = Math.min(3, 1 + Math.floor(this.elapsed / 180));
      for (let i = 0; i < batch; i++) this.spawnHordeEnemy();
    }
  }

  private spawnHordeEnemy() {
    const p = this.player;
    const vp = readViewport(this.canvas);
    const { halfW, halfH } = groundHalfExtents(vp.width / vp.height);
    const angle = randRange(0, Math.PI * 2);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const edge = Math.min(halfW * 1.25 / Math.max(Math.abs(cos), 1e-3), halfH / Math.max(Math.abs(sin), 1e-3));
    const distSpawn = edge + randRange(70, 170);
    const kind = this.pickHordeKind();
    const def = ENEMIES[kind];
    const dm = this.diffMult();
    const scale = (1 + this.elapsed * 0.002) * dm.enemyHpMult;
    this.enemies.push({
      id: uid(),
      kind,
      x: clamp(p.x + cos * distSpawn, 40, WORLD.width - 40),
      y: clamp(p.y + sin * distSpawn, 40, WORLD.height - 40),
      vx: 0,
      vy: 0,
      radius: def.radius,
      dead: false,
      hp: def.hp * scale,
      maxHp: def.hp * scale,
      damage: def.damage * (1 + this.elapsed * 0.0015),
      speed: def.speed * (1 + this.elapsed * 0.0008) * dm.enemySpeedMult,
      contactCd: 0,
      flash: 0,
      wobble: randRange(0, Math.PI * 2),
    });
  }

  private pickHordeKind(): EnemyKind {
    const biome = biomeAt(this.player.x, this.player.y);
    const bias = BIOME_HORDE_BIAS[biome];
    const eligible = HORDE_WEIGHTS.filter((w) => this.elapsed >= w.minTime);
    const weighted = eligible.map((w) => ({
      kind: w.kind,
      weight: w.weight * (bias[w.kind] ?? 1),
    }));
    const total = weighted.reduce((s, w) => s + w.weight, 0);
    let r = simRandom() * total;
    for (const w of weighted) {
      r -= w.weight;
      if (r <= 0) return w.kind;
    }
    return "script-kiddie";
  }

  private checkBossSchedule() {
    if (this.pendingBossKind) return;
    if (this.bossesSpawned >= BOSS_TIMES.length) return;
    if (this.elapsed < BOSS_TIMES[this.bossesSpawned]!) return;
    const kind = BOSS_KINDS[this.bossesSpawned]! as EnemyKind;
    this.pendingBossKind = kind;
    this.bossesSpawned++;
    this.setPhase("cutscene");
    this.cutscene.play(this.bossCutsceneFor(kind), () => {
      if (!this.pendingBossKind) return;
      this.spawnBoss(this.pendingBossKind);
      this.pendingBossKind = null;
      this.shake = 0.5;
      this.setPhase("playing");
    });
  }

  private spawnBoss(kind: EnemyKind) {
    const p = this.player;
    const def = ENEMIES[kind];
    const dm = this.diffMult();
    const scale = (1 + this.bossesSpawned * 0.15) * dm.enemyHpMult;
    this.enemies.push({
      id: uid(),
      kind,
      x: clamp(p.x + 400, def.radius, WORLD.width - def.radius),
      y: p.y,
      vx: 0,
      vy: 0,
      radius: def.radius,
      dead: false,
      hp: def.hp * scale,
      maxHp: def.hp * scale,
      damage: def.damage * scale,
      speed: def.speed * dm.enemySpeedMult,
      contactCd: 0,
      flash: 0,
      wobble: 0,
    });
  }

  debugSetTime(seconds: number) {
    this.elapsed = seconds;
    this.bossesSpawned = BOSS_TIMES.filter((t) => t < seconds).length;
  }

  debugSpawnBoss(kind: EnemyKind) {
    this.spawnBoss(kind);
  }

  debugPlayCutscene(id: CutsceneId) {
    const back = this.phase;
    this.setPhase("cutscene");
    this.cutscene.play(id, () => this.setPhase(back === "menu" ? "menu" : "playing"));
  }

  private updateYield(dt: number) {
    if (this.player.yieldPerSec <= 0) return;
    this.player.xp += this.player.yieldPerSec * dt * this.player.xpMult;
    if (this.player.xp >= this.player.xpToNext) {
      this.player.xp -= this.player.xpToNext;
      this.player.level++;
      this.player.xpToNext = Math.floor(25 * Math.pow(1.12, this.player.level - 1));
      this.triggerLevelUp();
    }
  }

  private rebuildEnemySpatial() {
    this.spatial.clear();
    for (const e of this.enemies) {
      if (e.dead) continue;
      this.spatial.insert({ id: e.id, x: e.x, y: e.y, radius: e.radius });
    }
  }

  private updateEnemies(dt: number) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.wobble += dt * 3;
      if (e.flash > 0) e.flash -= dt;

      const ang = angleBetween(e.x, e.y, p.x, p.y);
      e.x += Math.cos(ang) * e.speed * dt;
      e.y += Math.sin(ang) * e.speed * dt;

      if (e.contactCd > 0) e.contactCd -= dt;
    }

    const nearby = this.spatial.query(p.x, p.y, p.radius + 52, this.collisionScratch);
    for (const item of nearby) {
      const e = this.enemies.find((x) => x.id === item.id);
      if (!e || e.dead) continue;
      const def = ENEMIES[e.kind];
      if (p.invuln > 0 || e.contactCd > 0) continue;
      if (!rectsOverlap(p.x, p.y, PLAYER_HIT_RADIUS, e.x, e.y, e.radius * ENEMY_HIT_SCALE)) continue;
      const dmg = e.damage * (1 - this.totalArmor()) * this.diffMult().playerDamageTakenMult * AREA_RULES[biomeAt(p.x, p.y)].damageTaken;
      p.hp -= dmg;
      p.invuln = 0.45;
      e.contactCd = def.contactCooldown ?? 0.5;
      this.shake = 0.25;
      this.burstParticles(p.x, p.y, COLORS.danger, 6);
    }

    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  private nearestEnemy(x: number, y: number, range: number): Enemy | undefined {
    let best: Enemy | undefined;
    let bestD = range;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = dist(x, y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private updateWeapons(dt: number) {
    const p = this.player;
    for (const w of this.weapons) {
      w.timer -= dt;
      const def = weaponAtLevel(w.kind, w.level);
      const cd = def.cooldown * p.cooldownMult;
      if (w.timer > 0) continue;
      w.timer = cd;

      if (def.orbit) continue;

      if (def.aoe && (w.kind === "bnb-whip" || w.kind === "memo-pulse" || w.kind === "flash-loan")) {
        const dmg = this.weaponDamageScale(w, def.damage);
        const radius = (def.aoe ?? def.range) * (w.evolved ? 1.35 : 1);
        this.aoeHit(p.x, p.y, radius, dmg, w.kind);
        this.ringParticle(p.x, p.y, radius, WEAPONS[w.kind].kind === "memo-pulse" ? COLORS.purple : COLORS.gold);
        if (w.evolved) {
          this.aoeHit(p.x, p.y, radius * 0.62, dmg * 0.7, w.kind);
          this.ringParticle(p.x, p.y, radius * 0.62, COLORS.gold);
        }
        continue;
      }

      if (w.kind === "alameda-burst" || w.kind === "nonce-shard") {
        const count = 3 + w.level + (w.evolved ? 4 : 0);
        const aim = this.nearestEnemy(p.x, p.y, def.range);
        for (let i = 0; i < count; i++) {
          const a = (Math.PI * 2 * i) / count + p.facing;
          this.spawnProjectile(p.x, p.y, Math.cos(a), Math.sin(a), def, w, w.evolved ? aim?.id : undefined);
        }
        continue;
      }

      const target = this.nearestEnemy(p.x, p.y, def.range);
      if (!target) continue;
      const ang = angleBetween(p.x, p.y, target.x, target.y);
      const spreads =
        w.evolved && (w.kind === "eth-beam" || w.kind === "bridge-bolt")
          ? [-0.16, 0, 0.16]
          : w.evolved && w.kind === "audit-dart"
            ? [-0.1, 0.1]
            : [0];
      for (const spread of spreads) {
        this.spawnProjectile(p.x, p.y, Math.cos(ang + spread), Math.sin(ang + spread), def, w, target.id);
      }
    }
  }

  private spawnProjectile(
    x: number,
    y: number,
    dx: number,
    dy: number,
    def: ReturnType<typeof weaponAtLevel>,
    w: WeaponInstance,
    targetId?: number
  ) {
    const kind = w.kind;
    const speed = def.projectileSpeed ?? 400;
    const colors: Record<string, string> = {
      "audit-dart": "#58a6ff",
      "eth-beam": "#627eea",
      "alameda-burst": "#79c0ff",
      "bridge-bolt": "#2ee6c7",
      "nonce-shard": "#f0c14d",
      "flash-loan": "#ffb020",
    };
    this.projectiles.push({
      id: uid(),
      x,
      y,
      vx: dx * speed,
      vy: dy * speed,
      radius: kind === "eth-beam" ? 6 : 5,
      dead: false,
      damage: this.weaponDamageScale(w, def.damage),
      life: def.range / speed + 0.5,
      pierce: def.pierce ?? 0,
      fromPlayer: true,
      color: colors[kind] ?? "#58a6ff",
      homing: kind === "audit-dart" && simRandom() < 0.3,
      targetId,
    });
  }

  private aoeHit(x: number, y: number, radius: number, damage: number, _kind: WeaponKind) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (dist(x, y, e.x, e.y) < radius + e.radius) {
        this.damageEnemy(e, damage);
      }
    }
  }

  private updateProjectiles(dt: number) {
    for (const pr of this.projectiles) {
      if (pr.dead) continue;
      pr.life -= dt;
      if (pr.life <= 0) pr.dead = true;

      if (pr.homing && pr.targetId) {
        const t = this.enemies.find((e) => e.id === pr.targetId && !e.dead);
        if (t) {
          const ang = angleBetween(pr.x, pr.y, t.x, t.y);
          const spd = Math.hypot(pr.vx, pr.vy);
          pr.vx = lerpVec(pr.vx, Math.cos(ang) * spd, 0.08);
          pr.vy = lerpVec(pr.vy, Math.sin(ang) * spd, 0.08);
        }
      }

      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      if (pr.fromPlayer) {
        const nearby = this.spatial.query(pr.x, pr.y, pr.radius + 32, this.collisionScratch);
        for (const item of nearby) {
          const e = this.enemies.find((x) => x.id === item.id);
          if (!e || e.dead) continue;
          if (!rectsOverlap(pr.x, pr.y, pr.radius, e.x, e.y, e.radius)) continue;
          this.damageEnemy(e, pr.damage);
          this.stats.damageDealt += pr.damage;
          if (pr.pierce <= 0) {
            pr.dead = true;
            break;
          }
          pr.pierce--;
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  private syncOrbiters() {
    this.orbiters = [];
    const p = this.player;
    if (!p) return;
    let idx = 0;
    for (const w of this.weapons) {
      const def = WEAPONS[w.kind];
      if (!def.orbit) continue;
      const count = 1 + Math.floor(w.level / 2) + (w.evolved ? 2 : 0);
      for (let i = 0; i < count; i++) {
        this.orbiters.push({
          id: uid(),
          x: p.x,
          y: p.y,
          vx: 0,
          vy: 0,
          radius: w.kind === "stable-shield" ? 12 : 10,
          dead: false,
          angle: (Math.PI * 2 * idx) / (count * 2),
          dist: weaponAtLevel(w.kind, w.level).range * 0.55,
          damage: weaponAtLevel(w.kind, w.level).damage * p.damageMult * rarityDamageMult(w.rarity),
          weaponKind: w.kind,
        });
        idx++;
      }
    }
  }

  private updateOrbiters(dt: number) {
    const p = this.player;
    for (const o of this.orbiters) {
      o.angle += dt * (2.2 + (o.weaponKind === "rug-coin" ? 0.8 : 0));
      o.x = p.x + Math.cos(o.angle) * o.dist;
      o.y = p.y + Math.sin(o.angle) * o.dist;

      for (const e of this.enemies) {
        if (e.dead) continue;
        if (rectsOverlap(o.x, o.y, o.radius, e.x, e.y, e.radius)) {
          this.damageEnemy(e, o.damage * dt * 3.5);
        }
      }
    }
  }

  private damageEnemy(e: Enemy, damage: number) {
    const dealt = Math.max(1, Math.round(damage));
    e.hp -= dealt;
    e.flash = 0.08;
    if (this.floaters.length < 48) {
      this.floaters.push({
        x: e.x + randRange(-8, 8),
        y: e.y - e.radius,
        vy: -36,
        life: 0.55,
        maxLife: 0.55,
        text: String(dealt),
        color: e.flash ? "#fff6d8" : "#ffe08a",
      });
    }
    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      this.onEnemyKilled(e);
    }
  }

  private onEnemyKilled(e: Enemy) {
    const def = ENEMIES[e.kind];
    this.stats.kills++;
    if (def.isBoss) this.stats.bossesDefeated++;
    this.burstParticles(e.x, e.y, def.color, def.isBoss ? 25 : 8);
    const area = AREA_RULES[biomeAt(e.x, e.y)];
    const xpVal = def.xp * this.player.xpMult * area.xp;
    this.spawnPickup(e.x, e.y, "xp", xpVal);
    const coinChance = def.isBoss ? 1 : 0.38;
    if (simRandom() < coinChance) {
      const coins = (def.isBoss ? randRange(10, 18) : randRange(1, 3)) * area.coin;
      this.spawnPickup(e.x + randRange(-12, 12), e.y + randRange(-8, 8), "coin", Math.round(coins));
    }
    if (simRandom() < (def.isBoss ? 0.55 : 0.07)) {
      const kind = TIMED_BUFF_ORDER[Math.floor(simRandom() * TIMED_BUFF_ORDER.length)]!;
      this.spawnBuffPickup(e.x, e.y, kind);
    }
    if (simRandom() < (def.isBoss ? 1 : 0.04)) {
      this.spawnPickup(e.x + randRange(-20, 20), e.y, "health", 25);
    }
  }

  private spawnBuffPickup(x: number, y: number, kind: TimedBuffKind) {
    this.pickups.push({
      id: uid(),
      x,
      y,
      vx: 0,
      vy: 0,
      radius: 11,
      dead: false,
      kind: "buff",
      value: 1,
      magnetized: false,
      buffKind: kind,
    });
  }

  private spawnPickup(x: number, y: number, kind: Pickup["kind"], value: number) {
    this.pickups.push({
      id: uid(),
      x,
      y,
      vx: 0,
      vy: 0,
      radius: kind === "xp" ? 8 : kind === "coin" ? 9 : 10,
      dead: false,
      kind,
      value,
      magnetized: false,
    });
  }

  private updatePickups(dt: number) {
    const p = this.player;
    const pickupReach = p.pickupRadius * this.buffMult("pickup");
    for (const pk of this.pickups) {
      if (pk.dead) continue;
      const d = dist(p.x, p.y, pk.x, pk.y);
      if (d < pickupReach) pk.magnetized = true;
      if (pk.magnetized) {
        const ang = angleBetween(pk.x, pk.y, p.x, p.y);
        const pull = clamp(180 + (pickupReach - d) * 4, 180, 520);
        pk.x += Math.cos(ang) * pull * dt;
        pk.y += Math.sin(ang) * pull * dt;
      }
      if (d < p.radius + pk.radius) {
        pk.dead = true;
        if (pk.kind === "xp") this.gainXp(pk.value);
        if (pk.kind === "health") p.hp = Math.min(p.maxHp, p.hp + pk.value);
        if (pk.kind === "coin") p.coins += pk.value;
        if (pk.kind === "buff" && pk.buffKind) this.applyTimedBuff(pk.buffKind);
      }
    }
    this.pickups = this.pickups.filter((x) => !x.dead);
  }

  private gainXp(amount: number) {
    this.player.xp += amount;
    if (this.phase !== "playing") return;
    if (this.player.xp >= this.player.xpToNext) {
      this.player.xp -= this.player.xpToNext;
      this.player.level++;
      this.player.xpToNext = Math.floor(25 * Math.pow(1.12, this.player.level - 1));
      this.triggerLevelUp();
    }
  }

  private updateParticles(dt: number) {
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 40 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floaters) {
      f.life -= dt;
      f.y += f.vy * dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    if (this.shake > 0) this.shake -= dt;
  }

  private burstParticles(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = randRange(0, Math.PI * 2);
      const s = randRange(40, 160);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: randRange(0.25, 0.6),
        maxLife: 0.6,
        color,
        size: randRange(2, 5),
      });
    }
  }

  private ringParticle(x: number, y: number, radius: number, color: string) {
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI * 2 * i) / 16;
      this.particles.push({
        x: x + Math.cos(a) * radius,
        y: y + Math.sin(a) * radius,
        vx: Math.cos(a) * 60,
        vy: Math.sin(a) * 60,
        life: 0.35,
        maxLife: 0.35,
        color,
        size: 4,
      });
    }
  }

  private updateCamera() {
    const p = this.player;
    const vp = readViewport(this.canvas);
    const w = vp.width;
    const h = vp.height;
    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * 16 * this.shake : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * 16 * this.shake : 0;
    const maxX = Math.max(0, WORLD.width - w);
    const maxY = Math.max(0, WORLD.height - h);
    this.camera.x = clamp(p.x - w / 2 + shakeX, 0, maxX);
    this.camera.y = clamp(p.y - h / 2 + shakeY, 0, maxY);
  }

  private pushHud() {
    if (!this.player) return;
    const p = this.player;
    const biome = BIOME_LABEL[biomeAt(p.x, p.y)];
    this.cb.onHudUpdate({
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      xp: this.player.xp,
      xpToNext: this.player.xpToNext,
      level: this.player.level,
      time: this.elapsed,
      kills: this.stats.kills,
      weapons: this.weapons.map((w) => ({
        name: w.evolved ? EVOLUTIONS[w.kind].name : WEAPONS[w.kind].name,
        level: w.level,
        rarity: w.rarity,
      })),
      coins: p.coins,
      biome: `${biome.name} · ${AREA_RULES[biomeAt(p.x, p.y)].rule}`,
      buffs: p.activeBuffs.map((b) => ({
        label: TIMED_BUFFS[b.kind].emoji + " " + TIMED_BUFFS[b.kind].name,
        remaining: Math.max(0, b.until - this.elapsed),
      })),
      sidekick: p.sidekick ? SIDEKICKS[p.sidekick].name : null,
    });
  }
}

function lerpVec(current: number, target: number, t: number): number {
  return current + (target - current) * t;
}
