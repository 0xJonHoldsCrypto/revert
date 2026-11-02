export type SidekickKind = "asic-miner" | "dev-laptop" | "codebase-guardian" | "block-builder";

export type TimedBuffKind = import("./data/timedBuffs").TimedBuffKind;

export type WellStatId = import("./data/wells").WellStatId;

export type GamePhase = "menu" | "cutscene" | "playing" | "levelup" | "paused" | "won" | "lost";

export type CharacterId = "cz" | "elon" | "sbf" | "sec-dev";

export type EnemyKind =
  | "script-kiddie"
  | "phishing-bot"
  | "lazarus-op"
  | "bridge-drainer"
  | "rug-dev"
  | "mev-searcher"
  | "oracle-witch"
  | "sim-swapper"
  | "insider"
  | "boss-lazarus-414"
  | "boss-phish-king"
  | "boss-apt38"
  | "boss-grandmaster"
  | "boss-mev-king"
  | "boss-oracle";

export type WeaponKind =
  | "audit-dart"
  | "bnb-whip"
  | "eth-beam"
  | "stable-shield"
  | "alameda-burst"
  | "rug-coin"
  | "memo-pulse"
  | "flash-loan"
  | "validator-seal"
  | "bridge-bolt"
  | "nonce-shard";

export interface CharacterDef {
  id: CharacterId;
  name: string;
  emoji: string;
  role: string;
  blurb: string;
  color: string;
  accent: string;
  maxHp: number;
  moveSpeed: number;
  damageMult: number;
  xpMult: number;
  dashCooldown: number;
  startWeapon: WeaponKind;
}

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  emoji: string;
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  xp: number;
  color: string;
  isBoss?: boolean;
  contactCooldown?: number;
}

import type { WeaponRarity } from "./data/rarity";

export type { WeaponRarity };

export interface WeaponDef {
  kind: WeaponKind;
  name: string;
  description: string;
  damage: number;
  cooldown: number;
  range: number;
  rarity: WeaponRarity;
  projectileSpeed?: number;
  orbit?: boolean;
  pierce?: number;
  aoe?: number;
  maxLevel: number;
}

export interface UpgradeDef {
  id: string;
  title: string;
  description: string;
  rarity?: WeaponRarity;
  apply: (ctx: UpgradeContext) => boolean;
  maxTimes?: number;
}

export interface UpgradeContext {
  addWeapon: (kind: WeaponKind, rarity?: WeaponRarity) => void;
  upgradeWeapon: (kind: WeaponKind) => void;
  heal: (amount: number) => void;
  boostStat: (stat: "damage" | "speed" | "pickup" | "armor" | "cooldown" | "yield", amount: number) => void;
  hasWeapon: (kind: WeaponKind) => boolean;
  weaponLevel: (kind: WeaponKind) => number;
  weaponEvolved: (kind: WeaponKind) => boolean;
}

export interface Entity {
  id: number;
  x: number;
  y: number;
  px?: number;
  py?: number;
  vx: number;
  vy: number;
  radius: number;
  dead: boolean;
}

export interface PlayerState extends Entity {
  characterId: CharacterId;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpToNext: number;
  invuln: number;
  dashCooldown: number;
  dashTimer: number;
  facing: number;
  damageMult: number;
  xpMult: number;
  moveSpeed: number;
  pickupRadius: number;
  armor: number;
  cooldownMult: number;
  yieldPerSec: number;
  coins: number;
  sidekick: SidekickKind | null;
  activeBuffs: { kind: TimedBuffKind; until: number }[];
  wellBonusArmor: number;
}

export interface Enemy extends Entity {
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  contactCd: number;
  flash: number;
  wobble: number;
}

export interface Projectile extends Entity {
  damage: number;
  life: number;
  pierce: number;
  fromPlayer: boolean;
  color: string;
  homing?: boolean;
  targetId?: number;
}

export interface Orbiter extends Entity {
  angle: number;
  dist: number;
  damage: number;
  weaponKind: WeaponKind;
}

export interface Pickup extends Entity {
  kind: "xp" | "health" | "magnet" | "coin" | "buff";
  value: number;
  magnetized: boolean;
  buffKind?: TimedBuffKind;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface Floater {
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
}

export type ChestKind = "cold-wallet" | "defi-lootbox" | "validator-crate" | "airdrop-pod" | "grant-safe";

export type EnvObstacleKind =
  | "rug-pool"
  | "gas-gate"
  | "kyc-wall"
  | "liquidation-spike"
  | "sandwich-bot"
  | "honeypot"
  | "mempool-fog";

export interface WorldChest {
  id: number;
  kind: ChestKind;
  x: number;
  y: number;
  radius: number;
  openProgress: number;
  opened: boolean;
  coinCost: number;
}

export interface WorldWell {
  id: number;
  x: number;
  y: number;
  radius: number;
  stat: WellStatId;
  used: boolean;
  channelProgress: number;
}

export interface SidekickState {
  kind: SidekickKind;
  x: number;
  y: number;
  angle: number;
  attackTimer: number;
}

export interface WorldObstacle {
  id: number;
  kind: EnvObstacleKind;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WeaponInstance {
  kind: WeaponKind;
  level: number;
  timer: number;
  rarity: WeaponRarity;
  evolved?: boolean;
}

export interface RunStats {
  kills: number;
  damageDealt: number;
  timeSurvived: number;
  bossesDefeated: number;
}
