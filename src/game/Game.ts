import {
  bossKindAt,
  bossTierAt,
  bossTimeAt,
  COLORS,
  DASH,
  MAX_ENEMIES,
  PLAYER_RADIUS,
  SECOND_WALLET_TIME_SEC,
} from "../constants";
import { CHARACTERS, getCharacter } from "../data/characters";
import { ENEMIES, HORDE_WEIGHTS } from "../data/enemies";
import { buildUpgradePool, MAX_WEAPON_SLOTS } from "../data/upgrades";
import { ENV_OBSTACLES } from "../data/environment";
import { rarityDamageMult } from "../data/rarity";
import { EVOLUTIONS, weaponAtLevel, WEAPONS } from "../data/weapons";
import type { Input } from "../engine/Input";
import { CutsceneEngine, type CutsceneId } from "../cutscene/CutsceneEngine";
import { AudioEngine } from "../audio/AudioEngine";
import type { MusicTrackId } from "../audio/music";
import { WorldStream } from "./worldGen";
import { WorldEvents } from "./interact";
import { ABILITIES, type AbilityId } from "../data/abilities";
import { describeGear, gearDef, GEAR, RARITY_ORDER, SLOT_LABEL, type GearId, type GearStats } from "../data/gear";
import { CHESTS } from "../data/environment";
import { HashItem, SpatialHash } from "../physics/SpatialHash";
import { RunRecorder } from "../replay/RunRecorder";
import { DIFFICULTY, type DifficultyId } from "../data/difficulty";
import { BIOME_HORDE_BIAS, BIOME_LABEL, AREA_RULES } from "../data/biomeSpawns";
import { biomeAt, setBiomeSeed } from "../data/environment";
import { rollChestLoot, rollGold, type ChestLoot } from "../data/loot";
import { SIDEKICKS } from "../data/sidekicks";
import { TIMED_BUFFS, TIMED_BUFF_ORDER, type TimedBuffKind } from "../data/timedBuffs";
import { WELL_STATS, type WellStatId } from "../data/wells";
import { readViewport } from "../render/viewport";
import { gasCloud, isHiddenFromWeapons, THREAT_INTEL, updateEnemyBehavior, updateHazards } from "./threats";
import { BOSS_ENTRANCES, BOSS_TIMELINE, LANDING_TIMELINE, type Cinematic } from "./cinematic";
import { groundHalfExtents } from "../render/view";
import type {
  CharacterId,
  Enemy,
  EnemyKind,
  GamePhase,
  Orbiter,
  Floater,
  Corpse,
  Hazard,
  Shockwave,
  Particle,
  Pickup,
  PlayerState,
  Projectile,
  RunStats,
  UpgradeContext,
  UpgradeDef,
  WeaponInstance,
  WeaponKind,
  SidekickState,
  WorldObstacle,
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

export const FUNDS_TOTAL = 3_840_000_000;
const AMBIENT_DRAIN_PER_SEC = 400_000;
const BOSS_DRAIN_PER_SEC = 500_000;
const HIT_FUNDS_LOSS = 250_000;
const BLOCK_START = 21_000_000;
const BLOCK_SECONDS = 12;
const KILL_FEED: Partial<Record<EnemyKind, string>> = {
  "script-kiddie": "reverted · copy-paste error",
  "phishing-bot": "approval revoked",
  "mev-searcher": "bundle dropped",
  "bridge-drainer": "bridge message rejected",
  "rug-dev": "liquidity locked",
  "oracle-manipulator": "price feed corrected",
  "sim-swapper": "2FA restored",
  insider: "access revoked",
  "shadow-op": "session terminated",
  sybil: "wallets clustered",
  liquidator: "position closed",
  "wash-trader": "volume flagged",
  "pump-bot": "group chat banned",
};
const ALIVE_CURVE: [number, number][] = [[0, 14], [45, 36], [120, 75], [240, 135], [420, 210], [720, 320], [1200, 420], [2400, 500]];
const ELITE_MIN_TIME = 55;
const ELITE_CHANCE = 0.02;
const MAX_WHALES = 3;
const RECYCLE_DISTANCE = 1500;
const BOSS_LEASH_DISTANCE = 1100;
const PICKUP_CULL_DISTANCE = 2400;
const ARMOR_CAP = 0.7;
const CHEST_COST_GROWTH = 0.3;
const BEST_KEY = "best";
const MAX_DRAINERS = 5;
const MAX_SHOOTERS = 14;
const PLAYER_HIT_RADIUS = 11;
const ENEMY_HIT_SCALE = 0.8;
const HUD_TICKS = 6;
const AOE_COLOR: Partial<Record<WeaponKind, string>> = { "reorg-whip": "#ffd166", "memo-pulse": "#b58cff", "flash-loan": "#ffb020" };
const DASH_BUFFER_SEC = 0.1;
const SEPARATION_STRENGTH = 42;
const KNOCKBACK = 170;
const KNOCKBACK_DECAY = 9;
const MAX_PARTICLES = 420;
const CUTSCENE_SKIP_HOLD_SEC = 1;

const PREF_KEY = "revert.prefs.v1";
const COARSE_POINTER = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
const TUTORIAL: [number, string][] = [
  [0.5, COARSE_POINTER ? "gm. can you even move? drag anywhere, responder." : "gm. can you even move? WASD, responder."],
  [6, COARSE_POINTER ? "cute. tap DASH. you'll need it." : "cute. SPACE dashes. you'll need it."],
  [13, "your tools fire on their own. grab the blue shards."],
  [24, "see the meter? that's $3.84B leaving. thx for the liquidity."],
  [36, "chests cost $SAFU. stand in the ring. i'd never trick you."],
];

function loadPrefs(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function loadPref(key: string): string | undefined {
  return loadPrefs()[key];
}

function savePref(key: string, value: string) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify({ ...loadPrefs(), [key]: value }));
  } catch {
    return;
  }
}

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
  weapons: { name: string; level: number; rarity: string; jammed: boolean }[];
  funds: number;
  fundsPct: number;
  block: number;
  gas: boolean;
  lie: boolean;
  swapped: boolean;
  feed: string[];
  banner: { title: string; text: string; until: number; tone: string } | null;
  signers: number;
  leverage: number;
  flash: string | null;
  coins: number;
  biome: string;
  buffs: { label: string; remaining: number }[];
  sidekick: string | null;
  nextBoss: number;
  gear: { slot: string; name: string | null; rarity: string }[];
  ability: { name: string; remaining: number; color: string } | null;
  toasts: { text: string; color: string; until: number }[];
  shielded: boolean;
  neverSell: boolean;
};

export class Game {
  phase: GamePhase = "menu";
  selectedCharacter: CharacterId = "keel";
  attract = false;
  rerolls = 2;
  runDifficulty: DifficultyId = "normal";
  player!: PlayerState;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  orbiters: Orbiter[] = [];
  pickups: Pickup[] = [];
  particles: Particle[] = [];
  floaters: Floater[] = [];
  weapons: WeaponInstance[] = [];
  stream = new WorldStream(0);
  private events = new WorldEvents(this);
  strikes: { at: number; x: number; y: number; r: number; damage: number; color: string }[] = [];
  choiceMode: "levelup" | "popup" = "levelup";
  popupTitle = "";
  windowActive = true;
  toasts: { text: string; color: string; until: number }[] = [];
  private attractClock = 0;
  private popupHoldUntil = 0;
  private popupQueue: { title: string; cards: UpgradeDef[] }[] = [];
  private gearStats: GearStats = {};
  private chestsOpened = 0;
  private secondWalletDone = false;
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
  readonly audio = new AudioEngine();
  private spatial = new SpatialHash();
  private enemyById = new Map<number, Enemy>();
  private simTick = 0;
  private dashBuffer = 0;
  private dying = 0;
  cinematic: Cinematic | null = null;
  shockwaves: Shockwave[] = [];
  corpses: Corpse[] = [];
  hazards: Hazard[] = [];
  fundsLost = 0;
  fundsRecovered = 0;
  drainersStopped = 0;
  priceLieTimer = 0;
  swapTimer = 0;
  gasUntil = 0;
  feed: string[] = [];
  banner: { title: string; text: string; until: number; tone: string } | null = null;
  signers = 0;
  timeline: { block: number; text: string }[] = [];
  rootCause: EnemyKind | "hazard" | "insolvent" | null = null;
  weaponDamage = new Map<string, number>();
  private tutorialStep = 0;
  private tutorialDone = loadPref("tutorial") === "done";
  private nextGasAt = 150;
  private seenKinds = new Set<EnemyKind>();
  private bannerQueue: { title: string; text: string; tone: string }[] = [];
  private lastFeedAt = -1;
  private leverage = 0;
  private flashUntil = 0;
  private flashKills = 0;
  private flashDebtUntil = 0;
  private yieldSlashedUntil = 0;
  private signerRegenAt = 0;
  private swapCooldownUntil = 0;
  private pathLog: { x: number; y: number }[] = [];
  private pathTimer = 0;
  private reorgAt = 0;
  hitstop = 0;
  impactFrames = 0;
  hurtPulse = 0;
  cameraFocus: { x: number; y: number; weight: number } | null = null;
  private collisionScratch: HashItem[] = [];

