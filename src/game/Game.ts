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
import { buildUpgradePool } from "../data/upgrades";
import { ENV_OBSTACLES } from "../data/environment";
import { rarityDamageMult } from "../data/rarity";
import { EVOLUTIONS, weaponAtLevel, WEAPONS } from "../data/weapons";
import type { Input } from "../engine/Input";
import { CutsceneEngine, type CutsceneId } from "../cutscene/CutsceneEngine";
import { AudioEngine } from "../audio/AudioEngine";
import type { MusicTrackId } from "../audio/music";
import { WorldStream } from "./worldGen";
import { WorldEvents } from "./interact";
import { applyLure, fireHotfix, fireTool, TOOL_COLORS, updateToolState, DEFAULT_TOOL_COLOR, type Loan, type Lure, type Seal } from "./tools";
import { ABILITIES, type AbilityId } from "../data/abilities";
import { compareGear, gearDef, gearName, gearStats, MAX_GEAR_TIER, RARITY_ORDER, rollGear, SLOT_LABEL, type GearItem, type GearStats } from "../data/gear";
import { ABILITY_ORDER } from "../data/abilities";
import type { WeaponRarity } from "../data/rarity";
import { CHESTS } from "../data/environment";
import { HashItem, SpatialHash } from "../physics/SpatialHash";
import { CHECKPOINT_TICKS, decodeMove, encodeMove, roundAspect, RunRecorder, type RunLog } from "../replay/runLog";
import { DIFFICULTY, type DifficultyId } from "../data/difficulty";
import { BIOME_HORDE_BIAS, BIOME_LABEL, AREA_RULES } from "../data/biomeSpawns";
import { biomeAt, setBiomeSeed } from "../data/environment";
import { rollGold } from "../data/loot";
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
  PerkId,
  Pickup,
  PlayerState,
  Projectile,
  RunStats,
  UpgradeContext,
  UpgradeDef,
  WeaponInstance,
  WeaponKind,
  Interactable,
  SidekickKind,
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
  cosmeticRange,
  lootRandom,
  simRandom,
  spawnRandom,
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
const ELITE_CHANCE = 0.006;
const MAX_SPEED_MULT = 1.6;
const MAX_RIGS = 2;
const MAX_RIG_TIER = 4;
const MAX_STASH = 6;
const MAX_PICKUPS = 320;
const COIN_VALUE = 0.9;
const PAD_BOOSTS: TimedBuffKind[] = ["staked-frenzy", "yield-rush", "gas-surge", "audit-shield", "priority-fee", "magnet-node"];
const RARITY_WEIGHT: Record<WeaponRarity, number> = { common: 40, uncommon: 30, rare: 18, epic: 9, legendary: 3 };
const TOOL_TARGETS: Record<WeaponKind, number> = {
  "audit-dart": 1.2, "reorg-whip": 5, "finality-beam": 3.5, "stable-shield": 1.5, "patch-burst": 3, "rug-coin": 2, "memo-pulse": 3.2, "flash-loan": 4,
  "validator-seal": 7, "bridge-bolt": 3, "nonce-shard": 2.5, "pager-ping": 4, "honeypot-trap": 7, "oracle-strike": 5, "merkle-proof": 3.5, "slashing-field": 5, "whale-alert": 1.5,
};
const PERK_VALUE: Record<PerkId, number> = {
  pierce: 0.1, multishot: 0.3, area: 0.12, crit: 0.12, regen: 0.08, thorns: 0.05, dashBlast: 0.1, dashCooldown: 0.05, xp: 0.06, coin: 0.04, killBlast: 0.1, abilityCooldown: 0.05, revive: 0.3, rerolls: 0.03,
  lpRange: 0.15, launchpool: 0.15, cleanFeed: 0.03, bugBounty: 0.1, eigen: 0.1, aave: 0.08, lido: 0.04, flashbots: 0.07, wormhole: 0.03, opGrant: 0.05, curve: 0.04,
};
const MAX_WHALES = 3;
const RECYCLE_DISTANCE = 1500;
const BOSS_LEASH_DISTANCE = 1100;
const PICKUP_CULL_DISTANCE = 2400;
const ARMOR_CAP = 0.7;
const CHEST_COST_GROWTH = 0.6;
const MAX_LEVEL_GAP_SEC = 15;
const XP_STEEP_FROM_LEVEL = 18;
const RUG_HOLD_SEC = 8;
const BEST_KEY = "best";
const MAX_DRAINERS = 5;
const MAX_BOT_FARMS = 2;
const MAX_SHOOTERS = 14;
const PLAYER_HIT_RADIUS = 11;
const ENEMY_HIT_SCALE = 0.8;
const HUD_TICKS = 6;
export const ARC_LIFE_SEC = 0.16;
const EMPTY_PERKS = Object.fromEntries(
  ["pierce", "multishot", "area", "crit", "regen", "thorns", "dashBlast", "dashCooldown", "xp", "coin", "killBlast", "abilityCooldown", "revive", "rerolls", "lpRange", "launchpool", "cleanFeed", "bugBounty", "eigen", "aave", "lido", "flashbots", "wormhole", "opGrant", "curve"].map((k) => [k, 0])
) as Record<PerkId, number>;
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
  rigs: string[];
  stash: string[];
  fieldRadius: number;
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
  strikes: { at: number; x: number; y: number; r: number; damage: number; color: string; weapon?: WeaponKind }[] = [];
  arcs: { x1: number; y1: number; x2: number; y2: number; life: number; color: string }[] = [];
  perks: Record<PerkId, number> = { ...EMPTY_PERKS };
  loans: Loan[] = [];
  seals: Seal[] = [];
  lures: Lure[] = [];
  rigs: SidekickState[] = [];
  stillTime = 0;
  fieldRadius = 0;
  sealTick = 0;
  lastHurtAt = 0;
  banishes = 1;
  nextBossHpBonus = 1;
  private banished = new Set<string>();
  private nextLevelAt = 0;
  private aaveTimer = 0;
  private spentSinceBoss = 0;
  private doubleXpUntil = 0;
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
  stats: RunStats = { kills: 0, damageDealt: 0, timeSurvived: 0, bossesDefeated: 0 };

  readonly cutscene = new CutsceneEngine();

  spawnTimer = 0;
  spawnRate = 0.85;
  elapsed = 0;
  bossesSpawned = 0;
  levelUpChoices: UpgradeDef[] = [];
  private upgradeCounts = new Map<string, number>();
  shake = 0;

  private recorder = new RunRecorder(0, "keel", "normal");
  private moveCode = 0;
  private spawnAspect = 16 / 9;
  runTick = 0;
  checkpointCount = 0;
  lastCheckpoint = 0;
  aspectSource: () => number = () => {
    const vp = readViewport(this.canvas);
    return vp.width / Math.max(1, vp.height);
  };
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
  pathLog: { x: number; y: number }[] = [];
  private pathTimer = 0;
  private reorgAt = 0;
  hitstop = 0;
  impactFrames = 0;
  hurtPulse = 0;
  cameraFocus: { x: number; y: number; weight: number } | null = null;
  private collisionScratch: HashItem[] = [];

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
    this.startReplayableRun((Math.random() * 2 ** 31) | 0, this.selectedCharacter, this.runDifficulty);
  }

  startReplayableRun(seed: number, hero: CharacterId, difficulty: DifficultyId) {
    this.selectedCharacter = hero;
    this.runDifficulty = difficulty;
    this.attract = false;
    this.audio.silenced = false;
    this.resetRun(seed);
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

  private resetRun(seed = (Math.random() * 2 ** 31) | 0) {
    nextId = 1;
    this.runTick = 0;
    this.checkpointCount = 0;
    this.lastCheckpoint = 0;
    this.simTick = 0;
    this.moveCode = 0;
    this.spawnAspect = roundAspect(this.aspectSource());
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
      stash: [],
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
    this.worldSeed = seed;
    seedSim(this.worldSeed);
    setBiomeSeed(this.worldSeed);
    this.stream = new WorldStream(this.worldSeed);
    this.events = new WorldEvents(this);
    this.strikes = [];
    this.arcs = [];
    this.perks = { ...EMPTY_PERKS };
    this.doubleXpUntil = 0;
    this.choiceMode = "levelup";
    this.popupQueue = [];
    this.popupHoldUntil = 0;
    this.toasts = [];
    this.gearStats = {};
    this.chestsOpened = 0;
    this.secondWalletDone = false;
    this.rigs = [];
    this.loans = [];
    this.seals = [];
    this.lures = [];
    this.stillTime = 0;
    this.fieldRadius = 0;
    this.lastHurtAt = 0;
    this.banishes = 1;
    this.banished.clear();
    this.nextLevelAt = 0;
    this.aaveTimer = 0;
    this.spentSinceBoss = 0;
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.spawnRate = 0.85;
    this.bossesSpawned = 0;
    this.upgradeCounts.clear();
    this.recorder = new RunRecorder(seed, ch.id, this.runDifficulty);
    this.recorder.aspect(0, this.spawnAspect);
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
    this.recorder.choice(this.runTick, "pick", index);
    if (this.choiceMode === "popup") {
      up.apply(this.makeUpgradeContext());
      this.choiceMode = "levelup";
      this.nextLevelAt = Math.max(this.nextLevelAt, this.elapsed + 1.5);
      this.input.clearEdges();
      this.audio.play("cardSelect");
      this.setPhase("playing");
      return;
    }
    const ctx = this.makeUpgradeContext();
    up.apply(ctx);
    if (this.player.characterId === "trace") for (const w of this.weapons) w.timer = 0;
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
      maxHp: (amount) => {
        this.player.maxHp += amount;
        this.player.hp += amount;
      },
      hasUpgrade: (id) => this.ownsUpgrade(id),
      boostStat: (stat, amount) => {
        if (stat === "damage") this.player.damageMult += amount;
        if (stat === "speed") this.player.moveSpeed += getCharacter(this.player.characterId).moveSpeed * amount;
        if (stat === "pickup") this.player.pickupRadius *= 1 + amount;
        if (stat === "armor") this.player.armor = clamp(this.player.armor + amount, 0, ARMOR_CAP);
        if (stat === "cooldown") this.player.cooldownMult *= 1 - amount;
        if (stat === "yield") this.player.yieldPerSec += 0.75 * amount;
      },
      special: (id) => this.applySpecial(id),
      perk: (id, amount) => {
        if (id === "rerolls") this.rerolls += amount;
        else this.perks[id] += amount;
      },
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
    const pool = buildUpgradePool(ctx).filter((u) => (this.upgradeCounts.get(u.id) ?? 0) < (u.maxTimes ?? 99) && !this.banished.has(u.id));
    const chosen: UpgradeDef[] = [];
    while (chosen.length < 3 && pool.length) {
      const total = pool.reduce((sum, u) => sum + RARITY_WEIGHT[u.rarity ?? "common"], 0);
      let roll = lootRandom() * total;
      let index = 0;
      for (; index < pool.length - 1; index++) {
        roll -= RARITY_WEIGHT[pool[index]!.rarity ?? "common"];
        if (roll <= 0) break;
      }
      chosen.push(pool.splice(index, 1)[0]!);
    }
    if (!chosen.some((u) => u.id.startsWith("upgrade-"))) {
      const patches = pool.filter((u) => u.id.startsWith("upgrade-"));
      if (patches.length && chosen.length) chosen[chosen.length - 1] = patches[Math.floor(lootRandom() * patches.length)]!;
    }
    this.scoreCards(chosen);
    this.levelUpChoices = chosen;
  }

  rerollCards() {
    if (this.phase !== "levelup" || this.rerolls <= 0 || this.choiceMode !== "levelup") return;
    this.recorder.choice(this.runTick, "reroll", 0);
    this.rerolls--;
    this.rollChoices();
    this.audio.play("ui");
    this.cb.onLevelUpChoices(this.levelUpChoices);
  }

  banishCard(index: number) {
    if (this.phase !== "levelup" || this.choiceMode !== "levelup" || this.banishes <= 0) return;
    const card = this.levelUpChoices[index];
    if (!card) return;
    this.recorder.choice(this.runTick, "banish", index);
    this.banishes--;
    this.banished.add(card.id);
    this.rollChoices();
    this.audio.play("ui");
    this.cb.onLevelUpChoices(this.levelUpChoices);
  }

  skipCards() {
    if (this.phase !== "levelup" || this.choiceMode !== "levelup") return;
    this.recorder.choice(this.runTick, "skip", 0);
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
    this.setPhase("levelup");
    this.audio.play("levelUp");
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
      else if (this.input.consumeSkip()) this.skipCards();
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

    this.runTick++;
    this.syncAspect();
    if (this.runTick % CHECKPOINT_TICKS === 0) {
      this.lastCheckpoint = this.stateHash();
      this.checkpointCount++;
      this.recorder.checkpoint(this.lastCheckpoint);
    }
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
    this.moveCode = encodeMove(this.input.moveVector());
    this.recorder.move(this.moveCode);
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

    if (this.popupQueue.length && this.elapsed >= this.popupHoldUntil && this.dying <= 0) {
      this.openPopup(this.popupQueue.shift()!);
      return;
    }
    if (this.player.xp >= this.player.xpToNext && this.elapsed >= this.nextLevelAt && this.dying <= 0) {
      this.player.xp -= this.player.xpToNext;
      this.player.level++;
      this.player.xpToNext = xpForLevel(this.player.level);
      this.nextLevelAt = this.elapsed + Math.min(MAX_LEVEL_GAP_SEC, 1 + this.elapsed / 25);
      this.triggerLevelUp();
      if (this.phase !== "playing") return;
    }
    this.toasts = this.toasts.filter((t) => t.until > this.elapsed);

    if (this.stream.update(this.player.x, this.player.y)) this.seenStreamVersion();
    if (this.dying <= 0) {
      this.updatePlayer(dt);
      if (this.input.consumeAbility()) {
        this.recorder.ability(this.runTick);
        this.useAbility();
      }
    }
    this.events.update(dt);
    this.updateStrikes();
    this.updateChain(dt);
    this.updateWells(dt);
    this.updateChests(dt);
    this.updateRigs(dt);
    updateToolState(this, dt);
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
    this.checkBossSchedule();
    if (++this.hudTick % HUD_TICKS === 0) this.pushHud();

    if (this.god) this.player.hp = this.player.maxHp;
    if (this.fundsLeft <= 0 && this.dying <= 0 && (this.runDifficulty === "hard" || this.runDifficulty === "nightmare")) {
      this.rootCause = "insolvent";
      this.player.hp = 0;
    }
    if (this.player.hp <= 0 && this.dying <= 0 && this.perks.revive > 0) {
      this.perks.revive--;
      this.player.hp = this.player.maxHp * 0.5;
      this.player.invuln = 2;
      this.impactFrames = 6;
      this.addStrike(this.player.x, this.player.y, 320, this.strikeDamage(), "#b58cff", 0);
      this.addToast("Hard fork: you never died", "#b58cff");
      this.audio.play("evolve");
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

  buildSummary() {
    const p = this.player;
    const total = this.totalDps();
    return {
      tools: this.weapons
        .map((w) => ({ name: w.evolved ? EVOLUTIONS[w.kind].name : WEAPONS[w.kind].name, level: w.level, rarity: w.rarity, dps: this.toolDps(w.kind, w.level, w.rarity), recipe: this.ownsUpgrade(EVOLUTIONS[w.kind].needs) }))
        .sort((a, b) => b.dps - a.dps),
      total,
      gear: (Object.keys(SLOT_LABEL) as (keyof typeof SLOT_LABEL)[]).map((slot) => {
        const item = p.gear[slot];
        return { slot: SLOT_LABEL[slot], name: item ? gearName(item) : "Empty", lines: item ? compareGear(item).map((l) => l.replace(/\S+ → /, "")) : [] };
      }),
      stash: p.stash.map(gearName),
      merges: this.mergeOptions().map(gearName),
      rigs: this.rigs.map((r) => `${SIDEKICKS[r.kind].name} T${r.tier + 1}`),
      stats: [
        ["Damage", `${Math.round(this.damageTotal() * 100)}%`],
        ["Speed", `${Math.round((this.currentSpeed() / getCharacter(p.characterId).moveSpeed) * 100)}%`],
        ["Armor", `${Math.round(this.totalArmor() * 100)}%`],
        ["Max HP", `${Math.round(p.maxHp)}`],
        ["Cooldowns", `${Math.round(this.weaponCooldownMult() * 100)}%`],
        ["$SAFU", `${p.coins}`],
      ],
    };
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
    const scale = (1 + minutes * 0.25 + minutes * minutes * 0.08) * dm.enemyHpMult;
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
      damage: def.damage * (1 + minutes * 0.15),
      speed: def.speed * (1 + this.elapsed * 0.0005) * dm.enemySpeedMult,
      contactCd: 0,
      flash: 0,
      wobble: cosmeticRange(0, Math.PI * 2),
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
    this.lastHurtAt = this.elapsed;
    const hotfix = this.weapons.find((w) => w.kind === "patch-burst");
    if (hotfix) fireHotfix(this, hotfix, 1.5);
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
      p.damageMult -= 0.12;
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
      this.bannerQueue.unshift({ title: "INBOUND TX · 0xdead…c0de", text: TUTORIAL[this.tutorialStep]![1], tone: "#ff5c48" });
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
    if (this.buffActive("cooldown")) m *= 0.65;
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
    const landed = this.enemies.find((e) => e.id === this.cinematic?.bossId);
    if (landed) landed.lift = 0;
    this.hitstop = 0;
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
      if (p.dashTimer <= 0) {
        const hotfix = this.weapons.find((w) => w.kind === "patch-burst");
        if (hotfix) fireHotfix(this, hotfix, 1.5);
      }
    } else {
      const mv = decodeMove(this.moveCode);
      const swap = this.swapTimer > 0 ? -1 : 1;
      const n = normalize(mv.x * swap, mv.y * swap);
      const spd = this.currentSpeed() * AREA_RULES[biomeAt(p.x, p.y)].speed;
      p.vx = n.x * spd;
      p.vy = n.y * spd;
      if (n.x !== 0 || n.y !== 0) p.facing = Math.atan2(n.y, n.x);
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (this.input.consumeDash()) {
        this.recorder.dash(this.runTick);
        this.dashBuffer = DASH_BUFFER_SEC;
      }
      else if (this.dashBuffer > 0) this.dashBuffer -= dt;
      if (this.dashBuffer > 0 && p.dashCooldown <= 0 && this.elapsed >= p.neverSellUntil) {
        this.dashBuffer = 0;
        this.audio.play("dash");
        const dashDir =
          n.x !== 0 || n.y !== 0
            ? n
            : normalize(Math.cos(p.facing), Math.sin(p.facing));
        p.vx = dashDir.x * this.currentSpeed() * DASH.speedMult;
        p.vy = dashDir.y * this.currentSpeed() * DASH.speedMult;
        p.dashTimer = DASH.duration;
        p.dashCooldown = getCharacter(p.characterId).dashCooldown * (1 - (this.gearStats.dash ?? 0)) * Math.max(0.4, 1 - this.perks.dashCooldown) * (this.buffActive("dash") ? 0.5 : 1);
        if (this.perks.flashbots > 0) this.projectiles = this.projectiles.filter((pr) => pr.fromPlayer || dist(pr.x, pr.y, p.x, p.y) > 260);
        if (this.perks.dashBlast > 0) this.addStrike(p.x, p.y, 120 + this.perks.dashBlast * 30, this.strikeDamage() * 0.4 * this.perks.dashBlast, "#2ee6c7", 0);
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
        if (p.invuln <= 0 && this.elapsed >= p.shieldUntil) {
          p.hp -= def.damagePerSec * dt * (1 - this.totalArmor());
          this.rootCause = "hazard";
        }
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

  private buffActive(stat: string): boolean {
    return this.player.activeBuffs.some((b) => TIMED_BUFFS[b.kind].stat === stat);
  }

  private currentSpeed(): number {
    const base = getCharacter(this.player.characterId).moveSpeed;
    return Math.min(base * MAX_SPEED_MULT, this.player.moveSpeed * this.buffMult("speed") * (1 + (this.gearStats.speed ?? 0)));
  }

  damageTotal(): number {
    const p = this.player;
    let total = p.damageMult + (this.gearStats.damage ?? 0);
    if (this.perks.lpRange > 0 && p.hp / p.maxHp >= 0.4 && p.hp / p.maxHp <= 0.8) total += 0.3;
    if (this.perks.launchpool > 0) total += Math.min(0.3, Math.floor(p.coins / 5) * 0.01);
    if (this.perks.eigen > 0) total += this.totalArmor();
    if (this.buffActive("rebase")) total += 0.6 * (1 - p.hp / p.maxHp);
    return total;
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
      if (TIMED_BUFFS[b.kind].stat === "armor") a += 0.22;
    }
    return clamp(a, 0, ARMOR_CAP);
  }

  applyTimedBuff(kind: TimedBuffKind) {
    const def = TIMED_BUFFS[kind];
    const active = this.player.activeBuffs.find((b) => b.kind === kind);
    if (active) active.until = this.elapsed + def.duration;
    else this.player.activeBuffs.push({ kind, until: this.elapsed + def.duration });
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

  addStrike(x: number, y: number, r: number, damage: number, color: string, delay: number, weapon?: WeaponKind) {
    this.strikes.push({ at: this.elapsed + delay, x, y, r, damage, color, weapon });
  }

  strikeDamage(): number {
    return 70 * (1 + this.elapsed / 60 * 0.45) * this.damageTotal();
  }

  private updateStrikes() {
    if (!this.strikes.length) return;
    for (const s of this.strikes) {
      if (this.elapsed < s.at) continue;
      s.at = Infinity;
      this.aoeHit(s.x, s.y, s.r, s.damage, s.weapon);
      this.shockwaves.push({ x: s.x, y: s.y, radius: s.r, life: 0.32, maxLife: 0.32, color: s.color });
      this.addTrauma(0.22);
      this.audio.play("pulse");
    }
    this.strikes = this.strikes.filter((s) => s.at !== Infinity);
  }

  clearEnemyAttacks() {
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
    p.abilityReadyAt = this.elapsed + def.cooldown * this.weaponCooldownMult() * Math.max(0.4, 1 - this.perks.abilityCooldown);
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
    } else if (p.ability === "mev-bundle") {
      this.doubleXpUntil = this.elapsed + 10;
    } else if (p.ability === "bridge-out") {
      this.addStrike(p.x, p.y, 260, this.strikeDamage() * 1.6, def.color, 0.05);
      p.x += Math.cos(p.facing) * 460;
      p.y += Math.sin(p.facing) * 460;
      p.px = p.x;
      p.py = p.y;
      p.invuln = Math.max(p.invuln, 1);
      this.impactFrames = 3;
    } else if (p.ability === "claim-all") {
      for (const pk of this.pickups) pk.magnetized = true;
    } else if (p.ability === "validator-slash") {
      for (let i = 1; i <= 5; i++) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          this.addStrike(p.x + dx * i * 95, p.y + dy * i * 95, 85, this.strikeDamage() * 1.1, def.color, i * 0.08);
        }
      }
    } else if (p.ability === "insurance-claim") {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.35);
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
    for (const item of Object.values(p.gear) as GearItem[]) {
      for (const [key, value] of Object.entries(gearStats(item)) as [keyof GearStats, number][]) {
        sum[key] = (sum[key] ?? 0) + value;
      }
    }
    this.gearStats = sum;
    const delta = (sum.maxHp ?? 0) - before;
    p.maxHp += delta;
    p.hp = clamp(p.hp + Math.max(0, delta), 1, p.maxHp);
    this.syncOrbiters();
  }

  offerGear(item: GearItem) {
    const def = gearDef(item.id);
    const current = this.player.gear[def.slot];
    const price = this.sellPrice(item);
    this.showPopup("LOOT: PICK ONE", [
      this.gearCard(item, current),
      { id: "gear-stash", title: "Put in stash", tag: "STASH", description: "Keep it to merge later with a matching copy.", rarity: "common", value: price * COIN_VALUE * 1.1, apply: () => { this.stashItem(item); return true; } },
      { id: "gear-sell", title: `Sell for ${price} $SAFU`, tag: "SELL", description: "Dump it on the next guy.", rarity: "common", value: price * COIN_VALUE, apply: () => { this.player.coins += price; return true; } },
    ]);
  }

  showPopup(title: string, cards: UpgradeDef[]) {
    this.popupQueue.push({ title, cards });
  }

  private openPopup(popup: { title: string; cards: UpgradeDef[] }) {
    this.choiceMode = "popup";
    this.popupTitle = popup.title;
    this.levelUpChoices = popup.cards;
    this.scoreCards(popup.cards);
    this.setPhase("levelup");
    this.audio.play("levelUp");
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

  openChest(title: string, minRarity: WeaponRarity, color: string, x: number, y: number) {
    this.burstParticles(x, y, color, 14);
    const owned = this.allGear();
    const gearId = rollGear(minRarity, owned);
    const item: GearItem = { id: gearId, tier: 0 };
    const current = this.player.gear[gearDef(gearId).slot];
    const abilities = ABILITY_ORDER.filter((id) => id !== this.player.ability);
    const ability = abilities[Math.floor(lootRandom() * abilities.length)]!;
    const tokens = rollGold(minRarity);
    const evolve = this.weapons.find((w) => w.level >= WEAPONS[w.kind].maxLevel && !w.evolved && this.ownsUpgrade(EVOLUTIONS[w.kind].needs));
    const middle: UpgradeDef = evolve
      ? {
          id: "chest-evolve",
          title: `Evolve ${WEAPONS[evolve.kind].name}`,
          tag: "EVOLVE",
          description: `${EVOLUTIONS[evolve.kind].name}: ${EVOLUTIONS[evolve.kind].blurb}`,
          rarity: "legendary",
          value: this.totalDps() * 0.8,
          apply: (ctx) => {
            ctx.upgradeWeapon(evolve.kind);
            this.syncOrbiters();
            return true;
          },
        }
      : {
          id: "chest-ability",
          title: ABILITIES[ability].name,
          tag: "ABILITY",
          description: `${ABILITIES[ability].line} ${COARSE_POINTER ? "Tap its button." : "Press Q."}${this.player.ability ? ` Replaces ${ABILITIES[this.player.ability].name}.` : ""}`,
          rarity: "rare",
          value: this.totalDps() * (this.player.ability ? 0.12 : 0.3),
          apply: () => {
            this.grantAbility(ability);
            return true;
          },
        };
    this.showPopup(title, [
      this.gearCard(item, current),
      middle,
      {
        id: "chest-tokens",
        title: `${tokens} $SAFU`,
        tag: "TOKENS",
        description: "Spend it on chests and hardware upgrades.",
        rarity: "common",
        value: tokens * COIN_VALUE,
        apply: () => {
          this.player.coins += tokens;
          return true;
        },
      },
    ]);
  }

  private gearCard(item: GearItem, current?: GearItem): UpgradeDef {
    const def = gearDef(item.id);
    return {
      id: "gear-equip",
      title: gearName(item),
      tag: `GEAR · ${SLOT_LABEL[def.slot]}`,
      description: current ? `"${def.line}" Old item goes to your stash.` : `"${def.line}" Empty slot.`,
      rarity: def.rarity,
      compare: compareGear(item, current),
      value: this.gearValue(item) - (current ? this.gearValue(current) : 0),
      apply: () => {
        this.equip(item);
        return true;
      },
    };
  }

  private equip(item: GearItem) {
    const slot = gearDef(item.id).slot;
    const current = this.player.gear[slot];
    if (current) this.stashItem(current);
    this.player.gear[slot] = item;
    this.recomputeGear();
  }

  private stashItem(item: GearItem) {
    const p = this.player;
    p.stash.push(item);
    if (p.stash.length <= MAX_STASH) return;
    const dropped = p.stash.shift()!;
    p.coins += this.sellPrice(dropped);
    this.addToast(`Stash full: sold ${gearName(dropped)}`, "#f0c14d");
  }

  private sellPrice(item: GearItem): number {
    return 6 * (RARITY_ORDER.indexOf(gearDef(item.id).rarity) + 1) * (item.tier + 1);
  }

  allGear(): GearItem[] {
    return [...(Object.values(this.player.gear) as GearItem[]), ...this.player.stash];
  }

  ownsUpgrade(id: string): boolean {
    return (this.upgradeCounts.get(id) ?? 0) > 0;
  }

  mergeOptions(): GearItem[] {
    const seen = new Map<string, number>();
    const out: GearItem[] = [];
    for (const item of this.allGear()) {
      const key = `${item.id}:${item.tier}`;
      const count = (seen.get(key) ?? 0) + 1;
      seen.set(key, count);
      if (count === 2 && item.tier < MAX_GEAR_TIER) out.push(item);
    }
    return out;
  }

  merge(source: GearItem) {
    const p = this.player;
    const same = (o?: GearItem) => !!o && o.id === source.id && o.tier === source.tier;
    let consumed = 0;
    p.stash = p.stash.filter((o) => {
      if (same(o) && consumed < 2) {
        consumed++;
        return false;
      }
      return true;
    });
    const slot = gearDef(source.id).slot;
    const upgraded: GearItem = { id: source.id, tier: source.tier + 1 };
    if (same(p.gear[slot])) p.gear[slot] = undefined;
    if (p.gear[slot]) this.stashItem(upgraded);
    else p.gear[slot] = upgraded;
    this.recomputeGear();
    this.impactFrames = 4;
    this.audio.play("evolve");
    this.addToast(`Merged: ${gearName(upgraded)}`, "#b58cff");
  }

  mergeCards(): UpgradeDef[] {
    const cards: UpgradeDef[] = this.mergeOptions().slice(0, 2).map((item) => {
      const next: GearItem = { id: item.id, tier: item.tier + 1 };
      return {
        id: "merge-item",
        title: `Merge into ${gearName(next)}`,
        tag: "MERGE",
        description: `Burns two copies of ${gearName(item)}.`,
        rarity: gearDef(item.id).rarity,
        compare: compareGear(next, item),
        value: this.gearValue(next) - this.gearValue(item),
        apply: () => {
          this.merge(item);
          return true;
        },
      };
    });
    cards.push({ id: "merge-later", title: "Not now", tag: "SKIP", description: "Keep both copies for later.", rarity: "common", value: 0, apply: () => true });
    return cards;
  }

  rigCards(kind: SidekickKind, rack: Interactable): UpgradeDef[] {
    const cards: UpgradeDef[] = [];
    const owned = this.rigs.find((r) => r.kind === kind);
    if (!owned) {
      const def = SIDEKICKS[kind];
      const replaces = this.rigs.length >= MAX_RIGS ? this.rigs[0] : undefined;
      cards.push({
        id: "rig-recruit",
        title: def.name,
        tag: "HARDWARE",
        description: `${def.blurb}${replaces ? ` Replaces ${SIDEKICKS[replaces.kind].name}.` : " Follows you around."}`,
        rarity: "rare",
        value: this.totalDps() * (replaces ? 0.05 : 0.2),
        apply: () => {
          this.addRig(kind);
          rack.used = true;
          return true;
        },
      });
    }
    for (const rig of this.rigs) {
      const cost = this.rigUpgradeCost(rig);
      const affordable = this.player.coins >= cost;
      if (rig.tier >= MAX_RIG_TIER) continue;
      cards.push({
        id: "rig-upgrade",
        title: `${SIDEKICKS[rig.kind].name} · T${rig.tier + 1} → T${rig.tier + 2}`,
        tag: affordable ? `UPGRADE · ${cost} $SAFU` : `NEED ${cost} $SAFU`,
        description: `Output +40%. ${SIDEKICKS[rig.kind].blurb}`,
        rarity: "uncommon",
        value: affordable ? this.totalDps() * 0.1 : -1,
        apply: () => {
          if (this.player.coins < cost) {
            this.addToast(`Need ${cost} $SAFU`, "#ff5c48");
            return true;
          }
          this.player.coins -= cost;
          rig.tier++;
          this.audio.play("evolve");
          return true;
        },
      });
    }
    cards.push({ id: "rig-later", title: "Not now", tag: "SKIP", description: "The rack stays here.", rarity: "common", value: 0, apply: () => true });
    return cards.slice(0, 3);
  }

  private rigUpgradeCost(rig: SidekickState): number {
    return 20 * (rig.tier + 1) * (rig.tier + 1);
  }

  private addRig(kind: SidekickKind) {
    if (this.rigs.length >= MAX_RIGS) this.rigs.shift();
    this.rigs.push({ kind, tier: 0, x: this.player.x, y: this.player.y, angle: this.rigs.length * Math.PI, attackTimer: 1 });
    this.ringParticle(this.player.x, this.player.y, SIDEKICKS[kind].orbit, SIDEKICKS[kind].color);
    this.audio.play("txConfirmed");
  }

  applyPadBoost() {
    const kind = PAD_BOOSTS[Math.floor(this.rand() * PAD_BOOSTS.length)]!;
    this.applyTimedBuff(kind);
    this.addToast(`${TIMED_BUFFS[kind].name}: ${TIMED_BUFFS[kind].line}`, TIMED_BUFFS[kind].color);
    this.audio.play("txConfirmed");
  }

  selfDamage(amount: number) {
    const p = this.player;
    if (p.invuln > 0 || this.elapsed < p.shieldUntil || this.dying > 0) return;
    p.hp -= amount;
    this.rootCause = "hazard";
    this.hurtPulse = 1;
  }

  private statValue(stats: GearStats): number {
    const total = this.totalDps();
    return (
      (stats.damage ?? 0) * total +
      (stats.cooldown ?? 0) * total +
      (stats.armor ?? 0) * total * 1.5 +
      (stats.speed ?? 0) * total * 0.6 +
      ((stats.maxHp ?? 0) / this.player.maxHp) * total * 0.6 +
      (stats.pickup ?? 0) * total * 0.2 +
      (stats.xp ?? 0) * total * 0.4 +
      (stats.coin ?? 0) * total * 0.3 +
      (stats.dash ?? 0) * total * 0.2 +
      (stats.yield ?? 0) * total * 0.3 +
      (stats.healOnKill ?? 0) * total * 0.8 +
      ((stats.fundsOnKill ?? 0) / 1e6) * total
    );
  }

  private gearValue(item: GearItem): number {
    return this.statValue(gearStats(item));
  }

  toolDps(kind: WeaponKind, level: number, rarity: WeaponRarity): number {
    const def = weaponAtLevel(kind, level);
    const perSecond = def.orbit ? 3.5 : 1 / Math.max(def.cooldown, 0.1);
    return def.damage * perSecond * rarityDamageMult(rarity) * TOOL_TARGETS[kind] * this.damageTotal();
  }

  totalDps(): number {
    return Math.max(20, this.weapons.reduce((sum, w) => sum + this.toolDps(w.kind, w.level, w.rarity), 0));
  }

  private scoreCards(cards: UpgradeDef[]) {
    const total = this.totalDps();
    const p = this.player;
    for (const card of cards) {
      if (card.value !== undefined) continue;
      let value = 0;
      card.apply({
        addWeapon: (kind) => (value += this.toolDps(kind, 1, WEAPONS[kind].rarity)),
        upgradeWeapon: (kind) => {
          const w = this.weapons.find((x) => x.kind === kind);
          if (!w) return;
          if (w.level >= WEAPONS[kind].maxLevel) value += total * 0.8;
          else value += this.toolDps(kind, w.level + 1, w.rarity) - this.toolDps(kind, w.level, w.rarity);
        },
        heal: (amount) => (value += (Math.min(amount, p.maxHp - p.hp) / p.maxHp) * total),
        maxHp: (amount) => (value += this.statValue({ maxHp: amount })),
        boostStat: (stat, amount) => {
          value += this.statValue({ [stat === "cooldown" ? "cooldown" : stat]: amount } as GearStats);
        },
        special: (id) => (value += total * (id === "multisig" ? 0.25 : 0.04)),
        perk: (id, amount) => (value += total * PERK_VALUE[id] * amount),
        hasUpgrade: (id) => this.ownsUpgrade(id),
        hasWeapon: (kind) => this.weapons.some((w) => w.kind === kind),
        weaponCount: () => this.weapons.length,
        weaponLevel: (kind) => this.weapons.find((w) => w.kind === kind)?.level ?? 0,
        weaponEvolved: (kind) => !!this.weapons.find((w) => w.kind === kind)?.evolved,
      });
      if (card.tag?.startsWith("EVOLVES")) value += total * 0.15;
      card.value = value;
    }
    let best: UpgradeDef | undefined;
    for (const card of cards) {
      card.recommended = false;
      if ((card.value ?? 0) > (best?.value ?? -Infinity)) best = card;
    }
    if (best) best.recommended = true;
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
      this.addToast(`${WELL_STATS[w.stat].title}: ${WELL_STATS[w.stat].description}`, "#6cb6ff");
      this.ringParticle(w.x, w.y, w.radius, "#58a6ff");
    }
  }

  private updateRigs(dt: number) {
    const p = this.player;
    for (const rig of this.rigs) {
      const def = SIDEKICKS[rig.kind];
      const output = 1 + rig.tier * 0.4;
      rig.angle += dt * 2.2;
      const side = this.rigs.indexOf(rig) === 0 ? 1 : -1;
      const lead = p.facing + Math.PI + side * 0.6;
      const tx = p.x + Math.cos(lead) * (def.orbit * 0.9) + Math.cos(rig.angle) * 10;
      const ty = p.y + Math.sin(lead) * (def.orbit * 0.9) + Math.sin(rig.angle * 2) * 6;
      rig.x = lerpVec(rig.x, tx, clamp(dt * 6, 0, 1));
      rig.y = lerpVec(rig.y, ty, clamp(dt * 6, 0, 1));
      rig.attackTimer -= dt;
      if (rig.kind === "block-builder") {
        for (const pk of this.pickups) if (!pk.magnetized && dist(rig.x, rig.y, pk.x, pk.y) < def.coinCollectRadius * 2 * output) pk.magnetized = true;
      }
      if (rig.attackTimer > 0) continue;
      if (rig.kind === "dev-laptop") {
        const target = this.nearestEnemy(rig.x, rig.y, 360);
        if (!target) continue;
        rig.attackTimer = def.attackCooldown / output;
        const a = angleBetween(rig.x, rig.y, target.x, target.y);
        this.projectiles.push({ id: uid(), x: rig.x, y: rig.y, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, radius: 5, dead: false, damage: this.strikeDamage() * 0.14, life: 0.9, pierce: 0, fromPlayer: true, color: "#58a6ff", homing: true, targetId: target.id });
      } else if (rig.kind === "asic-miner") {
        rig.attackTimer = 9 / output;
        this.spawnPickup(rig.x, rig.y, "coin", 2);
      } else if (rig.kind === "codebase-guardian") {
        rig.attackTimer = 7;
        const until = this.elapsed + 0.6 + rig.tier * 0.2;
        for (const e of this.enemies) if (!ENEMIES[e.kind].isBoss && dist(p.x, p.y, e.x, e.y) < 170) e.frozenUntil = until;
        this.shockwaves.push({ x: p.x, y: p.y, radius: 170, life: 0.3, maxLife: 0.3, color: "#79c0ff" });
      } else {
        rig.attackTimer = 1;
      }
    }
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
      this.chestsOpened++;
      this.spentSinceBoss += cost;
      this.openChest(`${def.name.toUpperCase()}: PICK ONE`, def.minRarity, def.color, c.x, c.y);
    }
  }

  chestCost(base: number): number {
    return Math.ceil(base * (1 + this.chestsOpened * CHEST_COST_GROWTH));
  }

  weaponDamageScale(w: WeaponInstance, baseDamage: number): number {
    const sailor = this.elapsed < this.player.neverSellUntil ? 1.3 : 1;
    return baseDamage * this.damageTotal() * this.buffMult("damage") * rarityDamageMult(w.rarity) * sailor;
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
    const fighting = this.enemies.reduce((n, e) => (e.kind === "honeypot-mimic" ? n : n + 1), 0);
    if (fighting >= ceiling) {
      this.spawnTimer = 0.1;
      return;
    }
    const deficit = ceiling - fighting;
    this.spawnTimer = Math.max(0.1, 0.9 - this.elapsed / 400);
    const batch = Math.min(6, Math.ceil(deficit / 8));
    for (let i = 0; i < batch; i++) this.spawnHordeEnemy();
  }

  private spawnHordeEnemy() {
    const p = this.player;
    const { halfW, halfH } = groundHalfExtents(this.spawnAspect);
    const angle = spawnRandom() * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const edge = Math.min(halfW * 1.25 / Math.max(Math.abs(cos), 1e-3), halfH / Math.max(Math.abs(sin), 1e-3));
    const distSpawn = edge + 70 + spawnRandom() * 100;
    const kind = this.pickHordeKind();
    const e = this.spawnEnemyAt(kind, p.x + cos * distSpawn, p.y + sin * distSpawn);
    if (!this.attract && this.elapsed > ELITE_MIN_TIME && kind !== "honeypot-mimic" && spawnRandom() < ELITE_CHANCE && this.enemies.filter((m) => m.elite).length < MAX_WHALES) this.makeWhale(e);
  }

  private ringPoint(extra = 0): { x: number; y: number } {
    const { halfW, halfH } = groundHalfExtents(this.spawnAspect);
    const a = spawnRandom() * Math.PI * 2;
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

  makeWhale(e: Enemy) {
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
      if (w.kind === "bot-farm" && count("bot-farm") >= MAX_BOT_FARMS) return false;
      if ((w.kind === "shadow-op" || w.kind === "oracle-manipulator") && shooters >= MAX_SHOOTERS) return false;
      return true;
    });
    const weighted = eligible.map((w) => ({
      kind: w.kind,
      weight: w.weight * (bias[w.kind] ?? 1),
    }));
    const total = weighted.reduce((s, w) => s + w.weight, 0);
    let r = spawnRandom() * total;
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
    const scale = (1 + index * 0.35) * Math.pow(2.2, bossTierAt(index)) * dm.enemyHpMult * this.nextBossHpBonus;
    this.nextBossHpBonus = 1;
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

  skipCinematic() {
    if (this.cinematic) this.cinematic.t += 99;
  }

  taintRun() {
    this.recorder.taint();
  }

  runLog(): RunLog {
    return this.recorder.finish(this.runTick, this.stateHash());
  }

  stateHash(): number {
    const p = this.player;
    let hash = 2166136261;
    const mix = (value: number) => {
      hash = Math.imul(hash ^ Math.round(value * 1000), 16777619) >>> 0;
    };
    [this.runTick, p.x, p.y, p.hp, p.level, p.xp, p.coins, this.stats.kills, this.enemies.length, this.pickups.length, this.projectiles.length].forEach(mix);
    for (const e of this.enemies) {
      mix(e.id);
      mix(e.x);
      mix(e.y);
      mix(e.hp);
    }
    return hash;
  }

  private syncAspect() {
    const aspect = roundAspect(this.aspectSource());
    if (aspect === this.spawnAspect) return;
    this.spawnAspect = aspect;
    this.recorder.aspect(this.runTick, aspect);
  }

  debugSetTime(seconds: number) {
    this.taintRun();
    this.elapsed = seconds;
    this.bossesSpawned = 0;
    while (bossTimeAt(this.bossesSpawned) < seconds) this.bossesSpawned++;
  }

  debugSpawnBoss(kind: EnemyKind) {
    this.taintRun();
    this.beginBossEntrance(kind);
  }

  debugPlayCutscene(id: CutsceneId) {
    this.taintRun();
    const back = this.phase;
    this.setPhase("cutscene");
    this.cutscene.play(id, () => this.setPhase(back === "playing" ? "playing" : "menu"));
  }

  private updateYield(dt: number) {
    if (this.perks.regen > 0 && this.dying <= 0) this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.perks.regen * dt);
    if (this.elapsed < this.yieldSlashedUntil) return;
    const stake = this.perks.lido > 0 && this.stillTime > 1 ? this.player.xpToNext * 0.02 : 0;
    const perSec = this.player.yieldPerSec + (this.gearStats.yield ?? 0) * 0.75 + stake;
    this.player.xp += perSec * dt * this.player.xpMult;
    if (this.perks.aave > 0) {
      this.aaveTimer += dt;
      if (this.aaveTimer >= 10) {
        this.aaveTimer = 0;
        this.player.xp += this.player.xpToNext * 0.02;
      }
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
      if (this.elapsed >= (e.frozenUntil ?? 0) && !applyLure(this, e, e.speed, dt)) updateEnemyBehavior(this, e, dt);
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
      const thorns = this.perks.thorns + (this.buffActive("thorns") ? 120 : 0);
      if (thorns > 0) this.damageEnemy(e, thorns);
      if (e.kind === "tg-scammer") this.scammerSteals(e);
    }

    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  private scammerSteals(e: Enemy) {
    const stolen = Math.min(this.player.coins, 6);
    this.player.coins -= stolen;
    if (stolen > 0) this.addFloater(this.player.x, this.player.y - 60, `-${stolen} $SAFU · SCAMMED`, "#4ab3e8");
    const at = this.ringPoint();
    e.x = at.x;
    e.y = at.y;
    e.px = at.x;
    e.py = at.y;
  }

  private recycleIfFar(e: Enemy) {
    if (e.bounty) return;
    if (e.kind === "honeypot-mimic" && dist(e.x, e.y, this.player.x, this.player.y) > RECYCLE_DISTANCE) {
      e.dead = true;
      return;
    }
    if (e.kind === "honeypot-mimic") return;
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

  nearestEnemy(x: number, y: number, range: number): Enemy | undefined {
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
    const cooldownMult = this.weaponCooldownMult();
    for (const w of this.weapons) {
      if (w.jammed) continue;
      w.timer -= dt;
      const def = weaponAtLevel(w.kind, w.level);
      const cd = def.cooldown * cooldownMult;
      if (w.timer > 0) continue;
      w.timer = cd;

      if (def.orbit) continue;
      fireTool(this, w, def, cd);
    }
  }

  spawnProjectile(
    x: number,
    y: number,
    dx: number,
    dy: number,
    def: ReturnType<typeof weaponAtLevel>,
    w: WeaponInstance,
    targetId?: number
  ): Projectile {
    const kind = w.kind;
    const speed = def.projectileSpeed ?? 400;
    const life = def.range / speed + 0.5;
    const isProof = kind === "merkle-proof";
    const shot: Projectile = {
      id: uid(),
      x,
      y,
      vx: dx * speed,
      vy: dy * speed,
      radius: kind === "finality-beam" ? 6 : 5,
      dead: false,
      damage: this.weaponDamageScale(w, def.damage),
      life: isProof ? life * 1.8 : life,
      returnAt: isProof ? life * 0.9 : undefined,
      pierce: isProof ? 999 : (def.pierce ?? 0) + this.perks.pierce,
      fromPlayer: true,
      weaponKind: kind,
      color: TOOL_COLORS[kind] ?? DEFAULT_TOOL_COLOR,
      homing: false,
      targetId,
    };
    this.projectiles.push(shot);
    return shot;
  }

  aoeHit(x: number, y: number, radius: number, damage: number, _kind?: WeaponKind) {
    for (const e of this.enemies) {
      if (e.dead || isHiddenFromWeapons(e)) continue;
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

      if (pr.returnAt !== undefined && pr.life <= pr.returnAt) {
        const back = angleBetween(pr.x, pr.y, this.player.x, this.player.y);
        const spd = Math.hypot(pr.vx, pr.vy);
        pr.vx = Math.cos(back) * spd;
        pr.vy = Math.sin(back) * spd;
        if (pr.returnAt !== Infinity) {
          pr.outIds = pr.hitIds;
          pr.hitIds = undefined;
        }
        pr.returnAt = Infinity;
        if (dist(pr.x, pr.y, this.player.x, this.player.y) < 24) pr.dead = true;
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
          this.damageEnemy(e, pr.outIds?.includes(e.id) ? pr.damage * 2 : pr.damage, pr.vx, pr.vy, pr.weaponKind);
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
    const p = this.player;
    if (!p) return;
    const previous = this.orbiters;
    this.orbiters = [];
    for (const w of this.weapons) {
      const def = WEAPONS[w.kind];
      if (!def.orbit) continue;
      const count = 1 + Math.floor(w.level / 2) + (w.evolved ? 2 : 0);
      const kept = previous.filter((o) => o.weaponKind === w.kind);
      for (let i = 0; i < count; i++) {
        this.orbiters.push({
          id: uid(),
          x: p.x,
          y: p.y,
          vx: 0,
          vy: 0,
          radius: 18,
          dead: false,
          angle: (Math.PI * 2 * i) / count,
          dist: weaponAtLevel(w.kind, w.level).range * 0.6,
          damage: 0,
          weaponKind: w.kind,
          offUntil: kept[i]?.offUntil,
          tvlSince: kept[i]?.tvlSince,
        });
      }
    }
  }

  private updateOrbiters(dt: number) {
    const p = this.player;
    for (const o of this.orbiters) {
      o.angle += dt * (2.2 + (o.weaponKind === "rug-coin" ? 0.8 : 0));
      o.x = p.x + Math.cos(o.angle) * o.dist;
      o.y = p.y + Math.sin(o.angle) * o.dist;
      if (this.elapsed < (o.offUntil ?? 0)) continue;
      const w = this.weapons.find((x) => x.kind === o.weaponKind);
      if (!w || w.jammed) continue;
      const base = this.weaponDamageScale(w, weaponAtLevel(w.kind, w.level).damage);
      let damage = base;
      if (o.weaponKind === "rug-coin") {
        o.tvlSince ??= this.elapsed;
        const held = this.elapsed - o.tvlSince;
        damage = base * (1 + Math.min(RUG_HOLD_SEC, held) * 0.08);
        if (held >= RUG_HOLD_SEC) {
          this.addStrike(o.x, o.y, 130 * (1 + this.perks.area), base * 5, "#f778ba", 0, o.weaponKind);
          o.offUntil = this.elapsed + 6;
          o.tvlSince = this.elapsed + 6;
          this.addFloater(o.x, o.y - 26, "RUGGED", "#f778ba");
          this.audio.play("rugPull");
          continue;
        }
      }
      if (o.weaponKind === "stable-shield") {
        const block = this.projectiles.find((pr) => !pr.fromPlayer && !pr.dead && dist(pr.x, pr.y, o.x, o.y) < 26);
        if (block) {
          block.dead = true;
          o.offUntil = this.elapsed + 3;
          this.burstParticles(o.x, o.y, "#5de2b8", 6);
          this.audio.play("nearMiss");
          continue;
        }
      }
      const near = this.spatial.query(o.x, o.y, o.radius + 44, this.collisionScratch);
      for (const item of near) {
        const e = this.enemyById.get(item.id);
        if (!e || e.dead || isHiddenFromWeapons(e)) continue;
        if (rectsOverlap(o.x, o.y, o.radius, e.x, e.y, e.radius)) this.damageEnemy(e, damage * dt * 3.5, 0, 0, o.weaponKind);
      }
    }
  }

  damageEnemy(e: Enemy, damage: number, pushX = 0, pushY = 0, weapon?: WeaponKind) {
    const shielded = e.kind === "boss-oracle" && this.enemies.some((m) => m.feedNode && !m.dead);
    const big = !!(e.elite || ENEMIES[e.kind].isBoss);
    let multiplier = 1;
    if (weapon !== undefined && this.perks.crit > 0 && simRandom() < this.perks.crit) multiplier *= 2;
    if (this.elapsed < (e.slashedUntil ?? 0)) multiplier *= 1.25;
    if (weapon === "whale-alert" && big) multiplier *= 2;
    if (big) multiplier *= 1 + this.perks.bugBounty;
    if (weapon === "audit-dart") {
      e.auditHits = (e.auditHits ?? 0) + 1;
      if (e.auditHits % 3 === 0) multiplier *= 3;
    }
    if (weapon && this.player.characterId === "diff" && e.hp >= e.maxHp) multiplier *= 2;
    const dealt = Math.max(1, Math.round((shielded ? damage * 0.25 : damage) * multiplier));
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
      x: e.x + cosmeticRange(-8, 8),
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
    if (this.perks.killBlast > 0 && simRandom() < this.perks.killBlast) this.addStrike(e.x, e.y, 90, this.strikeDamage() * 0.35, "#ff8552", 0);
    if (e.kind === "sybil") {
      for (let i = 0; i < 3; i++) this.spawnEnemyAt("sybil-mini", e.x + randRange(-22, 22), e.y + randRange(-22, 22));
    }
    if (e.kind === "gas-guzzler") gasCloud(this, e.x, e.y, 96, e.damage * 0.5, e.kind);
    if (e.elite) {
      const title = e.bounty ? "BOUNTY COLLECTED" : "WHALE LIQUIDATED";
      this.addToast(title, "#ffc23d");
      if (e.bounty) this.openChest("BOUNTY CHEST: PICK ONE", "rare", "#ffc23d", e.x, e.y);
      else this.spawnPickup(e.x, e.y, "coin", rollGold("uncommon"));
    }
    if (def.isBoss || e.elite) this.popupHoldUntil = this.elapsed + (def.isBoss ? 1.2 : 0.4);
    if (def.isBoss) {
      this.openChest("BOSS CHEST: PICK ONE", RARITY_ORDER[Math.min(4, 1 + Math.floor(this.stats.bossesDefeated / 2))]!, def.color, e.x, e.y);
      if (this.perks.opGrant > 0 && this.spentSinceBoss > 0) {
        const refund = Math.round(this.spentSinceBoss * 0.25);
        this.player.coins += refund;
        this.addToast(`Retro grant: +${refund} $SAFU`, "#ff5c48");
      }
      this.spentSinceBoss = 0;
    }
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
    const coinChance = def.isBoss ? 1 : 0.07;
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
    if (kind === "xp" && this.pickups.length >= MAX_PICKUPS) {
      const merged = this.pickups.find((pk) => pk.kind === "xp" && !pk.dead);
      if (merged) {
        merged.value += value;
        return;
      }
    }
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
      if (d < pickupReach || this.attract) pk.magnetized = true;
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
          const coins = Math.round(pk.value * (1 + (this.gearStats.coin ?? 0) + this.perks.coin));
          p.coins += coins;
          if (this.perks.curve > 0) p.hp = Math.min(p.maxHp, p.hp + coins);
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
    this.player.xp += amount * (1 + (this.gearStats.xp ?? 0) + this.perks.xp) * (this.elapsed < this.doubleXpUntil ? 2 : 1);
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
    for (const a of this.arcs) a.life -= dt;
    this.arcs = this.arcs.filter((a) => a.life > 0);
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
      const a = cosmeticRange(0, Math.PI * 2);
      const s = cosmeticRange(40, 160);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: cosmeticRange(0.25, 0.6),
        maxLife: 0.6,
        color,
        size: cosmeticRange(2, 5),
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
      rigs: this.rigs.map((r) => `${SIDEKICKS[r.kind].name} T${r.tier + 1}`),
      stash: p.stash.map(gearName),
      fieldRadius: this.fieldRadius,
      nextBoss: this.nextBossIn,
      gear: (Object.keys(SLOT_LABEL) as (keyof typeof SLOT_LABEL)[]).map((slot) => {
        const item = p.gear[slot];
        return { slot: SLOT_LABEL[slot], name: item ? gearName(item) : null, rarity: item ? gearDef(item.id).rarity : "common" };
      }),
      toasts: this.toasts,
      ability: p.ability ? { name: ABILITIES[p.ability].short, remaining: Math.max(0, p.abilityReadyAt - this.elapsed), color: ABILITIES[p.ability].color } : null,
      shielded: this.elapsed < p.shieldUntil,
      neverSell: this.elapsed < p.neverSellUntil,
    });
  }
}

function xpForLevel(level: number): number {
  const early = Math.min(level, XP_STEEP_FROM_LEVEL) - 1;
  const late = Math.max(0, level - XP_STEEP_FROM_LEVEL);
  return Math.floor(25 * Math.pow(1.14, early) * Math.pow(1.19, late));
}

function lerpVec(current: number, target: number, t: number): number {
  return current + (target - current) * t;
}