  private maxHpBonus = 0;
  private cutsceneHold = 0;
  private hudTick = 0;
  god = false;
  worldSeed = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private input: Input,
    private cb: GameCallbacks
  ) {
    this.cutscene.setAudio(this.audio);
    this.audio.setMusic("title");
    const hero = loadPref("hero");
    if (CHARACTERS.some((c) => c.id === hero)) this.selectedCharacter = hero as CharacterId;
    const difficulty = loadPref("difficulty");
    if (difficulty && difficulty in DIFFICULTY) this.runDifficulty = difficulty as DifficultyId;
  }

  get chests() {
    return this.stream.chests;
  }

  get wells() {
    return this.stream.wells;
  }

  get obstacles() {
    return this.stream.obstacles;
  }

  get interactables() {
    return this.stream.interactables;
  }

  get landmarks() {
    return this.stream.landmarks;
  }

  selectCharacter(id: CharacterId) {
    this.selectedCharacter = id;
  }

  chooseHero(id: CharacterId) {
    this.selectCharacter(id);
    if (this.attract && this.player) this.player.characterId = id;
    savePref("hero", id);
  }

  chooseDifficulty(id: DifficultyId) {
    this.runDifficulty = id;
    savePref("difficulty", id);
  }

  requestStartRun(fromTitle = false) {
    this.attract = false;
    this.audio.silenced = false;
    this.audio.unlock();
    this.audio.play("cardSelect");
    if (fromTitle) {
      this.setPhase("cutscene");
      this.cutscene.play("intro", () => this.startRun());
    } else {
      this.startRun();
    }
  }

  startRun() {
    this.attract = false;
    this.audio.silenced = false;
    this.resetRun();
    this.stream.update(this.player.x, this.player.y);
    this.tutorialStep = this.tutorialDone ? TUTORIAL.length : 0;
    this.beginLanding();
  }

  beginAttract() {
    this.attract = true;
    this.audio.silenced = true;
    this.resetRun();
    this.elapsed = 300;
    this.nextGasAt = Infinity;
    this.attractClock = 0;
    this.player.x = 150;
    this.player.y = 0;
    this.player.damageMult = 1.6;
    const ctx = this.makeUpgradeContext();
    (["finality-beam", "stable-shield", "memo-pulse"] as WeaponKind[]).forEach((k) => ctx.addWeapon(k));
    this.weapons.forEach((w) => (w.level = 4));
    this.syncOrbiters();
    this.spawnBoss("boss-phish-king");
    const boss = this.enemies[this.enemies.length - 1]!;
    boss.x = this.player.x + 345;
    boss.y = this.player.y + 30;
    boss.hp = boss.maxHp = 1e9;
    boss.speed = 0;
    for (let i = 0; i < 40; i++) this.spawnHordeEnemy();
    this.seenKinds.clear();
    this.banner = null;
    this.bannerQueue = [];
  }

  private moveAttractHero(dt: number) {
    const p = this.player;
    this.attractClock += dt * 0.4;
    const x = Math.cos(this.attractClock) * 150;
    const y = Math.sin(this.attractClock * 1.3) * 90;
    p.vx = (x - p.x) / dt;
    p.vy = (y - p.y) / dt;
    if (p.vx !== 0 || p.vy !== 0) p.facing = Math.atan2(p.vy, p.vx);
    p.x = x;
    p.y = y;
  }

  private updateAttract(dt: number) {
    this.snapshotPositions();
    this.player.invuln = 9;
    this.player.hp = this.player.maxHp;
    this.hazards = [];
    this.moveAttractHero(dt);
    this.updateSpawner(dt);
    this.rebuildEnemySpatial();
    this.updateEnemies(dt);
    this.updateWeapons(dt);
    this.updateProjectiles(dt);
    this.updateOrbiters(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.shake = 0;
    this.impactFrames = 0;
  }

  private resetRun() {
    const ch = getCharacter(this.selectedCharacter);
    this.player = {
      id: uid(),
      characterId: ch.id,
      x: 0,
      y: 0,
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
      gear: {},
      ability: null,
      abilityReadyAt: 0,
      shieldUntil: 0,
      neverSellUntil: 0,
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
    setBiomeSeed(this.worldSeed);
    this.stream = new WorldStream(this.worldSeed);
    this.events = new WorldEvents(this);
    this.strikes = [];
    this.choiceMode = "levelup";
    this.popupQueue = [];
    this.popupHoldUntil = 0;
    this.toasts = [];
    this.gearStats = {};
    this.chestsOpened = 0;
    this.secondWalletDone = false;
    this.sidekickEntity = null;
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.spawnRate = 0.85;
    this.bossesSpawned = 0;
    this.maxHpBonus = 0;
    this.upgradeCounts.clear();
    this.recorder.reset();
    this.shockwaves = [];
    this.corpses = [];
    this.hazards = [];
    this.fundsLost = 0;
    this.fundsRecovered = 0;
    this.drainersStopped = 0;
    this.priceLieTimer = 0;
    this.swapTimer = 0;
    this.gasUntil = 0;
    this.nextGasAt = 150;
    this.feed = [];
    this.banner = null;
    this.bannerQueue = [];
    this.seenKinds.clear();
    this.lastFeedAt = -1;
    this.signers = 0;
    this.leverage = 0;
    this.flashUntil = 0;
    this.flashDebtUntil = 0;
    this.yieldSlashedUntil = 0;
    this.swapCooldownUntil = 0;
    this.timeline = [{ block: BLOCK_START, text: "Responder on-chain. Outflow already live." }];
    this.rootCause = null;
    this.weaponDamage.clear();
    this.pathLog = [];
    this.pathTimer = 0;
    this.reorgAt = 0;
    this.hitstop = 0;
    this.impactFrames = 0;
    this.hurtPulse = 0;
    this.dying = 0;
    this.dashBuffer = 0;
    this.cameraFocus = null;
    this.rerolls = 2;
    this.input.focus();
    this.syncOrbiters();
  }

  setPhase(phase: GamePhase) {
    this.phase = phase;
    this.input.clearEdges();
    this.cutsceneHold = 0;
    if (phase === "menu") {
      this.audio.setMusic("title");
      this.beginAttract();
    }
    if (phase === "lost") this.audio.setMusic("gameOver", true);
    this.audio.duck(phase === "paused" || phase === "levelup");
    if (phase === "playing") this.syncMusic();
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
    if (this.choiceMode === "popup") {
      up.apply(this.makeUpgradeContext());
      this.choiceMode = "levelup";
      this.input.clearEdges();
      this.audio.play("cardSelect");
      this.setPhase("playing");
      return;
    }
    const ctx = this.makeUpgradeContext();
    if (up.id === "hp-up") {
      this.maxHpBonus += 15;
      this.player.maxHp += 15;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 20);
    } else {
      up.apply(ctx);
    }
    this.input.clearEdges();
    this.upgradeCounts.set(up.id, (this.upgradeCounts.get(up.id) ?? 0) + 1);
    this.audio.play(up.id.startsWith("upgrade-") && up.title.indexOf("·") < 0 ? "evolve" : "cardSelect");
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
      special: (id) => this.applySpecial(id),
      hasWeapon: (kind) => this.weapons.some((w) => w.kind === kind),
      weaponCount: () => this.weapons.length,
      weaponLevel: (kind) => this.weapons.find((w) => w.kind === kind)?.level ?? 0,
      weaponEvolved: (kind) => !!this.weapons.find((w) => w.kind === kind)?.evolved,
    };
  }

  private applySpecial(id: "leverage" | "flash-loan" | "multisig") {
    if (id === "leverage") this.leverage++;
    if (id === "flash-loan") {
      this.flashUntil = this.elapsed + 8;
      this.flashKills = this.stats.kills;
    }
    if (id === "multisig") {
      this.signers = 3;
      this.signerRegenAt = this.elapsed + 60;
    }
  }

  private rollChoices() {
    const ctx = this.makeUpgradeContext();
    const pool = buildUpgradePool(ctx).filter((u) => (this.upgradeCounts.get(u.id) ?? 0) < (u.maxTimes ?? 99));
    this.levelUpChoices = shuffle(pool).slice(0, 3);
  }

  rerollCards() {
    if (this.phase !== "levelup" || this.rerolls <= 0 || this.choiceMode !== "levelup") return;
    this.rerolls--;
    this.rollChoices();
    this.audio.play("ui");
    this.cb.onLevelUpChoices(this.levelUpChoices);
  }

  skipCards() {
    if (this.phase !== "levelup" || this.choiceMode !== "levelup") return;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 15);
    this.audio.play("ui");
    this.setPhase("playing");
  }

  triggerLevelUp() {
    if (this.attract) return;
    this.rollChoices();
    if (this.levelUpChoices.length === 0) {
      this.player.maxHp += 5;
      this.player.hp += 5;
      return;
    }
    this.audio.play("levelUp");
    this.setPhase("levelup");
    this.cb.onLevelUpChoices(this.levelUpChoices);
  }

  update(dt: number) {
    this.simTick++;
    if (this.impactFrames > 0) this.impactFrames--;
    if (this.hurtPulse > 0) this.hurtPulse = Math.max(0, this.hurtPulse - dt * 2.4);
    if (this.input.consumeMute()) this.audio.toggleMute();

    if (this.phase === "menu") {
      if (this.input.consumeConfirm()) {
        this.requestStartRun(true);
        return;
      }
      if (this.attract && this.player) this.updateAttract(dt);
      return;
    }

    if (this.phase === "cinematic") {
      this.updateCinematic(dt);
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
      else if (this.input.consumeRestart()) this.rerollCards();
      else if (this.input.keys.has("x")) this.skipCards();
      return;
    }

    if (this.phase === "lost") {
      if (this.input.consumeRestart()) {
        this.audio.play("ui");
        this.requestStartRun();
      }
      return;
    }

    if (this.dying <= 0 && this.input.consumePause()) this.togglePause();
    if (this.phase === "paused") return;

    if (this.hitstop > 0) {
      this.hitstop -= dt;
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.5);
      return;
    }

    if (this.dying > 0) {
      this.dying -= dt;
      if (this.dying <= 0) {
        this.setPhase("lost");
        return;
      }
      dt *= 0.18;
    }

    this.snapshotPositions();
    this.elapsed += dt;
    this.stats.timeSurvived = this.elapsed;

    if (!this.secondWalletDone && this.elapsed >= SECOND_WALLET_TIME_SEC) {
      this.secondWalletDone = true;
      this.setPhase("cutscene");
      this.cutscene.play("victory", () => {
        this.queueBanner("THE ATTACKER HAS A SECOND WALLET", "It never ends. How long can you hold?", "#ff5c48");
        this.setPhase("playing");
      });
      this.audio.play("txConfirmed");
      return;
    }

    if (this.popupQueue.length && this.elapsed >= this.popupHoldUntil) {
      this.openPopup(this.popupQueue.shift()!);
      return;
    }
    this.toasts = this.toasts.filter((t) => t.until > this.elapsed);

    if (this.stream.update(this.player.x, this.player.y)) this.seenStreamVersion();
    if (this.dying <= 0) {
      this.updatePlayer(dt);
      if (this.input.consumeAbility()) this.useAbility();
    }
    this.events.update(dt);
    this.updateStrikes();
    this.updateChain(dt);
    this.updateWells(dt);
    this.updateChests(dt);
    this.updateSidekick(dt);
    this.updateSpawner(dt);
    this.rebuildEnemySpatial();
    this.updateEnemies(dt);
    updateHazards(this, dt);
    if (this.dying <= 0) this.updateWeapons(dt);
    this.updateProjectiles(dt);
    this.updateOrbiters(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateYield(dt);
    this.syncMusic();
    const mv = this.input.moveVector();
    this.recorder.sample(this.elapsed, mv.x, mv.y, false);
    this.checkBossSchedule();
    this.updateCamera();
    if (++this.hudTick % HUD_TICKS === 0) this.pushHud();

    if (this.god) this.player.hp = this.player.maxHp;
    if (this.fundsLeft <= 0 && this.dying <= 0 && (this.runDifficulty === "hard" || this.runDifficulty === "nightmare")) {
      this.rootCause = "insolvent";
      this.player.hp = 0;
    }
    if (this.player.hp <= 0 && this.dying <= 0) {
      this.player.hp = 0;
      this.player.dead = true;
      this.player.invuln = 99;
      this.dying = 0.75;
      this.impactFrames = 6;
      this.addTrauma(0.9);
      this.audio.play("death");
      this.audio.setMusic(null, true);
      this.burstParticles(this.player.x, this.player.y, "#ff5d7a", 28);
    }
  }

  private seenStreamVersion() {
    this.pickups = this.pickups.filter((pk) => dist(pk.x, pk.y, this.player.x, this.player.y) < PICKUP_CULL_DISTANCE);
  }

  get nextBossIn(): number {
    return Math.max(0, bossTimeAt(this.bossesSpawned) - this.elapsed);
  }

  score(): number {
    return Math.floor(this.stats.timeSurvived * 10 + this.stats.kills + this.stats.bossesDefeated * 500 + this.fundsLeft / 1e6);
  }

  get fundsLeft(): number {
    return Math.max(0, FUNDS_TOTAL - this.fundsLost);
  }

  get blockHeight(): number {
    return BLOCK_START + Math.floor(this.elapsed / BLOCK_SECONDS);
  }

  get gasActive(): boolean {
    return this.elapsed < this.gasUntil;
  }

  gasEnemySpeedMult(): number {
    return this.gasActive ? 1.35 : 1;
  }

  nextEntityId(): number {
    return uid();
  }

  rand(): number {
    return simRandom();
  }

  fakeHash(): string {
    const hex = () => Math.floor(Math.random() * 65536).toString(16).padStart(4, "0");
    return `0x${hex()}…${hex().slice(0, 2)}`;
  }

  addFloater(x: number, y: number, text: string, color: string) {
    this.floaters.push({ x, y, vy: -30, life: 1.1, maxLife: 1.1, text, color, hits: 6 });
  }

  pushFeed(line: string) {
    this.feed.unshift(line);
    if (this.feed.length > 5) this.feed.length = 5;
  }

  private logEvent(text: string) {
    this.timeline.push({ block: this.blockHeight, text });
    this.pushFeed(text);
  }

  queueBanner(title: string, text: string, tone: string) {
    this.bannerQueue.push({ title, text, tone });
  }

  addHazard(h: Omit<Hazard, "t">) {
    this.hazards.push({ ...h, t: 0 });
  }

  findEnemy(id: number): Enemy | undefined {
    return this.enemyById.get(id);
  }

  spawnEnemyAt(kind: EnemyKind, x: number, y: number): Enemy {
    const def = ENEMIES[kind];
    const dm = this.diffMult();
    const minutes = this.elapsed / 60;
    const scale = (1 + minutes * 0.2 + minutes * minutes * 0.06) * dm.enemyHpMult;
    const enemy: Enemy = {
      id: uid(),
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      radius: def.radius,
      dead: false,
      hp: def.hp * scale,
      maxHp: def.hp * scale,
      damage: def.damage * (1 + minutes * 0.12),
      speed: def.speed * (1 + this.elapsed * 0.0005) * dm.enemySpeedMult,
      contactCd: 0,
      flash: 0,
      wobble: randRange(0, Math.PI * 2),
    };
    this.enemies.push(enemy);
    if (!this.seenKinds.has(kind) && THREAT_INTEL[kind]) {
      this.seenKinds.add(kind);
      this.queueBanner(`NEW THREAT · ${def.name.toUpperCase()}`, THREAT_INTEL[kind]!, def.color);
    }
    return enemy;
  }

  hurtPlayer(rawDamage: number, source: EnemyKind) {
    const p = this.player;
    if (p.invuln > 0 || this.dying > 0 || this.elapsed < p.shieldUntil) return;
    const dmg = rawDamage * (1 - this.totalArmor()) * this.diffMult().playerDamageTakenMult * AREA_RULES[biomeAt(p.x, p.y)].damageTaken;
    if (p.hp - dmg <= 0 && this.signers >= 2) {
      this.signers--;
      this.signerRegenAt = this.elapsed + 60;
      p.hp = 1;
      p.invuln = 1.5;
      this.impactFrames = 4;
      this.addTrauma(0.6);
      this.audio.play("txConfirmed");
      this.addFloater(p.x, p.y - 70, `TX BLOCKED · ${this.signers}/3 SIGNERS`, "#2ee6c7");
      return;
    }
    p.hp -= dmg;
    p.invuln = 0.45;
    this.rootCause = source;
    this.fundsLost += dmg * HIT_FUNDS_LOSS;
    this.yieldSlashedUntil = this.elapsed + 6;
    this.addTrauma(clamp(0.25 + (dmg / p.maxHp) * 2, 0.25, 0.7));
    this.hurtPulse = 1;
    this.hitstop = Math.max(this.hitstop, 0.04);
    this.audio.play("hurt");
    this.burstParticles(p.x, p.y, COLORS.danger, 10);
    if (this.leverage > 0 && p.hp / p.maxHp < 0.25) {
      this.leverage--;
      p.damageMult /= 1.12;
      this.audio.play("liquidation");
      this.addFloater(p.x, p.y - 70, "POSITION LIQUIDATED", "#ff5c48");
    }
    if (source === "sim-swapper" && this.elapsed > this.swapCooldownUntil) {
      this.swapTimer = 1.6;
      this.swapCooldownUntil = this.elapsed + 8;
      this.audio.play("glitch");
    }
  }

  knockPlayer(fromX: number, fromY: number, force: number) {
    const p = this.player;
    const n = normalize(p.x - fromX || 1, p.y - fromY);
    p.x += n.x * force * 0.22;
    p.y += n.y * force * 0.22;
  }

  beginReorg() {
    this.reorgAt = this.elapsed + 0.9;
    this.queueBanner("CHAIN REORG INCOMING", "Your last two seconds are about to be rewritten.", "#d05cff");
    this.audio.play("alarm");
  }

  private performReorg() {
    const p = this.player;
    const path = this.pathLog;
    const home = path[0];
    if (!home) return;
    this.impactFrames = 6;
    this.addTrauma(0.7);
    this.audio.play("glitch");
    p.x = home.x;
    p.y = home.y;
    p.px = home.x;
    p.py = home.y;
    p.invuln = Math.max(p.invuln, 0.5);
    path.forEach((step, i) => {
      if (i % 3 !== 2) return;
      this.addHazard({ shape: "circle", x: step.x, y: step.y, r: 44, windup: 0.7, active: 0, damage: 20, color: "#d05cff", source: "boss-grandmaster", knock: 0 });
    });
    this.logEvent("Block reorged by The Grandmaster");
  }

  private updateChain(dt: number) {
    const p = this.player;
    if (this.priceLieTimer > 0) this.priceLieTimer -= dt;
    if (this.swapTimer > 0) this.swapTimer -= dt;
    const bossAlive = this.enemies.some((e) => !e.dead && ENEMIES[e.kind].isBoss);
    this.fundsLost += (AMBIENT_DRAIN_PER_SEC + (bossAlive ? BOSS_DRAIN_PER_SEC : 0)) * dt;

    if (this.elapsed >= this.nextGasAt) {
      this.nextGasAt = this.elapsed + randRange(95, 150);
      this.gasUntil = this.elapsed + 8;
      this.audio.play("gasSpike");
      this.queueBanner("GAS SPIKE · 9,999 GWEI", "Attackers rush. Your cooldowns lag for 8 seconds.", "#ffc23d");
      this.pushFeed("Base fee spiked. Mempool congested.");
    }

    if (this.flashUntil > 0 && this.elapsed >= this.flashUntil) {
      this.flashUntil = 0;
      if (this.stats.kills - this.flashKills >= 15) {
        this.addFloater(p.x, p.y - 70, "FLASH LOAN REPAID", "#2ee6c7");
        this.audio.play("txConfirmed");
      } else {
        this.flashDebtUntil = this.elapsed + 10;
        this.addFloater(p.x, p.y - 70, "LOAN DEFAULT · COOLDOWNS UP", "#ff5c48");
        this.audio.play("liquidation");
      }
    }

    if (this.signers > 0 && this.signers < 3 && this.elapsed >= this.signerRegenAt) {
      this.signers++;
      this.signerRegenAt = this.elapsed + 60;
    }

    this.pathTimer -= dt;
    if (this.pathTimer <= 0) {
      this.pathTimer = 0.1;
      this.pathLog.push({ x: p.x, y: p.y });
      if (this.pathLog.length > 20) this.pathLog.shift();
    }
    if (this.reorgAt > 0 && this.elapsed >= this.reorgAt) {
      this.reorgAt = 0;
      this.performReorg();
    }

    if (this.tutorialStep < TUTORIAL.length && this.elapsed >= TUTORIAL[this.tutorialStep]![0]) {
      this.queueBanner("INBOUND TX · 0xdead…c0de", TUTORIAL[this.tutorialStep]![1], "#ff5c48");
      this.tutorialStep++;
      if (this.tutorialStep === TUTORIAL.length) {
        this.tutorialDone = true;
        savePref("tutorial", "done");
      }
    }
    if (this.banner && this.elapsed >= this.banner.until) this.banner = null;
    if (!this.banner && this.bannerQueue.length) {
      const next = this.bannerQueue.shift()!;
      this.banner = { ...next, until: this.elapsed + 3.4 };
      this.audio.play("ui");
    }
  }

  private weaponCooldownMult(): number {
    let m = this.player.cooldownMult * (1 - (this.gearStats.cooldown ?? 0));
    if (this.gasActive) m *= 1.25;
    if (this.elapsed < this.flashUntil) m *= 0.5;
    if (this.elapsed < this.flashDebtUntil) m *= 1.35;
    return m;
  }

  postMortem() {
    const p = this.player;
    const saved = this.fundsLeft;
    const cause = this.rootCause === "insolvent" ? "Protocol insolvent" : this.rootCause === "hazard" ? "Environment hazard" : this.rootCause ? ENEMIES[this.rootCause].name : "None";
    const damage = [...this.weaponDamage.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([kind, amount]) => ({ name: WEAPONS[kind as WeaponKind].name, amount }));
    return {
      incident: `RVT-${(this.worldSeed >>> 0).toString(16).slice(0, 6).toUpperCase()}`,
      block: this.blockHeight,
      saved,
      lost: Math.max(0, FUNDS_TOTAL - saved),
      savedPct: (saved / FUNDS_TOTAL) * 100,
      drainers: this.drainersStopped,
      cause,
      level: p.level,
      kills: this.stats.kills,
      bosses: this.stats.bossesDefeated,
      time: this.stats.timeSurvived,
      score: this.score(),
      best: this.recordBest(),
      timeline: this.timeline.slice(-8),
      damage: damage.slice(0, 6),
    };
  }

  private recordBest(): number {
    const best = Math.max(Number(loadPref(BEST_KEY) ?? 0), this.score());
    savePref(BEST_KEY, String(best));
    return best;
  }

  addTrauma(amount: number) {
    this.shake = Math.min(1, Math.max(this.shake, amount));
  }

  private syncMusic() {
    if (!this.player) return;
    const boss = this.enemies.some((e) => !e.dead && ENEMIES[e.kind].isBoss);
    const track: MusicTrackId = boss ? "boss" : biomeAt(this.player.x, this.player.y);
    this.audio.setMusic(track);
  }

  private beginLanding() {
    this.cinematic = { kind: "landing", t: 0, flash: 1, step: 0 };
    this.player.lift = 300;
    this.setPhase("cinematic");
  }

  private beginBossEntrance(kind: EnemyKind) {
    const p = this.player;
    this.spawnBoss(kind);
    this.logEvent(`${ENEMIES[kind].name} entered the mempool`);
    const boss = this.enemies[this.enemies.length - 1]!;
    boss.x = p.x + 300;
    boss.y = p.y - 60;
    boss.px = boss.x;
    boss.py = boss.y;
    boss.lift = 420;
    this.cinematic = { kind: "boss", t: 0, flash: 0, step: 0, bossId: boss.id, bossKind: kind };
    this.cameraFocus = { x: boss.x, y: boss.y, weight: 0 };
    this.setPhase("cinematic");
    this.audio.setMusic(null, true);
  }

  private endCinematic() {
    if (this.cinematic?.kind === "boss") this.shake = Math.max(this.shake, 0.1);
    this.cinematic = null;
    this.cameraFocus = null;
    if (this.player) this.player.lift = 0;
    this.setPhase("playing");
  }

  private updateCinematic(dt: number) {
    const c = this.cinematic;
    if (!c) {
      this.setPhase("playing");
      return;
    }
    this.updateParticles(dt);
    this.updateShockwaves(dt);
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }
    c.t += dt;
    this.updateCutsceneHold(dt, () => this.endCinematic());
    if (!this.cinematic) return;
    if (c.kind === "landing") this.updateLanding(c);
    else this.updateBossEntrance(c);
  }

  private updateLanding(c: Cinematic) {
    const T = LANDING_TIMELINE;
    const p = this.player;
    c.flash = Math.max(0, 1 - c.t / T.flashFade);
    if (c.t < T.drop) {
      const f = c.t / T.drop;
      p.lift = 300 * (1 - f * f);
      return;
    }
    p.lift = 0;
    if (c.step === 0) {
      c.step = 1;
      this.audio.play("thud");
      this.addTrauma(0.75);
      this.burstParticles(p.x, p.y, "#c8d4e8", 22);
      this.shockwaves.push({ x: p.x, y: p.y, radius: 95, life: 0.4, maxLife: 0.4, color: "#c8e8ff" });
    }
    if (c.step === 1 && c.t > T.skitter) {
      c.step = 2;
      this.audio.play("skitter");
    }
    if (c.t >= T.end) this.endCinematic();
  }

  private updateBossEntrance(c: Cinematic) {
    const T = BOSS_TIMELINE;
    const boss = this.enemies.find((e) => e.id === c.bossId);
    if (!boss) {
      this.endCinematic();
      return;
    }
    const focus = this.cameraFocus;
    if (focus) {
      if (c.t < T.taunt + T.tauntHold) focus.weight = Math.min(1, c.t / 0.5);
      else focus.weight = Math.max(0, 1 - (c.t - T.taunt - T.tauntHold) / T.barsOut);
    }
    if (c.t < T.drop) {
      boss.lift = 420;
    } else if (c.t < T.impact) {
      const f = (c.t - T.drop) / (T.impact - T.drop);
      boss.lift = 420 * (1 - f * f);
    } else {
      boss.lift = 0;
    }
    if (c.step === 0 && c.t >= T.impact) {
      c.step = 1;
      this.impactFrames = 8;
      this.hitstop = 0.1;
      this.addTrauma(0.85);
      this.audio.play("bossSpawn");
      this.audio.setMusic("boss", true);
      this.burstParticles(boss.x, boss.y, ENEMIES[boss.kind].color, 44);
      this.shockwaves.push({ x: boss.x, y: boss.y, radius: 300, life: 0.7, maxLife: 0.7, color: ENEMIES[boss.kind].color });
    }
    if (c.t >= T.taunt && c.t < T.taunt + T.tauntHold && this.simTick % 3 === 0) {
      const line = BOSS_ENTRANCES[boss.kind]?.line ?? "";
      if (Math.floor((c.t - T.taunt) * T.typeCps) < line.length) this.audio.play("blip");
    }
    if (c.t >= T.taunt + T.tauntHold + T.barsOut) this.endCinematic();
  }

  private updateCutsceneHold(dt: number, skip: () => void) {
    this.input.consumePause();
    if (this.input.advanceHeld) {
      this.cutsceneHold += dt;
      if (this.cutsceneHold >= CUTSCENE_SKIP_HOLD_SEC) skip();
    } else {
      this.cutsceneHold = 0;
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
    this.updateCutsceneHold(dt, () => this.cutscene.skip());
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
      const swap = this.swapTimer > 0 ? -1 : 1;
      const n = normalize(mv.x * swap, mv.y * swap);
      const spd = p.moveSpeed * this.buffMult("speed") * (1 + (this.gearStats.speed ?? 0)) * AREA_RULES[biomeAt(p.x, p.y)].speed;
      p.vx = n.x * spd;
      p.vy = n.y * spd;
      if (n.x !== 0 || n.y !== 0) p.facing = Math.atan2(n.y, n.x);
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (this.input.consumeDash()) this.dashBuffer = DASH_BUFFER_SEC;
      else if (this.dashBuffer > 0) this.dashBuffer -= dt;
      if (this.dashBuffer > 0 && p.dashCooldown <= 0 && this.elapsed >= p.neverSellUntil) {
        this.dashBuffer = 0;
        this.audio.play("dash");
        const dashDir =
          n.x !== 0 || n.y !== 0
            ? n
            : normalize(Math.cos(p.facing), Math.sin(p.facing));
        p.vx = dashDir.x * p.moveSpeed * DASH.speedMult * this.buffMult("speed");
        p.vy = dashDir.y * p.moveSpeed * DASH.speedMult * this.buffMult("speed");
        p.dashTimer = DASH.duration;
        p.dashCooldown = getCharacter(p.characterId).dashCooldown * (1 - (this.gearStats.dash ?? 0));
        p.invuln = DASH.iframes;
        this.burstParticles(p.x, p.y, getCharacter(p.characterId).color, 8);
      }
    }

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
        this.rootCause = "hazard";
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
    let a = this.player.armor + this.player.wellBonusArmor + (this.gearStats.armor ?? 0);
    if (this.elapsed < this.player.neverSellUntil) a += 0.3;
    for (const b of this.player.activeBuffs) {
      if (TIMED_BUFFS[b.kind].stat === "armor") a += b.kind === "slashing-ward" ? 0.16 : 0.22;
    }
    return clamp(a, 0, ARMOR_CAP);
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

  addStrike(x: number, y: number, r: number, damage: number, color: string, delay: number) {
    this.strikes.push({ at: this.elapsed + delay, x, y, r, damage, color });
  }

  strikeDamage(): number {
    return 70 * (1 + this.elapsed / 60 * 0.45) * this.player.damageMult * (1 + (this.gearStats.damage ?? 0));
  }

  private updateStrikes() {
    if (!this.strikes.length) return;
    for (const s of this.strikes) {
      if (this.elapsed < s.at) continue;
      s.at = Infinity;
      this.aoeHit(s.x, s.y, s.r, s.damage);
      this.shockwaves.push({ x: s.x, y: s.y, radius: s.r, life: 0.32, maxLife: 0.32, color: s.color });
      this.addTrauma(0.22);
      this.audio.play("pulse");
    }
    this.strikes = this.strikes.filter((s) => s.at !== Infinity);
  }

  private clearEnemyAttacks() {
    this.projectiles = this.projectiles.filter((pr) => pr.fromPlayer);
    this.hazards = [];
  }

  hardFork() {
    const w = this.weapons[Math.floor(this.rand() * this.weapons.length)];
    if (w) this.makeUpgradeContext().upgradeWeapon(w.kind);
    this.syncOrbiters();
    this.clearEnemyAttacks();
    this.impactFrames = 4;
  }

  private useAbility() {
    const p = this.player;
    if (!p.ability || this.elapsed < p.abilityReadyAt) return;
    const def = ABILITIES[p.ability];
    p.abilityReadyAt = this.elapsed + def.cooldown * this.weaponCooldownMult();
    this.addFloater(p.x, p.y - 70, def.name.toUpperCase(), def.color);
    this.audio.play("evolve");
    if (p.ability === "emergency-pause") {
      for (const e of this.enemies) if (!ENEMIES[e.kind].isBoss) e.frozenUntil = this.elapsed + 4;
      this.projectiles = this.projectiles.filter((pr) => pr.fromPlayer);
      this.impactFrames = 3;
    } else if (p.ability === "flash-crash") {
      this.addStrike(p.x, p.y, 460, this.strikeDamage() * 2.4, def.color, 0);
      this.impactFrames = 5;
    } else if (p.ability === "revoke-all") {
      this.clearEnemyAttacks();
      p.dashCooldown = 0;
      this.shockwaves.push({ x: p.x, y: p.y, radius: 500, life: 0.35, maxLife: 0.35, color: def.color });
    } else if (p.ability === "sandwich") {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        this.addStrike(p.x + Math.cos(a) * 340, p.y + Math.sin(a) * 340, 130, this.strikeDamage(), def.color, 0.05);
        this.addStrike(p.x + Math.cos(a + 0.26) * 190, p.y + Math.sin(a + 0.26) * 190, 120, this.strikeDamage(), def.color, 0.4);
      }
    } else {
      p.shieldUntil = this.elapsed + 5;
    }
  }

  grantAbility(id: AbilityId) {
    this.player.ability = id;
    this.player.abilityReadyAt = this.elapsed;
  }

  private recomputeGear() {
    const p = this.player;
    const before = this.gearStats.maxHp ?? 0;
    const sum: GearStats = {};
    for (const id of Object.values(p.gear)) {
      for (const [key, value] of Object.entries(gearDef(id).stats) as [keyof GearStats, number][]) {
        sum[key] = (sum[key] ?? 0) + value;
      }
    }
    this.gearStats = sum;
    const delta = (sum.maxHp ?? 0) - before;
    p.maxHp += delta;
    p.hp = clamp(p.hp + Math.max(0, delta), 1, p.maxHp);
    this.syncOrbiters();
  }

  offerGear(id: GearId) {
    const def = gearDef(id);
    const current = this.player.gear[def.slot];
    const sellFor = 6 * (RARITY_ORDER.indexOf(def.rarity) + 1);
    this.showPopup("LOOT. EQUIP OR SELL.", [
      {
        id: "gear-equip",
        title: `Equip ${def.name}`,
        description: `${describeGear(id)}. ${current ? `Replaces ${gearDef(current).name}.` : "Empty slot."} "${def.line}"`,
        rarity: def.rarity,
        apply: () => {
          this.player.gear[def.slot] = id;
          this.recomputeGear();
          return true;
        },
      },
      {
        id: "gear-sell",
        title: `Sell for ${sellFor} $SAFU`,
        description: current ? `Keep ${gearDef(current).name}: ${describeGear(current)}.` : "Dump it on the next guy.",
        rarity: "common",
        apply: () => {
          this.player.coins += sellFor;
          return true;
        },
      },
    ]);
  }

  showPopup(title: string, cards: UpgradeDef[]) {
    this.popupQueue.push({ title, cards });
  }

  private openPopup(popup: { title: string; cards: UpgradeDef[] }) {
    this.choiceMode = "popup";
    this.popupTitle = popup.title;
    this.levelUpChoices = popup.cards;
    this.audio.play("levelUp");
    this.setPhase("levelup");
    this.cb.onLevelUpChoices(popup.cards);
  }

  addToast(text: string, color: string) {
    this.toasts.push({ text, color, until: this.elapsed + 2.6 });
    if (this.toasts.length > 3) this.toasts.shift();
  }

  setWindowActive(active: boolean) {
    if (this.windowActive === active) return;
    this.windowActive = active;
    if (!active) this.autoPause();
    this.audio.setWindowActive(active);
  }

  grantLoot(loot: ChestLoot, title: string, color: string, x: number, y: number) {
    this.burstParticles(x, y, color, 14);
    const claim = (cardTitle: string, description: string, rarity: UpgradeDef["rarity"]) =>
      this.showPopup(title, [{ id: "loot-claim", title: cardTitle, description, rarity, apply: () => { this.applyChestLoot(loot); return true; } }]);
    if (loot.type === "gear") this.applyChestLoot(loot);
    else if (loot.type === "weapon") {
      const owned = this.weapons.some((w) => w.kind === loot.kind);
      claim(WEAPONS[loot.kind].name, owned ? `You already run this tool. It levels up. ${WEAPONS[loot.kind].description}` : WEAPONS[loot.kind].description, loot.rarity);
    } else if (loot.type === "ability") {
      const current = this.player.ability;
      claim(ABILITIES[loot.id].name, `Active ability. ${ABILITIES[loot.id].line} ${COARSE_POINTER ? "Tap its button." : "Press Q."}${current ? ` Replaces ${ABILITIES[current].name}.` : ""}`, "rare");
    } else if (loot.type === "sidekick") {
      claim(SIDEKICKS[loot.kind].name, "A sidekick joins you. It attacks on its own and collects $SAFU.", "rare");
    } else {
      this.applyChestLoot(loot);
      this.addToast(loot.type === "gold" ? `+${loot.amount} $SAFU` : `+${loot.stat === "maxHp" ? `${loot.amount} max HP` : `${Math.round(loot.amount * 100)}% ${loot.stat}`}`, color);
    }
  }

  private applyChestLoot(loot: ChestLoot) {
    const ctx = this.makeUpgradeContext();
    if (loot.type === "gear") {
      this.offerGear(loot.id);
      return;
    }
    if (loot.type === "ability") {
      this.grantAbility(loot.id);
      return;
    }
    if (loot.type === "gold") {
      for (let i = 0; i < 8; i++) this.spawnPickup(this.player.x + randRange(-90, 90), this.player.y + randRange(-70, 70), "coin", Math.ceil(loot.amount / 8));
      return;
    }
    if (loot.type === "weapon") {
      if (ctx.hasWeapon(loot.kind)) ctx.upgradeWeapon(loot.kind);
      else if (this.weapons.length < MAX_WEAPON_SLOTS) ctx.addWeapon(loot.kind, loot.rarity);
      else ctx.upgradeWeapon(this.weapons[Math.floor(simRandom() * this.weapons.length)]!.kind);
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
      this.audio.play("txConfirmed");
      this.applyWellBonus(w.stat);
      this.addToast(WELL_STATS[w.stat].title, "#6cb6ff");
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
      if (e.dead || isHiddenFromWeapons(e)) continue;
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
      const cost = this.chestCost(c.coinCost);
      if (!near || p.coins < cost) {
        c.openProgress = Math.max(0, c.openProgress - dt * 1.5);
        continue;
      }
      c.openProgress += dt;
      if (c.openProgress < def.openTime) continue;
      c.opened = true;
      p.coins -= cost;
      this.audio.play("jackpot");
      this.addTrauma(0.4);
      const loot: ChestLoot = this.chestsOpened === 0 ? { type: "gear", id: firstGear() } : rollChestLoot(def.minRarity, biomeAt(c.x, c.y));
      this.chestsOpened++;
      this.grantLoot(loot, `${def.name.toUpperCase()} UNLOCKED`, def.color, c.x, c.y);
    }
  }

  chestCost(base: number): number {
    return Math.ceil(base * (1 + this.chestsOpened * CHEST_COST_GROWTH));
  }

  private weaponDamageScale(w: WeaponInstance, baseDamage: number): number {
    const sailor = this.elapsed < this.player.neverSellUntil ? 1.3 : 1;
    return baseDamage * this.player.damageMult * this.buffMult("damage") * rarityDamageMult(w.rarity) * (1 + (this.gearStats.damage ?? 0)) * sailor;
  }

  private diffMult() {
    return DIFFICULTY[this.runDifficulty];
  }

  private aliveCeiling(): number {
    const t = this.elapsed;
    let from = ALIVE_CURVE[0]!;
    for (const point of ALIVE_CURVE) {
      if (t < point[0]) {
        const f = (t - from[0]) / (point[0] - from[0]);
        return (from[1] + (point[1] - from[1]) * f) * this.diffMult().spawnMult;
      }
      from = point;
    }
    return from[1] * this.diffMult().spawnMult;
  }

  private updateSpawner(dt: number) {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    const ceiling = Math.min(MAX_ENEMIES, this.aliveCeiling());
    if (this.enemies.length >= ceiling) {
      this.spawnTimer = 0.1;
      return;
    }
    const deficit = ceiling - this.enemies.length;
    this.spawnTimer = Math.max(0.1, 0.9 - this.elapsed / 400);
    const batch = Math.min(6, Math.ceil(deficit / 8));
    for (let i = 0; i < batch; i++) this.spawnHordeEnemy();
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
    const e = this.spawnEnemyAt(kind, p.x + cos * distSpawn, p.y + sin * distSpawn);
    if (!this.attract && this.elapsed > ELITE_MIN_TIME && kind !== "honeypot-mimic" && simRandom() < ELITE_CHANCE && this.enemies.filter((m) => m.elite).length < MAX_WHALES) this.makeWhale(e);
  }

  private ringPoint(extra = 0): { x: number; y: number } {
    const vp = readViewport(this.canvas);
    const { halfW, halfH } = groundHalfExtents(vp.width / vp.height);
    const a = randRange(0, Math.PI * 2);
    const edge = Math.min(halfW * 1.25 / Math.max(Math.abs(Math.cos(a)), 1e-3), halfH / Math.max(Math.abs(Math.sin(a)), 1e-3)) + 90 + extra;
    return { x: this.player.x + Math.cos(a) * edge, y: this.player.y + Math.sin(a) * edge };
  }

  spawnRing(kind: EnemyKind, count: number) {
    const room = Math.min(count, MAX_ENEMIES - this.enemies.length);
    const center = this.ringPoint();
    const a0 = Math.atan2(center.y - this.player.y, center.x - this.player.x);
    const reach = Math.hypot(center.x - this.player.x, center.y - this.player.y);
    for (let i = 0; i < room; i++) {
      const a = a0 + (i / Math.max(1, room)) * Math.PI * 2;
      this.spawnEnemyAt(kind, this.player.x + Math.cos(a) * reach, this.player.y + Math.sin(a) * reach);
    }
  }

  private makeWhale(e: Enemy) {
    e.elite = true;
    e.hp *= 7;
    e.maxHp *= 7;
    e.damage *= 1.4;
    e.scale = 1.5;
    e.radius *= 1.3;
  }

  postBounty() {
    const at = this.ringPoint(160);
    const kinds: EnemyKind[] = this.elapsed < 150 ? ["script-kiddie", "sim-swapper"] : ["shadow-op", "rug-dev", "liquidator"];
    const e = this.spawnEnemyAt(kinds[Math.floor(this.rand() * kinds.length)]!, at.x, at.y);
    this.makeWhale(e);
    e.bounty = true;
    e.hp *= 2;
    e.maxHp *= 2;
    this.queueBanner("BOUNTY POSTED", "A whale wallet is on the map. Follow the arrow, collect the reward.", "#ffc23d");
    this.audio.play("sting");
  }

  private pickHordeKind(): EnemyKind {
    const biome = biomeAt(this.player.x, this.player.y);
    const bias = BIOME_HORDE_BIAS[biome];
    const count = (kind: EnemyKind) => this.enemies.reduce((n, e) => (e.kind === kind ? n + 1 : n), 0);
    const drainers = count("bridge-drainer");
    const shooters = count("shadow-op") + count("oracle-manipulator");
    const eligible = HORDE_WEIGHTS.filter((w) => {
      if (this.elapsed < w.minTime) return false;
      if (w.kind === "bridge-drainer" && drainers >= MAX_DRAINERS) return false;
      if ((w.kind === "shadow-op" || w.kind === "oracle-manipulator") && shooters >= MAX_SHOOTERS) return false;
      return true;
    });
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
    if (this.elapsed < bossTimeAt(this.bossesSpawned)) return;
    const kind: EnemyKind = bossKindAt(this.bossesSpawned);
    this.bossesSpawned++;
    this.beginBossEntrance(kind);
  }

  private spawnBoss(kind: EnemyKind) {
    const p = this.player;
    const def = ENEMIES[kind];
    const dm = this.diffMult();
    const index = Math.max(0, this.bossesSpawned - 1);
    const scale = (1 + index * 0.12) * Math.pow(2, bossTierAt(index)) * dm.enemyHpMult;
    this.enemies.push({
      id: uid(),
      kind,
      x: p.x + 400,
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
    this.bossesSpawned = 0;
    while (bossTimeAt(this.bossesSpawned) < seconds) this.bossesSpawned++;
  }

  debugSpawnBoss(kind: EnemyKind) {
    this.beginBossEntrance(kind);
  }

  debugPlayCutscene(id: CutsceneId) {
    const back = this.phase;
    this.setPhase("cutscene");
    this.cutscene.play(id, () => this.setPhase(back === "playing" ? "playing" : "menu"));
  }

  private updateYield(dt: number) {
    const perSec = this.player.yieldPerSec + (this.gearStats.yield ?? 0) * 0.75;
    if (perSec <= 0 || this.elapsed < this.yieldSlashedUntil) return;
    this.player.xp += perSec * dt * this.player.xpMult;
    if (this.player.xp >= this.player.xpToNext) {
      this.player.xp -= this.player.xpToNext;
      this.player.level++;
      this.player.xpToNext = Math.floor(25 * Math.pow(1.14, this.player.level - 1));
      this.triggerLevelUp();
    }
  }

  private rebuildEnemySpatial() {
    this.spatial.clear();
    this.enemyById.clear();
    for (const e of this.enemies) {
      if (e.dead) continue;
      this.spatial.insert({ id: e.id, x: e.x, y: e.y, radius: e.radius });
      this.enemyById.set(e.id, e);
    }
  }

  private updateEnemies(dt: number) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.wobble += dt * 3;
      if (e.flash > 0) e.flash -= dt;

      if ((e.id + this.simTick) % 30 === 0) this.recycleIfFar(e);
      if (this.elapsed >= (e.frozenUntil ?? 0)) updateEnemyBehavior(this, e, dt);
      if (e.kx || e.ky) {
        e.x += (e.kx ?? 0) * dt;
        e.y += (e.ky ?? 0) * dt;
        const decay = Math.exp(-KNOCKBACK_DECAY * dt);
        e.kx = (e.kx ?? 0) * decay;
        e.ky = (e.ky ?? 0) * decay;
        if (Math.abs(e.kx) < 2 && Math.abs(e.ky) < 2) {
          e.kx = 0;
          e.ky = 0;
        }
      }
      if ((e.id + this.simTick) % 2 === 0) this.separate(e, dt);

      if (e.contactCd > 0) e.contactCd -= dt;
    }

    const nearby = this.spatial.query(p.x, p.y, p.radius + 52, this.collisionScratch);
    for (const item of nearby) {
      const e = this.enemyById.get(item.id);
      if (!e || e.dead) continue;
      const def = ENEMIES[e.kind];
      if (p.invuln > 0 || e.contactCd > 0 || isHiddenFromWeapons(e) || this.elapsed < (e.frozenUntil ?? 0)) continue;
      if (!rectsOverlap(p.x, p.y, PLAYER_HIT_RADIUS, e.x, e.y, e.radius * ENEMY_HIT_SCALE)) continue;
      e.contactCd = def.contactCooldown ?? 0.5;
      this.hurtPlayer(e.damage, e.kind);
    }

    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  private recycleIfFar(e: Enemy) {
    if (e.bounty || e.kind === "honeypot-mimic") return;
    const isBoss = ENEMIES[e.kind].isBoss;
    if (dist(e.x, e.y, this.player.x, this.player.y) < (isBoss ? BOSS_LEASH_DISTANCE : RECYCLE_DISTANCE)) return;
    const at = this.ringPoint();
    e.x = at.x;
    e.y = at.y;
    e.px = at.x;
    e.py = at.y;
    e.charge = undefined;
  }

  private separate(e: Enemy, dt: number) {
    const nearby = this.spatial.query(e.x, e.y, e.radius + 24, this.collisionScratch);
    let pushX = 0;
    let pushY = 0;
    for (const other of nearby) {
      if (other.id === e.id) continue;
      const dx = e.x - other.x;
      const dy = e.y - other.y;
      const minD = (e.radius + other.radius) * 0.8;
      const d2 = dx * dx + dy * dy;
      if (d2 >= minD * minD) continue;
      if (d2 < 0.01) {
        pushX += (e.id % 7) - 3;
        pushY += (e.id % 5) - 2;
        continue;
      }
      const d = Math.sqrt(d2);
      const force = 1 - d / minD;
      pushX += (dx / d) * force;
      pushY += (dy / d) * force;
    }
    const scale = (ENEMIES[e.kind].isBoss ? 0.1 : 1) * SEPARATION_STRENGTH * 2 * dt;
    e.x += pushX * scale;
    e.y += pushY * scale;
  }

  private nearestEnemy(x: number, y: number, range: number): Enemy | undefined {
    let best: Enemy | undefined;
    let bestD = range;
    for (const e of this.enemies) {
      if (e.dead || isHiddenFromWeapons(e)) continue;
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
    const cooldownMult = this.weaponCooldownMult();
    for (const w of this.weapons) {
      if (w.jammed) continue;
      w.timer -= dt;
      const def = weaponAtLevel(w.kind, w.level);
      const cd = def.cooldown * cooldownMult;
      if (w.timer > 0) continue;
      w.timer = cd;

      if (def.orbit) continue;

      if (def.aoe && (w.kind === "reorg-whip" || w.kind === "memo-pulse" || w.kind === "flash-loan")) {
        const dmg = this.weaponDamageScale(w, def.damage);
        const radius = (def.aoe ?? def.range) * (w.evolved ? 1.35 : 1);
        this.aoeHit(p.x, p.y, radius, dmg, w.kind);
        const color = AOE_COLOR[w.kind] ?? COLORS.gold;
        const arc = w.kind === "reorg-whip" ? p.facing : undefined;
        this.shockwaves.push({ x: p.x, y: p.y, radius, life: 0.28, maxLife: 0.28, color, arc });
        this.audio.play("pulse");
        if (w.evolved) {
          this.aoeHit(p.x, p.y, radius * 0.62, dmg * 0.7, w.kind);
          this.shockwaves.push({ x: p.x, y: p.y, radius: radius * 0.62, life: 0.22, maxLife: 0.22, color, arc: arc === undefined ? undefined : arc + Math.PI });
        }
        continue;
      }

      if (w.kind === "patch-burst" || w.kind === "nonce-shard") {
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
        w.evolved && (w.kind === "finality-beam" || w.kind === "bridge-bolt")
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
      "finality-beam": "#627eea",
      "patch-burst": "#79c0ff",
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
      radius: kind === "finality-beam" ? 6 : 5,
      dead: false,
      damage: this.weaponDamageScale(w, def.damage),
      life: def.range / speed + 0.5,
      pierce: def.pierce ?? 0,
      fromPlayer: true,
      weaponKind: kind,
      color: colors[kind] ?? "#58a6ff",
      homing: kind === "audit-dart" && simRandom() < 0.3,
      targetId,
    });
  }

  private aoeHit(x: number, y: number, radius: number, damage: number, _kind?: WeaponKind) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (dist(x, y, e.x, e.y) < radius + e.radius) {
        this.damageEnemy(e, damage, e.x - x, e.y - y, _kind);
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

      if (!pr.fromPlayer) {
        const p = this.player;
        if (rectsOverlap(pr.x, pr.y, pr.radius, p.x, p.y, PLAYER_HIT_RADIUS)) {
          pr.dead = true;
          if (pr.source) this.hurtPlayer(pr.damage, pr.source);
        }
      }

      if (pr.fromPlayer) {
        const nearby = this.spatial.query(pr.x, pr.y, pr.radius + 44, this.collisionScratch);
        for (const item of nearby) {
          const e = this.enemyById.get(item.id);
          if (!e || e.dead || isHiddenFromWeapons(e)) continue;
          if (pr.hitIds?.includes(e.id)) continue;
          if (!rectsOverlap(pr.x, pr.y, pr.radius, e.x, e.y, e.radius)) continue;
          (pr.hitIds ??= []).push(e.id);
          this.damageEnemy(e, pr.damage, pr.vx, pr.vy, pr.weaponKind);
          this.burstParticles(pr.x, pr.y, pr.color, 3);
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
          damage: weaponAtLevel(w.kind, w.level).damage * p.damageMult * rarityDamageMult(w.rarity) * (1 + (this.gearStats.damage ?? 0)),
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
      if (o.weaponKind === "rug-coin") {
        if (this.elapsed < (o.offUntil ?? 0)) continue;
        if (simRandom() < 0.035 * dt) {
          o.offUntil = this.elapsed + 6;
          this.addFloater(o.x, o.y - 26, "RUGGED", "#f778ba");
          this.audio.play("rugPull");
          continue;
        }
      }
      if (this.weapons.find((w) => w.kind === o.weaponKind)?.jammed) continue;

      for (const e of this.enemies) {
        if (e.dead) continue;
        if (rectsOverlap(o.x, o.y, o.radius, e.x, e.y, e.radius)) {
          this.damageEnemy(e, o.damage * dt * 3.5, 0, 0, o.weaponKind);
        }
      }
    }
  }

  private damageEnemy(e: Enemy, damage: number, pushX = 0, pushY = 0, weapon?: WeaponKind) {
    const shielded = e.kind === "boss-oracle" && this.enemies.some((m) => m.feedNode && !m.dead);
    const dealt = Math.max(1, Math.round(shielded ? damage * 0.25 : damage));
    e.hp -= dealt;
    e.revealed = true;
    if (weapon) this.weaponDamage.set(weapon, (this.weaponDamage.get(weapon) ?? 0) + dealt);
    e.flash = 0.05;
    this.stats.damageDealt += dealt;
    this.audio.play("hit");
    if (!ENEMIES[e.kind].isBoss && (pushX || pushY)) {
      const n = normalize(pushX, pushY);
      e.kx = n.x * KNOCKBACK;
      e.ky = n.y * KNOCKBACK;
    }
    this.addDamageFloater(e, dealt);
    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      this.onEnemyKilled(e);
    }
  }

  private addDamageFloater(e: Enemy, dealt: number) {
    const existing = this.floaters.find((f) => f.enemyId === e.id && f.life > f.maxLife - 0.22);
    if (existing) {
      existing.amount = (existing.amount ?? 0) + dealt;
      existing.hits = (existing.hits ?? 1) + 1;
      existing.text = this.priceLieTimer > 0 ? String(Math.floor(Math.random() * 99999)) : `${existing.amount}`;
      existing.life = existing.maxLife;
      return;
    }
    if (this.floaters.length >= 60) return;
    this.floaters.push({
      x: e.x + randRange(-8, 8),
      y: e.y - e.radius * 1.5,
      vy: -46,
      life: 0.6,
      maxLife: 0.6,
      text: this.priceLieTimer > 0 ? String(Math.floor(Math.random() * 99999)) : String(dealt),
      color: this.priceLieTimer > 0 ? "#79c0ff" : "#ffe9a8",
      enemyId: e.id,
      amount: dealt,
      hits: 1,
    });
  }

  private onEnemyKilled(e: Enemy) {
    const def = ENEMIES[e.kind];
    this.stats.kills++;
    if (this.gearStats.healOnKill) this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.gearStats.healOnKill);
    if (this.gearStats.fundsOnKill) this.fundsLost = Math.max(0, this.fundsLost - this.gearStats.fundsOnKill);
    if (e.kind === "sybil") {
      for (let i = 0; i < 3; i++) this.spawnEnemyAt("sybil-mini", e.x + randRange(-22, 22), e.y + randRange(-22, 22));
    }
    if (e.kind === "gas-guzzler") gasCloud(this, e.x, e.y, 96, e.damage * 0.5, e.kind);
    if (e.elite) {
      const title = e.bounty ? "BOUNTY COLLECTED" : "WHALE LIQUIDATED";
      this.grantLoot(rollChestLoot(e.bounty ? "rare" : "uncommon", biomeAt(e.x, e.y)), title, "#ffc23d", e.x, e.y);
      this.spawnPickup(e.x, e.y, "coin", rollGold("uncommon"));
    }
    if (def.isBoss || e.elite) this.popupHoldUntil = this.elapsed + (def.isBoss ? 1.2 : 0.4);
    if (def.isBoss) this.grantLoot({ type: "gear", id: rollBossGear(this.stats.bossesDefeated) }, "BOSS CACHE", def.color, e.x, e.y);
    this.corpses.push({ x: e.x, y: e.y, kind: e.kind, life: 0.2, maxLife: 0.2, flip: this.player.x < e.x });
    this.burstParticles(e.x, e.y, def.color, def.isBoss ? 60 : 10);
    if (e.carried) {
      this.fundsLost = Math.max(0, this.fundsLost - e.carried);
      this.fundsRecovered += e.carried;
      this.drainersStopped++;
      this.addFloater(e.x, e.y - 34, `+$${(e.carried / 1e6).toFixed(1)}M RECOVERED`, "#2ee6c7");
      this.audio.play("txConfirmed");
    }
    for (let i = 0; i < (e.stolen ?? 0); i++) {
      this.spawnPickup(e.x + randRange(-18, 18), e.y + randRange(-14, 14), "xp", Math.max(1, (e.stolenXp ?? 3) / (e.stolen ?? 1)));
    }
    if (e.implant && !this.enemies.some((m) => m.implant && !m.dead && m !== e)) {
      for (const w of this.weapons) w.jammed = false;
      this.addFloater(this.player.x, this.player.y - 70, "IMPLANTS CLEARED", "#2ee6c7");
    }
    if (KILL_FEED[e.kind] && this.elapsed - this.lastFeedAt > 0.8) {
      this.lastFeedAt = this.elapsed;
      this.pushFeed(`${this.fakeHash()} ${KILL_FEED[e.kind]}`);
    }
    if (def.isBoss) {
      this.logEvent(`${def.name} contained`);
      for (const w of this.weapons) w.jammed = false;
      this.stats.bossesDefeated++;
      this.hitstop = 0.22;
      this.impactFrames = 10;
      this.addTrauma(0.9);
      this.audio.play("bossDeath");
      this.shockwaves.push({ x: e.x, y: e.y, radius: 360, life: 0.9, maxLife: 0.9, color: def.color });
    } else {
      this.audio.play("kill");
      this.shockwaves.push({ x: e.x, y: e.y, radius: e.radius * 1.9, life: 0.2, maxLife: 0.2, color: def.color });
    }
    const area = AREA_RULES[biomeAt(e.x, e.y)];
    const xpVal = def.xp * this.player.xpMult * area.xp;
    this.spawnPickup(e.x, e.y, "xp", xpVal);
    const coinChance = def.isBoss ? 1 : 0.2;
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

  spawnPickup(x: number, y: number, kind: Pickup["kind"], value: number) {
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
    const pickupReach = p.pickupRadius * this.buffMult("pickup") * (1 + (this.gearStats.pickup ?? 0));
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
        if (pk.kind === "xp") {
          this.audio.play("xp");
          this.gainXp(pk.value);
        }
        if (pk.kind === "health") {
          this.audio.play("txConfirmed");
          p.hp = Math.min(p.maxHp, p.hp + pk.value);
        }
        if (pk.kind === "coin") {
          this.audio.play("coin");
          p.coins += Math.round(pk.value * (1 + (this.gearStats.coin ?? 0)));
        }
        if (pk.kind === "buff" && pk.buffKind) {
          this.audio.play("chest");
          this.applyTimedBuff(pk.buffKind);
          this.addToast(TIMED_BUFFS[pk.buffKind].name, TIMED_BUFFS[pk.buffKind].color);
        }
      }
    }
    this.pickups = this.pickups.filter((x) => !x.dead);
  }

  private gainXp(amount: number) {
    this.player.xp += amount * (1 + (this.gearStats.xp ?? 0));
    if (this.phase !== "playing") return;
    if (this.player.xp >= this.player.xpToNext) {
      this.player.xp -= this.player.xpToNext;
      this.player.level++;
      this.player.xpToNext = Math.floor(25 * Math.pow(1.14, this.player.level - 1));
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
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.5);
    for (const c of this.corpses) c.life -= dt;
    this.corpses = this.corpses.filter((c) => c.life > 0);
    this.updateShockwaves(dt);
  }

  private updateShockwaves(dt: number) {
    for (const s of this.shockwaves) s.life -= dt;
    this.shockwaves = this.shockwaves.filter((s) => s.life > 0);
  }

  burstParticles(x: number, y: number, color: string, n: number) {
    const room = Math.min(n, MAX_PARTICLES - this.particles.length);
    for (let i = 0; i < room; i++) {
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
    this.camera.x = p.x - w / 2 + shakeX;
    this.camera.y = p.y - h / 2 + shakeY;
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
        jammed: !!w.jammed,
      })),
      coins: p.coins,
      biome: `${biome.name} · ${AREA_RULES[biomeAt(p.x, p.y)].rule}`,
      funds: this.fundsLeft,
      fundsPct: (this.fundsLeft / FUNDS_TOTAL) * 100,
      block: this.blockHeight,
      gas: this.gasActive,
      lie: this.priceLieTimer > 0,
      swapped: this.swapTimer > 0,
      feed: this.feed,
      banner: this.banner,
      signers: this.signers,
      leverage: this.leverage,
      flash: this.elapsed < this.flashUntil ? "LOAN LIVE" : this.elapsed < this.flashDebtUntil ? "IN DEFAULT" : null,
      buffs: p.activeBuffs.map((b) => ({
        label: TIMED_BUFFS[b.kind].emoji + " " + TIMED_BUFFS[b.kind].name,
        remaining: Math.max(0, b.until - this.elapsed),
      })),
      sidekick: p.sidekick ? SIDEKICKS[p.sidekick].name : null,
      nextBoss: this.nextBossIn,
      gear: (Object.keys(SLOT_LABEL) as (keyof typeof SLOT_LABEL)[]).map((slot) => {
        const id = p.gear[slot];
        return { slot: SLOT_LABEL[slot], name: id ? gearDef(id).name : null, rarity: id ? gearDef(id).rarity : "common" };
      }),
      toasts: this.toasts,
      ability: p.ability ? { name: ABILITIES[p.ability].short, remaining: Math.max(0, p.abilityReadyAt - this.elapsed), color: ABILITIES[p.ability].color } : null,
      shielded: this.elapsed < p.shieldUntil,
      neverSell: this.elapsed < p.neverSellUntil,
    });
  }
}

const STARTER_GEAR: GearId[] = ["anon-hoodie", "paper-wallet", "uni-receipt", "wagmi-hat", "ledger-stick"];

function firstGear(): GearId {
  return STARTER_GEAR[Math.floor(simRandom() * STARTER_GEAR.length)]!;
}

function rollBossGear(defeated: number): GearId {
  const rarity = RARITY_ORDER[Math.min(4, 1 + Math.floor(defeated / 2))]!;
  const pool = (Object.keys(GEAR) as GearId[]).filter((id) => gearDef(id).rarity === rarity);
  return pool[Math.floor(simRandom() * pool.length)]!;
}

function lerpVec(current: number, target: number, t: number): number {
  return current + (target - current) * t;
}
